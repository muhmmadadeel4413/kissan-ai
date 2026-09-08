import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * recommend-crops
 *
 * Kissan AI Smart Crop Recommendation Engine.
 *
 * Flow:
 * Browser
 *   ↓
 * recommend-crops
 *   ↓
 * Gemini
 *   ↓ 429 / quota
 * OpenRouter → openrouter/free
 *   ↓
 * validate → persist → return
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

const MODEL = "gemini-3.5-flash";

const MAX_RECOMMENDATIONS = 5;
const MIN_RECOMMENDATIONS = 1;

const VALID_SUITABILITY = new Set([
  "high",
  "moderate",
  "low",
]);

/* ------------------------------------------------------------------
 * Gemini
 * ------------------------------------------------------------------ */

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

/**
 * Single Gemini attempt.
 *
 * 429 is NOT retried.
 * It immediately throws GEMINI_RATE_LIMIT so the caller
 * can switch to OpenRouter.
 */
async function callGemini(
  apiKey: string,
  body: Record<string, unknown>,
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
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error(
      "Gemini network error:",
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
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "";

    if (!text) {
      throw new Error(
        "Kissan AI couldn't form a reply.",
      );
    }

    return {
      text: String(text).trim(),
    };
  }

  const errText = await resp.text();

  console.error(
    "Gemini error:",
    resp.status,
    errText.slice(0, 1000),
  );

  /**
   * IMPORTANT:
   * No retry on 429.
   * Immediately switch to OpenRouter.
   */
  if (resp.status === 429) {
    const error = new Error(
      "Gemini rate limit exceeded",
    );

    error.name = "GEMINI_RATE_LIMIT";

    throw error;
  }

  throw new Error(
    "Kissan AI is temporarily unavailable. Please try again.",
  );
}

/* ------------------------------------------------------------------
 * OpenRouter fallback
 * ------------------------------------------------------------------ */

async function callOpenRouter(
  apiKey: string,
  body: {
    systemPrompt: string;
    userMessage: string;
  },
): Promise<{ text: string }> {
  let response: Response;

  try {
    response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer":
            "https://kissan-ai-six.vercel.app",
          "X-Title": "Kissan AI",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "system",
              content: `${body.systemPrompt}

IMPORTANT OUTPUT RULES:

- Return ONLY one valid JSON object.
- Do NOT use markdown code fences.
- Do NOT write any text before or after the JSON.
- Do NOT write safety messages, analysis, explanations, or metadata outside the JSON.
- The JSON must contain a "recommendations" array.
- Each recommendation must contain:
  crop,
  suitability,
  confidence,
  why_suitable,
  soil_fit,
  water_requirement,
  weather_fit,
  key_considerations.
- Also include:
  summary,
  limitations,
  needs_more_information,
  missing_information.`,
            },
            {
              role: "user",
              content: body.userMessage,
            },
          ],
          temperature: 0.2,
        }),
      },
    );
  } catch (error) {
    console.error(
      "OpenRouter network error:",
      error instanceof Error
        ? error.message
        : error,
    );

    throw new Error(
      "OpenRouter fallback failed.",
    );
  }

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "OpenRouter error:",
      response.status,
      errorText.slice(0, 1000),
    );

    throw new Error(
      "OpenRouter fallback failed.",
    );
  }

  const data = await response.json();

  console.log(
    "OpenRouter selected model:",
    data?.model ?? "unknown",
  );

  const text =
    data?.choices?.[0]?.message?.content ??
    "";

  console.log(
    "OpenRouter raw response:",
    String(text).slice(0, 2000),
  );

  if (!text) {
    throw new Error(
      "OpenRouter returned an empty response.",
    );
  }

  return {
    text: String(text).trim(),
  };
}

/* ------------------------------------------------------------------
 * Validation / sanitization
 * ------------------------------------------------------------------ */

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

    if (s && out.length < maxItems) {
      out.push(s);
    }
  }

  return out;
}

interface ValidatedRecommendation {
  crop: string;
  suitability: "high" | "moderate" | "low";
  confidence: number;
  whySuitable: string;
  soilFit: string;
  waterRequirement: string;
  weatherFit: string;
  keyConsiderations: string[];
}

interface ValidatedPayload {
  recommendations: ValidatedRecommendation[];
  summary: string;
  limitations: string[];
  needsMoreInformation: boolean;
  missingInformation: string[];
}

function sanitizePayload(
  raw: unknown,
): ValidatedPayload | null {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  ) {
    return null;
  }

  const r =
    raw as Record<string, unknown>;

  if (!Array.isArray(r.recommendations)) {
    return null;
  }

  const recommendations:
    ValidatedRecommendation[] = [];

  for (const item of r.recommendations) {
    if (
      recommendations.length >=
      MAX_RECOMMENDATIONS
    ) {
      break;
    }

    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      continue;
    }

    const it =
      item as Record<string, unknown>;

    const crop =
      cleanString(it.crop, 120);

    if (!crop) {
      continue;
    }

    const whySuitable =
      cleanString(
        it.why_suitable ??
          it.reason,
        600,
      );

    if (!whySuitable) {
      continue;
    }

    const suitabilityRaw =
      String(
        it.suitability ?? "",
      )
        .trim()
        .toLowerCase();

    const suitability =
      VALID_SUITABILITY.has(
        suitabilityRaw,
      )
        ? (
            suitabilityRaw as
              ValidatedRecommendation["suitability"]
          )
        : "moderate";

    const confidenceNumber =
      Number(it.confidence);

    const confidence =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(
            Number.isFinite(
              confidenceNumber,
            )
              ? confidenceNumber
              : 0,
          ),
        ),
      );

    recommendations.push({
      crop,
      suitability,
      confidence,
      whySuitable,
      soilFit: cleanString(
        it.soil_fit,
        400,
      ),
      waterRequirement:
        cleanString(
          it.water_requirement,
          400,
        ),
      weatherFit:
        cleanString(
          it.weather_fit,
          400,
        ),
      keyConsiderations:
        cleanStrings(
          it.key_considerations,
          8,
          300,
        ),
    });
  }

  if (
    recommendations.length <
    MIN_RECOMMENDATIONS
  ) {
    return null;
  }

  return {
    recommendations,
    summary: cleanString(
      r.summary,
      600,
    ),
    limitations:
      cleanStrings(
        r.limitations,
        10,
        400,
      ),
    needsMoreInformation:
      r.needs_more_information === true,
    missingInformation:
      cleanStrings(
        r.missing_information,
        12,
        200,
      ),
  };
}

/* ------------------------------------------------------------------
 * Robust JSON extraction
 * ------------------------------------------------------------------ */

function extractJson(
  raw: string,
): unknown | null {
  if (!raw) {
    return null;
  }

  let text = raw.trim();

  /**
   * Remove markdown JSON fences.
   */
  text = text
    .replace(
      /^```json\s*/i,
      "",
    )
    .replace(
      /^```\s*/i,
      "",
    )
    .replace(
      /\s*```$/i,
      "",
    )
    .trim();

  /**
   * First try the complete response.
   */
  try {
    return JSON.parse(text);
  } catch {
    // Continue.
  }

  /**
   * Some models may add text around JSON.
   * Extract the first complete-looking JSON object.
   */
  const firstBrace =
    text.indexOf("{");

  const lastBrace =
    text.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    const candidate =
      text.slice(
        firstBrace,
        lastBrace + 1,
      );

    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  return null;
}

/* ------------------------------------------------------------------
 * Growth stage
 * ------------------------------------------------------------------ */

const STAGE_LABELS: Record<
  string,
  string
> = {
  germination:
    "Germination / Emergence",
  vegetative:
    "Vegetative",
  flowering:
    "Flowering",
  fruiting:
    "Fruiting / Reproductive",
  maturity:
    "Maturity",
  harvest:
    "Harvest / Ready",
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
    endDays: [
      10,
      70,
      95,
      120,
      140,
      150,
    ],
  },
  rice: {
    endDays: [
      7,
      55,
      75,
      105,
      125,
      140,
    ],
  },
  cotton: {
    endDays: [
      14,
      55,
      90,
      140,
      165,
      180,
    ],
  },
  maize: {
    endDays: [
      7,
      50,
      65,
      95,
      110,
      120,
    ],
  },
  sugarcane: {
    endDays: [
      30,
      180,
      240,
      300,
      340,
      365,
    ],
  },
};

const CROP_ALIASES: Record<
  string,
  string
> = {
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

function normalizeCrop(
  crop: string,
): string {
  return crop
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getGrowthStage(
  cropRaw:
    | string
    | null
    | undefined,
  plantingDate:
    | string
    | null
    | undefined,
): {
  growthStage: string;
  stageLabel: string;
  cropAgeDays: number | null;
} {
  const crop =
    normalizeCrop(
      cropRaw ?? "",
    ) || "Unknown crop";

  if (!plantingDate) {
    return {
      growthStage: "unknown",
      stageLabel:
        "Growth stage unavailable",
      cropAgeDays: null,
    };
  }

  const planted =
    new Date(
      `${plantingDate}T00:00:00Z`,
    ).getTime();

  if (Number.isNaN(planted)) {
    return {
      growthStage: "unknown",
      stageLabel:
        "Growth stage unavailable",
      cropAgeDays: null,
    };
  }

  const now =
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    );

  const days =
    Math.floor(
      (now - planted) /
        86_400_000,
    );

  if (days < 0) {
    return {
      growthStage:
        "not_started",
      stageLabel:
        "Not started",
      cropAgeDays: 0,
    };
  }

  const canonical =
    CROP_ALIASES[crop] ??
    crop;

  const config =
    CROP_CONFIGS[
      canonical
    ];

  if (!config) {
    return {
      growthStage: "unknown",
      stageLabel:
        "Growth stage unavailable",
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
    const startDay =
      prevEnd + 1;

    const endDay =
      config.endDays[i];

    prevEnd = endDay;

    if (
      days >= startDay &&
      days <= endDay
    ) {
      stage =
        STAGE_ORDER[i];
      break;
    }
  }

  return {
    growthStage:
      stage,
    stageLabel:
      STAGE_LABELS[stage] ??
      "Growth stage unavailable",
    cropAgeDays:
      days,
  };
}

/* ------------------------------------------------------------------
 * Recommendation input
 * ------------------------------------------------------------------ */

interface RecommendationInput {
  farm: {
    location?: string;
    landArea?: string;
    soilType?: string;
    irrigationMethod?: string;
    crop?: string;
    variety?: string | null;
    plantingDate?: string | null;
  };

  growth: {
    growthStage: string;
    stageLabel: string;
    cropAgeDays: number | null;
  };

  weather: {
    temperature?: number;
    humidity?: number;
    rainProbability?: number;
    windSpeed?: number;
    condition?: string;
    forecast?: Array<{
      date?: string;
      condition?: string;
      temperatureMax?: number;
      rainProbability?: number;
    }>;
  } | null;

  recentDiagnoses: Array<{
    diagnosis: string;
    severity: string;
    confidence: number;
    createdAt: string;
  }>;

  language: string;
}

/* ------------------------------------------------------------------
 * Recommendation prompt
 * ------------------------------------------------------------------ */

function buildRecommendationPrompt(
  input: RecommendationInput,
): string {
  const lines: string[] = [];

  lines.push(
    "You are Kissan AI's agricultural decision-support system for smallholder farmers in South Asia (Pakistan).",

    `Respond in the following language: ${
      input.language === "ur"
        ? "Urdu (اردو). Keep crop names in English where helpful, but explanations and labels in Urdu."
        : "English."
    }`,

    "Your ONLY task is to recommend a small set of crops that MAY be suitable for THIS farm, using ONLY the supplied farm context.",

    "You are advisory decision-support, NOT a replacement for a qualified agricultural professional, and never a guarantee of yield or profit.",
  );

  lines.push(
    "RULES:",
  );

  lines.push(
    "- Return 3 to 5 recommendations maximum. Quality over quantity — never pad the list.",

    "- Suitability is ESTIMATED suitability, not certainty. Never claim guaranteed yield, profit, success, or disease resistance.",

    "- Base every recommendation on the supplied soil, irrigation, weather, location, and farm context. If a fact is not supplied, do not invent it.",

    "- Explain WHY each crop is recommended using the farmer's actual context.",

    "- Consider suitability for the farmer's conditions — not just crop popularity.",

    "- Each recommendation needs: crop, suitability (high|moderate|low), confidence (0-100 integer), why_suitable, soil_fit, water_requirement, weather_fit, key_considerations.",

    "- Confidence is the AI's self-assessed confidence in the recommendation, shown separately from suitability.",

    "- NEVER give chemical/pesticide doses or application instructions.",

    "- Be honest about missing information. Never fabricate temperature, rainfall, humidity, or other farm data.",

    "- Use cautious advisory language such as 'may be suitable' and 'based on the available farm information'.",

    "- RESPOND WITH JSON ONLY. Do not include markdown or extra text.",
  );

  lines.push(
    "FARM CONTEXT (real saved data):",
  );

  lines.push(
    `- Farm location: ${
      input.farm.location ??
      "unavailable"
    }`,
  );

  lines.push(
    `- Land area: ${
      input.farm.landArea ??
      "unavailable"
    }`,
  );

  lines.push(
    `- Soil type: ${
      input.farm.soilType ??
      "unavailable"
    }`,
  );

  lines.push(
    `- Irrigation method: ${
      input.farm.irrigationMethod ??
      "unavailable"
    }`,
  );

  lines.push(
    `- Current crop: ${
      input.farm.crop ??
      "unavailable"
    }${
      input.farm.variety
        ? ` (${input.farm.variety})`
        : ""
    }`,
  );

  lines.push(
    `- Planting date: ${
      input.farm.plantingDate ??
      "unavailable"
    }`,
  );

  lines.push(
    `- Growth stage: ${
      input.growth.stageLabel
    }${
      input.growth.cropAgeDays !=
      null
        ? ` (crop age ${input.growth.cropAgeDays} days)`
        : ""
    }`,
  );

  if (input.weather) {
    const w =
      input.weather;

    lines.push(
      "CURRENT WEATHER (real data, when live):",
    );

    lines.push(
      `- Temperature: ${
        w.temperature ??
        "n/a"
      }°C, Humidity: ${
        w.humidity ??
        "n/a"
      }%, Rain probability: ${
        w.rainProbability ??
        "n/a"
      }%, Wind: ${
        w.windSpeed ??
        "n/a"
      } km/h, Condition: ${
        w.condition ??
        "n/a"
      }`,
    );

    if (
      Array.isArray(
        w.forecast,
      ) &&
      w.forecast.length > 0
    ) {
      const tomorrow =
        w.forecast[0];

      lines.push(
        `- Tomorrow: ${
          tomorrow.condition ??
          "n/a"
        }, max ${
          tomorrow.temperatureMax ??
          "n/a"
        }°C, rain ${
          tomorrow.rainProbability ??
          "n/a"
        }%`,
      );
    }
  } else {
    lines.push(
      "CURRENT WEATHER: unavailable. Do not invent temperatures, rainfall, or humidity.",
    );
  }

  if (
    input.recentDiagnoses
      .length > 0
  ) {
    lines.push(
      "RECENT CROP DIAGNOSES:",
    );

    for (
      const d of input.recentDiagnoses.slice(
        0,
        3,
      )
    ) {
      lines.push(
        `- ${d.diagnosis} (severity ${d.severity}, confidence ${d.confidence}%, ${d.createdAt})`,
      );
    }
  } else {
    lines.push(
      "RECENT CROP DIAGNOSES: none available.",
    );
  }

  lines.push(
    "REQUIRED JSON SHAPE:",
    `{
  "recommendations": [
    {
      "crop": "string",
      "suitability": "high",
      "confidence": 80,
      "why_suitable": "string",
      "soil_fit": "string",
      "water_requirement": "string",
      "weather_fit": "string",
      "key_considerations": ["string"]
    }
  ],
  "summary": "string",
  "limitations": ["string"],
  "needs_more_information": false,
  "missing_information": []
}`,
  );

  return lines.join("\n");
}

/* ------------------------------------------------------------------
 * Main handler
 * ------------------------------------------------------------------ */

Deno.serve(
  async (req: Request) => {
    /* CORS */

    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: corsForOrigin(req),
      });
    }

    /* Method validation */

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

    /* JWT sanity check */

    const auth =
      req.headers.get(
        "Authorization",
      ) ?? "";

    const token =
      auth
        .slice(
          "Bearer ".length,
        )
        .trim();

    if (
      !auth.startsWith(
        "Bearer ",
      ) ||
      token.split(".").length !== 3
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

    /* API keys */

    const geminiApiKey =
      Deno.env.get(
        "GEMINI_API_KEY",
      );

    if (!geminiApiKey) {
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

    /* Parse request */

    let body: {
      farmId?: string;
      weather?:
        | RecommendationInput["weather"]
        | null;
      language?: string;
    };

    try {
      body =
        await req.json();
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

    const farmId =
      String(
        body?.farmId ?? "",
      ).trim();

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

    const language =
      String(
        body?.language ?? "en",
      ).trim() || "en";

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      ) ?? "";

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) ?? "";

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      console.error(
        "Supabase environment variables are not configured.",
      );

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

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
      );

    /* --------------------------------------------------------------
     * 1. Validate caller
     * -------------------------------------------------------------- */

    const {
      data: caller,
      error: authError,
    } =
      await supabaseAdmin.auth.getUser(
        token,
      );

    if (authError) {
      console.error(
        "recommend-crops auth error:",
        authError,
      );

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

    const callerId =
      caller?.user?.id ?? null;

    if (!callerId) {
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

    /* --------------------------------------------------------------
     * 2. Validate farm + ownership
     * -------------------------------------------------------------- */

    const {
      data: farmRow,
      error: farmError,
    } =
      await supabaseAdmin
        .from("farms")
        .select("*")
        .eq(
          "id",
          farmId,
        )
        .maybeSingle();

    if (farmError) {
      console.error(
        "recommend-crops farm lookup error:",
        farmError,
      );

      return json(
        {
          success: false,
          error:
            "We couldn't load your farm. Please try again.",
        },
        502,
        req,
      );
    }

    if (!farmRow) {
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
      farmRow.user_id !==
      callerId
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

    /* --------------------------------------------------------------
     * 3. Extract farm data
     * -------------------------------------------------------------- */

    const crop =
      (farmRow.current_crop as
        | string
        | null) ?? "";

    const plantingDate =
      (farmRow.planting_date as
        | string
        | null) ?? null;

    const location =
      (farmRow.location as
        | string
        | null) ?? "";

    const soilType =
      (farmRow.soil_type as
        | string
        | null) ?? "";

    const irrigation =
      (farmRow.irrigation_method as
        | string
        | null) ?? "";

    /* --------------------------------------------------------------
     * 4. Missing required information
     * -------------------------------------------------------------- */

    const missingRequired: string[] =
      [];

    if (!location.trim()) {
      missingRequired.push(
        "Farm location",
      );
    }

    if (!soilType.trim()) {
      missingRequired.push(
        "Soil type",
      );
    }

    if (!irrigation.trim()) {
      missingRequired.push(
        "Irrigation method",
      );
    }

    if (
      missingRequired.length >
      0
    ) {
      return json(
        {
          success: true,
          insufficientData:
            true,
          needsMoreInformation:
            true,
          missingInformation:
            missingRequired,
          recommendations: [],
          summary:
            "We need a little more information about your farm to recommend crops that may suit it.",
          limitations: [
            "Complete the indicated farm profile fields to get tailored crop recommendations.",
          ],
          language,
        },
        200,
        req,
      );
    }

    /* --------------------------------------------------------------
     * 5. Recent diagnoses
     * -------------------------------------------------------------- */

    const {
      data: diagnosisRows,
      error: diagError,
    } =
      await supabaseAdmin
        .from("diagnoses")
        .select(
          "diagnosis, severity, confidence, created_at",
        )
        .eq(
          "farm_id",
          farmId,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(5);

    if (diagError) {
      console.error(
        "recommend-crops diagnoses error:",
        diagError,
      );

      return json(
        {
          success: false,
          error:
            "We couldn't generate crop recommendations right now. Please try again.",
        },
        502,
        req,
      );
    }

    /* --------------------------------------------------------------
     * 6. Growth stage
     * -------------------------------------------------------------- */

    const growth =
      getGrowthStage(
        crop,
        plantingDate,
      );

    /* --------------------------------------------------------------
     * 7. Build recommendation input
     * -------------------------------------------------------------- */

    const input:
      RecommendationInput = {
      farm: {
        location,
        landArea:
          (farmRow.land_area as
            | string
            | null) ??
          undefined,
        soilType,
        irrigationMethod:
          irrigation,
        crop,
        variety:
          (farmRow.current_crop_variety as
            | string
            | null) ??
          null,
        plantingDate,
      },

      growth,

      weather:
        body.weather ??
        null,

      recentDiagnoses:
        (
          (diagnosisRows as Array<{
            diagnosis: string;
            severity: string;
            confidence: number;
            created_at: string;
          }>) ?? []
        ).map((d) => ({
          diagnosis:
            d.diagnosis,
          severity:
            d.severity,
          confidence:
            Number.isFinite(
              Number(d.confidence),
            )
              ? Number(d.confidence)
              : 0,
          createdAt:
            d.created_at,
        })),

      language,
    };

    /* --------------------------------------------------------------
     * 8. Build prompt
     * -------------------------------------------------------------- */

    const prompt =
      buildRecommendationPrompt(
        input,
      );

    const userMessage =
      "Generate the crop recommendations now.";

    /* --------------------------------------------------------------
     * 9. Gemini → OpenRouter fallback
     * -------------------------------------------------------------- */

    let aiText = "";

    try {
      const result =
        await callGemini(
          geminiApiKey,
          {
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
              temperature: 0.4,
              responseMimeType:
                "application/json",

              responseSchema: {
                type: "OBJECT",

                properties: {
                  summary: {
                    type: "STRING",
                  },

                  recommendations: {
                    type: "ARRAY",

                    items: {
                      type: "OBJECT",

                      properties: {
                        crop: {
                          type: "STRING",
                        },

                        suitability: {
                          type: "STRING",
                          enum: [
                            "high",
                            "moderate",
                            "low",
                          ],
                        },

                        confidence: {
                          type: "INTEGER",
                        },

                        why_suitable: {
                          type: "STRING",
                        },

                        soil_fit: {
                          type: "STRING",
                        },

                        water_requirement: {
                          type: "STRING",
                        },

                        weather_fit: {
                          type: "STRING",
                        },

                        key_considerations: {
                          type: "ARRAY",
                          items: {
                            type: "STRING",
                          },
                        },
                      },

                      required: [
                        "crop",
                        "suitability",
                        "confidence",
                        "why_suitable",
                      ],
                    },
                  },

                  limitations: {
                    type: "ARRAY",
                    items: {
                      type: "STRING",
                    },
                  },

                  needs_more_information: {
                    type: "BOOLEAN",
                  },

                  missing_information: {
                    type: "ARRAY",
                    items: {
                      type: "STRING",
                    },
                  },
                },

                required: [
                  "recommendations",
                ],
              },
            },
          },
        );

      aiText =
        result.text;

      console.log(
        "AI provider: Gemini",
      );
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error(
              String(err),
            );

      /**
       * Gemini 429:
       * immediately use OpenRouter.
       */
      if (
        error.name ===
        "GEMINI_RATE_LIMIT"
      ) {
        console.log(
          "Gemini 429 detected. Switching immediately to OpenRouter.",
        );

        const openRouterKey =
          Deno.env.get(
            "OPENROUTER_API_KEY",
          );

        if (!openRouterKey) {
          console.error(
            "OPENROUTER_API_KEY is not configured.",
          );

          return json(
            {
              success: false,
              error:
                "AI fallback service is not configured.",
            },
            502,
            req,
          );
        }

        try {
          const result =
            await callOpenRouter(
              openRouterKey,
              {
                systemPrompt:
                  prompt,
                userMessage:
                  userMessage,
              },
            );

          aiText =
            result.text;

          console.log(
            "AI provider: OpenRouter fallback",
          );
        } catch (
          openRouterError
        ) {
          console.error(
            "OpenRouter fallback failed:",
            openRouterError,
          );

          return json(
            {
              success: false,
              error:
                "Kissan AI is temporarily unavailable. Please try again.",
            },
            502,
            req,
          );
        }
      } else {
        console.error(
          "recommend-crops Gemini error:",
          error,
        );

        return json(
          {
            success: false,
            error:
              "Kissan AI is temporarily unavailable. Please try again.",
          },
          502,
          req,
        );
      }
    }

    /* --------------------------------------------------------------
     * 10. Parse + validate AI response
     * -------------------------------------------------------------- */

    console.log(
      "Final AI raw response:",
      aiText.slice(0, 2000),
    );

    const rawParsed =
      extractJson(
        aiText,
      );

    const payload =
      sanitizePayload(
        rawParsed,
      );

    if (!payload) {
      console.error(
        "recommend-crops parse failure. Raw:",
        aiText.slice(
          0,
          2000,
        ),
      );

      return json(
        {
          success: false,
          error:
            "We couldn't generate crop recommendations right now. Please try again.",
        },
        502,
        req,
      );
    }

    /* --------------------------------------------------------------
     * 11. Honest limitations
     * -------------------------------------------------------------- */

    const limitations: string[] =
      [
        ...payload.limitations,
      ];

    if (!body.weather) {
      limitations.push(
        "Weather information is currently unavailable, so recommendations are based on the other available farm information.",
      );
    }

    if (
      growth.growthStage ===
      "unknown"
    ) {
      limitations.push(
        "Crop growth stage is uncertain, which may limit season-specific guidance.",
      );
    }

    const uniqueLimitations =
      [
        ...new Set(
          limitations,
        ),
      ];

    /* --------------------------------------------------------------
     * 12. Persist recommendation
     * -------------------------------------------------------------- */

    const now =
      new Date();

    const {
      data: row,
      error: insertError,
    } =
      await supabaseAdmin
        .from(
          "crop_recommendations",
        )
        .insert({
          farm_id:
            farmId,

          recommendations:
            payload.recommendations.map(
              (r) => ({
                crop:
                  r.crop,

                suitability:
                  r.suitability,

                confidence:
                  r.confidence,

                why_suitable:
                  r.whySuitable,

                soil_fit:
                  r.soilFit,

                water_requirement:
                  r.waterRequirement,

                weather_fit:
                  r.weatherFit,

                key_considerations:
                  r.keyConsiderations,
              }),
            ),

          summary:
            payload.summary,

          limitations:
            uniqueLimitations,

          needs_more_information:
            payload.needsMoreInformation,

          missing_information:
            payload.missingInformation,

          created_at:
            now.toISOString(),
        })
        .select()
        .single();

    if (insertError) {
      console.error(
        "recommend-crops insert error:",
        insertError,
      );

      return json(
        {
          success: false,
          error:
            "We couldn't save your recommendations right now. Please try again.",
        },
        502,
        req,
      );
    }

    /* --------------------------------------------------------------
     * 13. Return
     * -------------------------------------------------------------- */

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
  },
);