import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * irrigation-advisor
 *
 * Kissan AI "Irrigation Advisor" Engine.
 *
 * Answers:
 * "When and how much should I irrigate my crop?"
 *
 * Uses:
 * - Real saved farm context
 * - Deterministic growth stage
 * - Live weather snapshot when available
 * - Deterministic rain/heat irrigation rules
 * - Optional Gemini explanation
 * - Immediate OpenRouter fallback on Gemini 429
 *
 * Important:
 * - Deterministic rules decide the safe irrigation status/urgency.
 * - AI can only provide contextual explanation.
 * - AI must never override deterministic status/urgency.
 * - Exact water quantities are never fabricated.
 * - AI output is validated and sanitized before persistence.
 *
 * Architecture:
 * Browser
 *   ↓
 * Supabase Edge Function
 *   ↓
 * Deterministic irrigation rules
 *   ↓
 * Gemini
 *   ↓ 429 only
 * OpenRouter free router
 *   ↓
 * Validated response
 *   ↓
 * irrigation_recommendations
 */

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "https://kissan-ai-six.vercel.app",
  "https://vxldkzrmtygurdggtjro.supabase.co",
];

function corsForOrigin(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";

  const headers: Record<string, string> = {
    ...corsHeaders,
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

const MODEL = "gemini-3.5-flash";

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const VALID_STATUSES = new Set([
  "irrigate_now",
  "irrigation_soon",
  "delay",
  "adequate",
  "insufficient",
]);

const VALID_URGENCIES = new Set([
  "low",
  "medium",
  "high",
]);

const STAGE_LABELS: Record<string, string> = {
  germination: "Germination / Emergence",
  vegetative: "Vegetative",
  flowering: "Flowering",
  fruiting: "Fruiting / Reproductive",
  maturity: "Maturity",
  harvest: "Harvest / Ready",
};

const STAGE_ORDER = [
  "germination",
  "vegetative",
  "flowering",
  "fruiting",
  "maturity",
  "harvest",
] as const;

const CROP_CONFIGS: Record<
  string,
  { endDays: number[] }
> = {
  wheat: {
    endDays: [10, 70, 95, 120, 140, 150],
  },
  rice: {
    endDays: [7, 55, 75, 105, 125, 140],
  },
  cotton: {
    endDays: [14, 55, 90, 140, 165, 180],
  },
  maize: {
    endDays: [7, 50, 65, 95, 110, 120],
  },
  sugarcane: {
    endDays: [30, 180, 240, 300, 340, 365],
  },
};

const CROP_ALIASES: Record<string, string> = {
  wheat: "wheat",
  gehun: "wheat",
  gandum: "wheat",

  rice: "rice",
  chawal: "rice",
  paddy: "rice",

  cotton: "cotton",
  kapas: "cotton",

  maize: "maize",
  corn: "maize",
  makai: "maize",

  sugarcane: "sugarcane",
  ganna: "sugarcane",
  "sugar cane": "sugarcane",
};

function json(
  data: unknown,
  status = 200,
  req?: Request,
): Response {
  const headers = req
    ? corsForOrigin(req)
    : corsHeaders;

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

/* ------------------------------------------------------------------ */
/* JSON parsing                                                       */
/* ------------------------------------------------------------------ */

/**
 * OpenRouter/free can sometimes return JSON inside markdown fences
 * or with a short preamble. This helper safely extracts the JSON object.
 */
function parseJsonObject(text: string): unknown | null {
  if (!text || typeof text !== "string") {
    return null;
  }

  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue with object extraction below.
  }

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");

  if (first !== -1 && last > first) {
    try {
      return JSON.parse(
        cleaned.slice(first, last + 1),
      );
    } catch {
      return null;
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Deterministic growth stage                                         */
/* ------------------------------------------------------------------ */

function normalizeCrop(crop: string): string {
  return crop
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getGrowthStage(
  cropRaw: string | null | undefined,
  plantingDate: string | null | undefined,
): {
  growthStage: string;
  stageLabel: string;
  cropAgeDays: number | null;
} {
  const crop =
    normalizeCrop(cropRaw ?? "") || "Unknown crop";

  if (!plantingDate) {
    return {
      growthStage: "unknown",
      stageLabel: "Growth stage unavailable",
      cropAgeDays: null,
    };
  }

  const planted = new Date(
    plantingDate + "T00:00:00Z",
  ).getTime();

  if (Number.isNaN(planted)) {
    return {
      growthStage: "unknown",
      stageLabel: "Growth stage unavailable",
      cropAgeDays: null,
    };
  }

  const now = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  );

  const days = Math.floor(
    (now - planted) / 86_400_000,
  );

  if (days < 0) {
    return {
      growthStage: "not_started",
      stageLabel: "Not started",
      cropAgeDays: 0,
    };
  }

  const canonical =
    CROP_ALIASES[crop] ?? crop;

  const config = CROP_CONFIGS[canonical];

  if (!config) {
    return {
      growthStage: "unknown",
      stageLabel: "Growth stage unavailable",
      cropAgeDays: days,
    };
  }

  let stage = "harvest";
  let prevEnd = -1;

  for (
    let i = 0;
    i < STAGE_ORDER.length;
    i++
  ) {
    const startDay = prevEnd + 1;
    const endDay = config.endDays[i];

    prevEnd = endDay;

    if (
      days >= startDay &&
      days <= endDay
    ) {
      stage = STAGE_ORDER[i];
      break;
    }
  }

  return {
    growthStage: stage,
    stageLabel: STAGE_LABELS[stage],
    cropAgeDays: days,
  };
}

/* ------------------------------------------------------------------ */
/* Deterministic irrigation rules                                     */
/* ------------------------------------------------------------------ */

const RAIN_DELAY = 40;
const RAIN_STRONG = 70;

const HEAT_WARM = 33;
const HEAT_HIGH = 40;

const RAIN_DEPENDENT_METHODS = [
  "rain-fed",
  "rain fed",
  "barani",
  "rainfed",
];

const STAGE_WEIGHT: Record<string, number> = {
  germination: 0.6,
  seedling: 0.7,
  vegetative: 0.9,
  flowering: 1,
  fruiting: 1,
  maturity: 0.6,
  harvest: 0.2,
};

function isRainDependent(
  method: string | null | undefined,
): boolean {
  const m = (method ?? "")
    .trim()
    .toLowerCase();

  return RAIN_DEPENDENT_METHODS.some(
    (k) => m.includes(k),
  );
}

function effectiveRain(
  currentPct: number | null | undefined,
  forecast:
    | Array<{
        rainProbability?: number;
      }>
    | undefined,
): number {
  const vals = [
    Number(currentPct) || 0,
  ];

  for (const f of forecast ?? []) {
    const r =
      Number(f.rainProbability) || 0;

    if (r > 0) {
      vals.push(r);
    }
  }

  return Math.max(...vals);
}

interface RuleResult {
  status: string;
  urgency: string;
  reason: string;
}

/**
 * Decide the SAFE deterministic outcome.
 *
 * AI is never allowed to override this result.
 */
function decideRules(
  crop: string,
  growthStage: string,
  soil: string,
  method: string,
  temp: number | null,
  rain: number,
): RuleResult {
  void crop;
  void soil;

  const stage = [
    "unknown",
    "not_started",
  ].includes(growthStage)
    ? null
    : growthStage;

  const weight = stage
    ? STAGE_WEIGHT[stage] ?? 0.5
    : 0.5;

  const heat =
    (temp ?? 0) >= HEAT_WARM;

  const heatHigh =
    (temp ?? 0) >= HEAT_HIGH;

  if (rain >= RAIN_STRONG) {
    return {
      status: "delay",
      urgency: "low",
      reason:
        "Rain is expected soon, so irrigation can be delayed. Check soil moisture and avoid watering until the rain passes.",
    };
  }

  if (
    rain >= RAIN_DELAY &&
    heatHigh
  ) {
    return {
      status: "irrigation_soon",
      urgency: "medium",
      reason:
        "Rain may arrive but very high temperatures raise water demand — monitor soil moisture and be ready to irrigate soon.",
    };
  }

  if (
    isRainDependent(method) &&
    heatHigh
  ) {
    return {
      status: "irrigate_now",
      urgency: "high",
      reason:
        "Your irrigation depends on rainfall and very high temperatures increase crop water loss — irrigate now if water is available.",
    };
  }

  if (
    isRainDependent(method) &&
    heat
  ) {
    return {
      status: "irrigation_soon",
      urgency: "medium",
      reason:
        "Warm conditions with rain-dependent irrigation raise crop water need — check soil moisture and prepare to irrigate.",
    };
  }

  if (
    stage &&
    weight >= 0.9 &&
    heat
  ) {
    return {
      status: "irrigation_soon",
      urgency: "medium",
      reason:
        "The crop is in a water-demanding stage and conditions are warm — plan to irrigate and keep soil moisture sufficient.",
    };
  }

  if (stage && !heat) {
    return {
      status: "adequate",
      urgency: "low",
      reason:
        "Conditions are stable and not strongly demanding water. Monitor soil moisture and irrigate according to your local practice.",
    };
  }

  return {
    status: "adequate",
    urgency: "low",
    reason:
      "There is no strong signal that irrigation is needed right now. Monitor soil moisture and follow normal irrigation practice.",
  };
}

/* ------------------------------------------------------------------ */
/* Validation / sanitization                                          */
/* ------------------------------------------------------------------ */

function cleanString(
  value: unknown,
  maxLen: number,
): string {
  const s = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

  return s.slice(0, maxLen);
}

function cleanStrings(
  value: unknown,
  maxItems: number,
  maxLen: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const out: string[] = [];

  for (const v of value) {
    const s = cleanString(v, maxLen);

    if (
      s &&
      out.length < maxItems
    ) {
      out.push(s);
    }
  }

  return out;
}

interface ValidatedRecommendation {
  status: string;
  urgency: string;
  recommendation: string;

  timing: {
    recommended_time: string;
    reason: string;
  } | null;

  waterGuidance: {
    amount: string;
    unit: string;
    confidence: number;
    relative: string;
  };

  weatherImpact: string;
  soilImpact: string;
  cropStageImpact: string;
  rainAdjustment: string;
  nextCheck: string;
  importantNotes: string[];
  limitations: string[];
}

/**
 * Exact water quantities are deliberately removed.
 */
function sanitizePayload(
  raw: unknown,
  fallback: RuleResult,
): ValidatedRecommendation | null {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  ) {
    return {
      status: fallback.status,
      urgency: fallback.urgency,
      recommendation: fallback.reason,

      timing: null,

      waterGuidance: {
        amount: "",
        unit: "",
        confidence: 0,
        relative: "",
      },

      weatherImpact: "",
      soilImpact: "",
      cropStageImpact: "",
      rainAdjustment: "",

      nextCheck:
        "Check soil moisture again later today or tomorrow.",

      importantNotes: [],
      limitations: [],
    };
  }

  const r =
    raw as Record<string, unknown>;

  const statusRaw = String(
    r.irrigation_status ??
      r.status ??
      "",
  );

  const status =
    VALID_STATUSES.has(statusRaw)
      ? statusRaw
      : fallback.status;

  const urgencyRaw = String(
    r.urgency ?? "",
  );

  const urgency =
    VALID_URGENCIES.has(urgencyRaw)
      ? urgencyRaw
      : fallback.urgency;

  const wg =
    typeof r["water_guidance"] ===
      "object" &&
    r["water_guidance"]
      ? (r["water_guidance"] as Record<
          string,
          unknown
        >)
      : {};

  return {
    status,
    urgency,

    recommendation:
      cleanString(
        r["recommendation"],
        600,
      ) || fallback.reason,

    timing:
      typeof r["timing"] === "object" &&
      r["timing"]
        ? {
            recommended_time:
              cleanString(
                (
                  r["timing"] as Record<
                    string,
                    unknown
                  >
                )["recommended_time"],
                200,
              ),

            reason:
              cleanString(
                (
                  r["timing"] as Record<
                    string,
                    unknown
                  >
                )["reason"],
                300,
              ),
          }
        : null,

    waterGuidance: {
      // Deliberately empty.
      amount: "",
      unit: "",
      confidence: 0,

      relative: cleanString(
        wg["relative"] ??
          r["water_guidance_relative"],
        400,
      ),
    },

    weatherImpact: cleanString(
      r["weather_impact"],
      400,
    ),

    soilImpact: cleanString(
      r["soil_impact"],
      400,
    ),

    cropStageImpact: cleanString(
      r["crop_stage_impact"],
      400,
    ),

    rainAdjustment: cleanString(
      r["rain_adjustment"],
      400,
    ),

    nextCheck:
      cleanString(
        r["next_check"],
        160,
      ) ||
      "Check soil moisture again later today or tomorrow.",

    importantNotes: cleanStrings(
      r["important_notes"],
      10,
      400,
    ),

    limitations: cleanStrings(
      r["limitations"],
      10,
      400,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Gemini                                                             */
/* ------------------------------------------------------------------ */

async function callGemini(
  apiKey: string,
  prompt: string,
): Promise<{ text: string }> {
  const url =
    `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;

  let resp: Response;

  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],

        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (error) {
    console.error(
      "irrigation-advisor Gemini network error:",
      error instanceof Error
        ? error.message
        : error,
    );

    throw new Error(
      "Kissan AI is temporarily unavailable. Please try again.",
    );
  }

  if (resp.ok) {
    const data = await resp.json();

    const text =
      data?.candidates?.[0]?.content
        ?.parts?.[0]?.text ?? "";

    if (!text) {
      throw new Error(
        "Kissan AI couldn't form irrigation advice. Please try again.",
      );
    }

    return { text };
  }

  const errorText =
    await resp.text();

  console.error(
    `${MODEL} irrigation-advisor error:`,
    resp.status,
    errorText.slice(0, 500),
  );

  /**
   * IMPORTANT:
   * Only 429 triggers OpenRouter fallback.
   */
  if (resp.status === 429) {
    throw new Error(
      "GEMINI_RATE_LIMIT",
    );
  }

  throw new Error(
    "Kissan AI is temporarily unavailable. Please try again.",
  );
}

/* ------------------------------------------------------------------ */
/* OpenRouter fallback                                                */
/* ------------------------------------------------------------------ */

async function callOpenRouter(
  apiKey: string,
  prompt: string,
): Promise<{
  text: string;
  model: string | null;
}> {
  let resp: Response;

  try {
    resp = await fetch(
      OPENROUTER_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",

          "HTTP-Referer":
            "https://kissan-ai-six.vercel.app",

          "X-Title": "Kissan AI",
        },

        body: JSON.stringify({
          model: "openrouter/free",

          messages: [
            {
              role: "system",
              content:
                "You are Kissan AI's agricultural irrigation decision-support engine. Return ONLY valid JSON. Do not use markdown fences. Do not include a preamble. Do not include safety labels. Do not include commentary outside the JSON object.",
            },

            {
              role: "user",
              content: prompt,
            },
          ],

          temperature: 0.3,
        }),
      },
    );
  } catch (error) {
    console.error(
      "irrigation-advisor OpenRouter network error:",
      error instanceof Error
        ? error.message
        : error,
    );

    throw new Error(
      "OPENROUTER_ERROR",
    );
  }

  if (!resp.ok) {
    const errorText =
      await resp.text();

    console.error(
      "irrigation-advisor OpenRouter error:",
      resp.status,
      errorText.slice(0, 500),
    );

    throw new Error(
      "OPENROUTER_ERROR",
    );
  }

  const data = await resp.json();

  const model =
    typeof data?.model === "string"
      ? data.model
      : null;

  console.log(
    "irrigation-advisor OpenRouter model used:",
    model ?? "unknown",
  );

  const text =
    data?.choices?.[0]?.message
      ?.content ?? "";

  if (!text) {
    throw new Error(
      "OPENROUTER_EMPTY_RESPONSE",
    );
  }

  return {
    text,
    model,
  };
}

/* ------------------------------------------------------------------ */
/* Prompt                                                             */
/* ------------------------------------------------------------------ */

interface BuildPromptInput {
  crop: string;

  growth: {
    growthStage: string;
    stageLabel: string;
    cropAgeDays: number | null;
  };

  farm: {
    soilType: string;
    irrigationMethod: string;
    location: string;
  };

  weather: {
    temperature?: number;
    humidity?: number;
    rainProbability?: number;
    condition?: string;

    forecast?: Array<{
      rainProbability?: number;
      condition?: string;
    }>;
  } | null;

  baseStatus: string;
  baseUrgency: string;
  baseReason: string;
  rain: number;
  language: string;
}

function buildPrompt(
  input: BuildPromptInput,
): string {
  const lines: string[] = [];

  lines.push(
    "You are Kissan AI's irrigation decision-support layer for smallholder farmers in South Asia (Pakistan).",

    `Respond in: ${
      input.language === "ur"
        ? "Urdu (اردو). Keep crop names in English where helpful."
        : "English."
    }`,

    "Your ONLY task is to write a brief, safe, advisory irrigation explanation using ONLY the supplied context and the deterministic decision already made.",

    "You are advisory decision-support, NOT a replacement for a qualified agricultural professional.",
  );

  const safeAmount =
    "An exact water quantity (litres/mm per acre) cannot be reliably estimated from the available information. Follow your local irrigation practice and adjust based on soil moisture and crop conditions.";

  lines.push(
    "DECIDED OUTCOME (deterministic rules — you MUST NOT change this):",
  );

  lines.push(
    `- status: ${input.baseStatus}`,
  );

  lines.push(
    `- urgency: ${input.baseUrgency}`,
  );

  lines.push(
    `- reason: ${input.baseReason}`,
  );

  lines.push(
    "FARM CONTEXT (real saved data):",
  );

  lines.push(
    `- Crop: ${input.crop || "unavailable"}`,
  );

  lines.push(
    `- Growth stage: ${input.growth.stageLabel}${
      input.growth.cropAgeDays != null
        ? ` (crop age ${input.growth.cropAgeDays} days)`
        : ""
    }`,
  );

  lines.push(
    `- Soil type: ${
      input.farm.soilType ||
      "unavailable"
    }`,
  );

  lines.push(
    `- Irrigation method: ${
      input.farm.irrigationMethod ||
      "unavailable"
    }`,
  );

  lines.push(
    `- Location: ${
      input.farm.location ||
      "unavailable"
    }`,
  );

  if (input.weather) {
    lines.push(
      "CURRENT WEATHER (real data):",
    );

    lines.push(
      `- Temperature: ${
        input.weather.temperature ??
        "n/a"
      }°C, Humidity: ${
        input.weather.humidity ??
        "n/a"
      }%, Effective rain probability: ${
        input.rain
      }%`,
    );

    if (input.weather.condition) {
      lines.push(
        `- Condition: ${input.weather.condition}`,
      );
    }

    if (
      Array.isArray(
        input.weather.forecast,
      ) &&
      input.weather.forecast.length > 0
    ) {
      lines.push(
        `- Forecast entries available: ${input.weather.forecast.length}`,
      );
    }
  } else {
    lines.push(
      "CURRENT WEATHER: unavailable. Do not invent temperatures, rainfall, or humidity; and do not pretend soil moisture is measured.",
    );
  }

  lines.push(
    "HARD RULES (do not violate):",
  );

  lines.push(
    "- Keep the deterministic status and urgency exactly as given. Do not escalate or de-escalate.",
  );

  lines.push(
    "- Do NOT invent an exact water quantity (litres/mm/hectare). Use this exact guidance for the amount: " +
      safeAmount,
  );

  lines.push(
    "- Do not claim soil moisture is measured, dry, or wet unless a soil-moisture reading is supplied. Say 'check soil moisture before deciding'.",
  );

  lines.push(
    "- If status is 'delay', explain that rain is expected and watering should wait.",
  );

  lines.push(
    "- Respect the growth stage: flowering/fruiting stages have higher water need than maturity/harvest. Do not generalise across stages.",
  );

  lines.push(
    "- Keep the explanation concise, cautious, and grounded in the supplied context only.",
  );

  lines.push(
    "- NEVER give pesticide/fertilizer doses. If relevant, only say 'follow local agricultural guidance and the product label'.",
  );

  lines.push(
    "- Do not invent soil-moisture measurements.",
  );

  lines.push(
    "- Do not invent rainfall amounts, temperatures, humidity, crop measurements, or irrigation system specifications.",
  );

  lines.push(
    "- If information is unavailable, clearly say that it is unavailable.",
  );

  lines.push(
    "RESPOND ONLY with JSON matching this exact shape:",
  );

  lines.push(`
{
  "recommendation": "string",
  "weather_impact": "string",
  "soil_impact": "string",
  "crop_stage_impact": "string",
  "rain_adjustment": "string",
  "next_check": "string",
  "important_notes": ["string"],
  "limitations": ["string"]
}
`);

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Main handler                                                       */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  /* -------------------------------------------------------------- */
  /* CORS                                                           */
  /* -------------------------------------------------------------- */

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsForOrigin(req),
    });
  }

  /* -------------------------------------------------------------- */
  /* Method validation                                               */
  /* -------------------------------------------------------------- */

  if (req.method !== "POST") {
    return json(
      {
        success: false,
        error: "Method not allowed.",
      },
      405,
      req,
    );
  }

  /* -------------------------------------------------------------- */
  /* Lightweight Authorization sanity check                         */
  /* -------------------------------------------------------------- */

  const auth =
    req.headers.get("Authorization") ?? "";

  if (
    !auth.startsWith("Bearer ") ||
    auth.split(".").length !== 3
  ) {
    return json(
      {
        success: false,
        error:
          "This request is not authorized. Please try again.",
      },
      401,
      req,
    );
  }

  /* -------------------------------------------------------------- */
  /* Primary Gemini key                                              */
  /* -------------------------------------------------------------- */

  const apiKey =
    Deno.env.get("GEMINI_API_KEY");

  if (!apiKey) {
    return json(
      {
        success: false,
        error:
          "Kissan AI is temporarily unavailable. Please try again later.",
      },
      503,
      req,
    );
  }

  /* -------------------------------------------------------------- */
  /* Request body                                                     */
  /* -------------------------------------------------------------- */

  let body: {
    farmId?: string;

    weather?: {
      temperature?: number;
      humidity?: number;
      rainProbability?: number;
      windSpeed?: number;
      condition?: string;

      forecast?: Array<{
        rainProbability?: number;
        condition?: string;
      }>;
    } | null;

    language?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json(
      {
        success: false,
        error:
          "We couldn't read your request. Please try again.",
      },
      400,
      req,
    );
  }

  /* -------------------------------------------------------------- */
  /* Validate farm ID                                                */
  /* -------------------------------------------------------------- */

  const farmId =
    (body?.farmId ?? "").trim();

  if (!farmId) {
    return json(
      {
        success: false,
        error:
          "No farm was found. Please set up your farm first.",
      },
      400,
      req,
    );
  }

  const language = String(
    body?.language ?? "en",
  );

  /* -------------------------------------------------------------- */
  /* Supabase admin client                                           */
  /* -------------------------------------------------------------- */

  const supabaseAdmin =
    createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) ?? "",
    );

  /* -------------------------------------------------------------- */
  /* Validate caller + farm ownership                                */
  /* -------------------------------------------------------------- */

  const token =
    auth
      .slice("Bearer ".length)
      .trim();

  const { data: caller } =
    await supabaseAdmin.auth.getUser(
      token,
    );

  const callerId =
    caller?.user?.id ?? null;

  const {
    data: farmRow,
    error: farmError,
  } =
    await supabaseAdmin
      .from("farms")
      .select("*")
      .eq("id", farmId)
      .maybeSingle();

  if (farmError || !farmRow) {
    return json(
      {
        success: false,
        error:
          "We couldn't find your farm. Please try again.",
      },
      404,
      req,
    );
  }

  if (
    !callerId ||
    farmRow.user_id !== callerId
  ) {
    return json(
      {
        success: false,
        error:
          "You don't have access to this farm.",
      },
      403,
      req,
    );
  }

  /* -------------------------------------------------------------- */
  /* Extract real farm context                                      */
  /* -------------------------------------------------------------- */

  const crop =
    (farmRow.current_crop as
      | string
      | null) ?? "";

  const plantingDate =
    (farmRow.planting_date as
      | string
      | null) ?? null;

  const soilType =
    (farmRow.soil_type as
      | string
      | null) ?? "";

  const irrigationMethod =
    (farmRow.irrigation_method as
      | string
      | null) ?? "";

  const location =
    (farmRow.location as
      | string
      | null) ?? "";

  /* -------------------------------------------------------------- */
  /* Honest missing-information state                               */
  /* -------------------------------------------------------------- */

  const missing: string[] = [];

  if (!crop.trim()) {
    missing.push("Current crop");
  }

  if (!soilType.trim()) {
    missing.push("Soil type");
  }

  if (!irrigationMethod.trim()) {
    missing.push("Irrigation method");
  }

  if (missing.length > 0) {
    return json(
      {
        success: true,
        insufficientData: true,
        needsMoreInformation: true,
        missingInformation: missing,
        result: null,

        summary:
          "More information is needed about your farm before we can recommend irrigation.",

        limitations: [
          "Complete the indicated farm profile fields to get tailored irrigation advice.",
        ],
      },
      200,
      req,
    );
  }

  /* -------------------------------------------------------------- */
  /* Growth stage                                                    */
  /* -------------------------------------------------------------- */

  const growth =
    getGrowthStage(
      crop,
      plantingDate,
    );

  /* -------------------------------------------------------------- */
  /* Weather + effective rain                                        */
  /* -------------------------------------------------------------- */

  const weather =
    body.weather ?? null;

  const rain =
    effectiveRain(
      weather?.rainProbability,
      weather?.forecast,
    );

  const temp =
    typeof weather?.temperature ===
    "number"
      ? weather.temperature
      : null;

  /* -------------------------------------------------------------- */
  /* Deterministic safe decision                                     */
  /* -------------------------------------------------------------- */

  const rules =
    decideRules(
      crop,
      growth.growthStage,
      soilType,
      irrigationMethod,
      temp,
      rain,
    );

  /* -------------------------------------------------------------- */
  /* Build AI prompt                                                 */
  /* -------------------------------------------------------------- */

  const prompt =
    buildPrompt({
      crop,

      growth,

      farm: {
        soilType,
        irrigationMethod,
        location,
      },

      weather,

      baseStatus:
        rules.status,

      baseUrgency:
        rules.urgency,

      baseReason:
        rules.reason,

      rain,
      language,
    });

  /* -------------------------------------------------------------- */
  /* AI explanation                                                  */
  /*
   * Primary: Gemini
   * Fallback: OpenRouter ONLY on Gemini 429
   * -------------------------------------------------------------- */

  let ai: Record<
    string,
    unknown
  > | null = null;

  try {
    const geminiResult =
      await callGemini(
        apiKey,
        prompt,
      );

    const parsed =
      parseJsonObject(
        geminiResult.text,
      );

    if (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(parsed)
    ) {
      ai =
        parsed as Record<
          string,
          unknown
        >;
    } else {
      console.warn(
        "irrigation-advisor Gemini returned invalid JSON. Using deterministic result.",
      );

      ai = null;
    }
  } catch (error) {
    /* ------------------------------------------------------------ */
    /* Immediate OpenRouter fallback on Gemini 429                  */
    /* ------------------------------------------------------------ */

    if (
      error instanceof Error &&
      error.message ===
        "GEMINI_RATE_LIMIT"
    ) {
      console.log(
        "Gemini rate limit reached. Switching immediately to OpenRouter.",
      );

      const openRouterKey =
        Deno.env.get(
          "OPENROUTER_API_KEY",
        );

      if (openRouterKey) {
        try {
          const fallback =
            await callOpenRouter(
              openRouterKey,
              prompt,
            );

          const parsed =
            parseJsonObject(
              fallback.text,
            );

          if (
            parsed &&
            typeof parsed ===
              "object" &&
            !Array.isArray(parsed)
          ) {
            ai =
              parsed as Record<
                string,
                unknown
              >;
          } else {
            console.warn(
              "irrigation-advisor OpenRouter returned invalid JSON. Using deterministic result.",
            );

            ai = null;
          }
        } catch (
          fallbackError
        ) {
          console.error(
            "irrigation-advisor OpenRouter fallback error:",
            fallbackError instanceof
              Error
              ? fallbackError.message
              : fallbackError,
          );

          // Deterministic rules are still safe,
          // so do not fail the whole request.
          ai = null;
        }
      } else {
        console.error(
          "OPENROUTER_API_KEY is not configured. Using deterministic irrigation result.",
        );

        ai = null;
      }
    } else {
      /**
       * Non-429 Gemini failure:
       * deterministic irrigation rules remain authoritative.
       */
      console.error(
        "irrigation-advisor Gemini error:",
        error instanceof Error
          ? error.message
          : error,
      );

      ai = null;
    }
  }

  /* -------------------------------------------------------------- */
  /* Merge deterministic + AI explanation                            */
  /* -------------------------------------------------------------- */

  const merged: Record<
    string,
    unknown
  > = {
    ...(ai ?? {}),
  };

  const validatedRec =
    sanitizePayload(
      merged,
      rules,
    );

  if (!validatedRec) {
    return json(
      {
        success: false,
        error:
          "We couldn't generate irrigation advice right now. Please try again.",
      },
      502,
      req,
    );
  }

  /* -------------------------------------------------------------- */
  /* Honest limitations                                              */
  /* -------------------------------------------------------------- */

  const limitations: string[] =
    [];

  if (!weather) {
    limitations.push(
      "Live weather is currently unavailable. The recommendation is based on the other available farm information and may be less reliable.",
    );
  }

  if (
    growth.growthStage ===
    "unknown"
  ) {
    limitations.push(
      "Crop growth stage is uncertain, which may limit stage-specific guidance.",
    );
  }

  limitations.push(
    "An exact water quantity cannot be reliably estimated from the available information. Follow your local irrigation practice and adjust based on soil moisture and crop conditions.",
  );

  /* -------------------------------------------------------------- */
  /* Persist recommendation                                          */
  /* -------------------------------------------------------------- */

  const now = new Date();

  const {
    data: row,
    error: insertError,
  } =
    await supabaseAdmin
      .from(
        "irrigation_recommendations",
      )
      .insert({
        farm_id: farmId,

        recommendation: {
          status:
            validatedRec.status,

          urgency:
            validatedRec.urgency,

          recommendation:
            validatedRec.recommendation,

          timing:
            validatedRec.timing,

          water_guidance:
            validatedRec.waterGuidance,

          weather_impact:
            validatedRec.weatherImpact,

          soil_impact:
            validatedRec.soilImpact,

          crop_stage_impact:
            validatedRec.cropStageImpact,

          rain_adjustment:
            validatedRec.rainAdjustment,

          next_check:
            validatedRec.nextCheck,

          important_notes:
            validatedRec.importantNotes,

          limitations: [
            ...validatedRec.limitations,
            ...limitations,
          ],
        },

        summary:
          validatedRec.recommendation,

        limitations,

        needs_more_information:
          false,

        missing_information: [],

        created_at:
          now.toISOString(),
      })
      .select()
      .single();

  if (insertError) {
    console.error(
      "irrigation-advisor insert error:",
      insertError,
    );

    return json(
      {
        success: false,
        error:
          "We couldn't save this irrigation advice. Please try again.",
      },
      502,
      req,
    );
  }

  /* -------------------------------------------------------------- */
  /* Final response                                                  */
  /* -------------------------------------------------------------- */

  return json(
    {
      success: true,
      result: row,
      generatedAt:
        now.toISOString(),
    },
    200,
    req,
  );
});