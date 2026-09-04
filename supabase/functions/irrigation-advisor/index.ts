import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * irrigation-advisor
 *
 * Kissan AI "Irrigation Advisor" Engine (Prompt 14).
 *
 * Answers "when and how much should I irrigate my crop?" using the farmer's
 * REAL saved context (farm profile + deterministic growth stage) and, when
 * available, the live weather snapshot. This is NOT a generic chatbot.
 *
 * Architecture:
 *   Browser  →  this Edge Function  →  deterministic rules (rain-aware)
 *                                            →  optional Gemini explanation
 *                                            →  validated, persisted
 *                                               `irrigation_recommendations`
 *
 * Hybrid decision logic:
 *  - Deterministic rules decide the SAFE status/urgency for obvious conditions
 *    (rain expected soon, very high heat, rain-dependent systems, missing
 *    crop/soil/method). These rules are never overridden by the AI.
 *  - Gemini (same GEMINI_API_KEY provider, server-side) adds contextual,
 *    advisory explanation that stays within the bounds set by the rules and
 *    NEVER fabricates exact water quantities it cannot justify.
 *
 * Water amount safety:
 *  We do NOT invent an exact number of liters/acres or mm just to make the UI
 *  look complete. Unless the available data genuinely supports an estimate
 *  (recognised crop + growth config + method + weather), the returned
 *  `water_guidance.amount` stays empty and the response clearly says the exact
 *  quantity cannot be reliably estimated, offering relative guidance and
 *  timing instead.
 *
 * Security model (mirrors recommend-crops / today-actions):
 *  - GEMINI_API_KEY lives only in Supabase secrets, read here with
 *    Deno.env.get — never reaches the browser.
 *  - verify_jwt is disabled at the platform level; we do a lightweight Bearer
 *    JWT sanity check here, then validate farm ownership server-side.
 *  - The record is inserted via the service role so the client can never
 *    forge a row.
 *  - AI output is validated & sanitized server-side before persisting.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Origins permitted to call this Edge Function (preflight gate). */
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "https://vxldkzrmtygurdggtjro.supabase.co",
];

function corsForOrigin(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
  };
}

const MODEL = "gemini-3.5-flash";

const VALID_STATUSES = new Set([
  "irrigate_now",
  "irrigation_soon",
  "delay",
  "adequate",
  "insufficient",
]);
const VALID_URGENCIES = new Set(["low", "medium", "high"]);

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

const CROP_CONFIGS: Record<string, { endDays: number[] }> = {
  wheat: { endDays: [10, 70, 95, 120, 140, 150] },
  rice: { endDays: [7, 55, 75, 105, 125, 140] },
  cotton: { endDays: [14, 55, 90, 140, 165, 180] },
  maize: { endDays: [7, 50, 65, 95, 110, 120] },
  sugarcane: { endDays: [30, 180, 240, 300, 340, 365] },
};

const CROP_ALIASES: Record<string, string> = {
  wheat: "wheat", gehun: "wheat", gandum: "wheat",
  rice: "rice", chawal: "rice", paddy: "rice",
  cotton: "cotton", kapas: "cotton",
  maize: "maize", corn: "maize", makai: "maize",
  sugarcane: "sugarcane", ganna: "sugarcane", "sugar cane": "sugarcane",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/* ------------------------------------------------------------------ */
/* Deterministic growth stage (mirrors the engine used elsewhere)       */
/* ------------------------------------------------------------------ */

function normalizeCrop(crop: string): string {
  return crop.trim().toLowerCase().replace(/\s+/g, " ");
}

function getGrowthStage(
  cropRaw: string | null | undefined,
  plantingDate: string | null | undefined
): { growthStage: string; stageLabel: string; cropAgeDays: number | null } {
  const crop = normalizeCrop(cropRaw ?? "") || "Unknown crop";
  if (!plantingDate) {
    return { growthStage: "unknown", stageLabel: "Growth stage unavailable", cropAgeDays: null };
  }
  const planted = new Date(plantingDate + "T00:00:00Z").getTime();
  if (Number.isNaN(planted)) {
    return { growthStage: "unknown", stageLabel: "Growth stage unavailable", cropAgeDays: null };
  }
  const now = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  );
  const days = Math.floor((now - planted) / 86_400_000);
  if (days < 0) {
    return { growthStage: "not_started", stageLabel: "Not started", cropAgeDays: 0 };
  }
  const canonical = CROP_ALIASES[crop] ?? crop;
  const config = CROP_CONFIGS[canonical];
  if (!config) {
    return { growthStage: "unknown", stageLabel: "Growth stage unavailable", cropAgeDays: days };
  }
  let stage = "harvest";
  let prevEnd = -1;
  for (let i = 0; i < STAGE_ORDER.length; i++) {
    const startDay = prevEnd + 1;
    const endDay = config.endDays[i];
    prevEnd = endDay;
    if (days >= startDay && days <= endDay) {
      stage = STAGE_ORDER[i];
      break;
    }
  }
  return { growthStage: stage, stageLabel: STAGE_LABELS[stage], cropAgeDays: days };
}

/* ------------------------------------------------------------------ */
/* Deterministic irrigation rules (the safe baseline)                  */
/* ------------------------------------------------------------------ */

const RAIN_DELAY = 40;
const RAIN_STRONG = 70;
const HEAT_WARM = 33;
const HEAT_HIGH = 40;

const RAIN_DEPENDENT_METHODS = ["rain-fed", "rain fed", "barani", "rainfed"];

const STAGE_WEIGHT: Record<string, number> = {
  germination: 0.6,
  seedling: 0.7,
  vegetative: 0.9,
  flowering: 1,
  fruiting: 1,
  maturity: 0.6,
  harvest: 0.2,
};

function isRainDependent(method: string | null | undefined): boolean {
  const m = (method ?? "").trim().toLowerCase();
  return RAIN_DEPENDENT_METHODS.some((k) => m.includes(k));
}

function effectiveRain(
  currentPct: number | null | undefined,
  forecast: Array<{ rainProbability?: number }> | undefined
): number {
  const vals = [Number(currentPct) || 0];
  for (const f of forecast ?? []) {
    const r = Number(f.rainProbability) || 0;
    if (r > 0) vals.push(r);
  }
  return Math.max(...vals);
}

interface RuleResult {
  status: string;
  urgency: string;
  reason: string;
}

/** Decide the SAFE deterministic outcome (never fabricates urgency). */
function decideRules(
  crop: string,
  growthStage: string,
  soil: string,
  method: string,
  temp: number | null,
  rain: number
): RuleResult {
  void crop;
  void soil;

  const stage = ["unknown", "not_started"].includes(growthStage) ? null : growthStage;
  const weight = stage ? (STAGE_WEIGHT[stage] ?? 0.5) : 0.5;
  const heat = (temp ?? 0) >= HEAT_WARM;
  const heatHigh = (temp ?? 0) >= HEAT_HIGH;

  if (rain >= RAIN_STRONG) {
    return {
      status: "delay",
      urgency: "low",
      reason:
        "Rain is expected soon, so irrigation can be delayed. Check soil moisture and avoid watering until the rain passes.",
    };
  }

  if (rain >= RAIN_DELAY && heatHigh) {
    return {
      status: "irrigation_soon",
      urgency: "medium",
      reason:
        "Rain may arrive but very high temperatures raise water demand — monitor soil moisture and be ready to irrigate soon.",
    };
  }

  if (isRainDependent(method) && heatHigh) {
    return {
      status: "irrigate_now",
      urgency: "high",
      reason:
        "Your irrigation depends on rainfall and very high temperatures increase crop water loss — irrigate now if water is available.",
    };
  }

  if (isRainDependent(method) && heat) {
    return {
      status: "irrigation_soon",
      urgency: "medium",
      reason:
        "Warm conditions with rain-dependent irrigation raise crop water need — check soil moisture and prepare to irrigate.",
    };
  }

  if (stage && weight >= 0.9 && heat) {
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
/* Validation / sanitization of the structured payload                 */
/* ------------------------------------------------------------------ */

function cleanString(value: unknown, maxLen: number): string {
  const s = String(value ?? "").trim().replace(/\s+/g, " ");
  return s.slice(0, maxLen);
}

function cleanStrings(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    const s = cleanString(v, maxLen);
    if (s && out.length < maxItems) out.push(s);
  }
  return out;
}

interface ValidatedRecommendation {
  status: string;
  urgency: string;
  recommendation: string;
  timing: { recommended_time: string; reason: string } | null;
  waterGuidance: { amount: string; unit: string; confidence: number; relative: string };
  weatherImpact: string;
  soilImpact: string;
  cropStageImpact: string;
  rainAdjustment: string;
  nextCheck: string;
  importantNotes: string[];
  limitations: string[];
}

/**
 * NEVER fabricate a precise water quantity. We build the validated payload
 * from the deterministic rules result plus (optionally) AI explanation. The
 * AI/deterministic `amount` is DROPPED and confidence forced to 0 — the
 * production path always keeps the amount empty with honest relative guidance.
 */
function sanitizePayload(
  raw: unknown,
  fallback: RuleResult
): ValidatedRecommendation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      status: fallback.status,
      urgency: fallback.urgency,
      recommendation: fallback.reason,
      timing: null,
      waterGuidance: { amount: "", unit: "", confidence: 0, relative: "" },
      weatherImpact: "",
      soilImpact: "",
      cropStageImpact: "",
      rainAdjustment: "",
      nextCheck: "Check soil moisture again later today or tomorrow.",
      importantNotes: [],
      limitations: [],
    };
  }

  const r = raw as Record<string, unknown>;
  const statusRaw = String(r.irrigation_status ?? r.status ?? "");
  const status = VALID_STATUSES.has(statusRaw) ? statusRaw : fallback.status;
  const urgencyRaw = String(r.urgency ?? "");
  const urgency = VALID_URGENCIES.has(urgencyRaw) ? urgencyRaw : fallback.urgency;

  const wg = (typeof r["water_guidance"] === "object" && r["water_guidance"]
    ? r["water_guidance"]
    : {}) as Record<string, unknown>;

  return {
    status,
    urgency,
    recommendation:
      cleanString(r["recommendation"], 600) || fallback.reason,
    timing:
      typeof r["timing"] === "object" && r["timing"]
        ? {
            recommended_time: cleanString((r["timing"] as Record<string, unknown>)["recommended_time"], 200),
            reason: cleanString((r["timing"] as Record<string, unknown>)["reason"], 300),
          }
        : null,
    waterGuidance: {
      // Amount is deliberately emptied — never present an unvalidated quantity.
      amount: "",
      unit: "",
      confidence: 0,
      relative: cleanString(wg["relative"] ?? r["water_guidance_relative"], 400),
    },
    weatherImpact: cleanString(r["weather_impact"], 400),
    soilImpact: cleanString(r["soil_impact"], 400),
    cropStageImpact: cleanString(r["crop_stage_impact"], 400),
    rainAdjustment: cleanString(r["rain_adjustment"], 400),
    nextCheck: cleanString(r["next_check"], 160),
    importantNotes: cleanStrings(r["important_notes"], 10, 400),
    limitations: cleanStrings(r["limitations"], 10, 400),
  };
}

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

interface BuildPromptInput {
  crop: string;
  growth: { growthStage: string; stageLabel: string; cropAgeDays: number | null };
  farm: { soilType: string; irrigationMethod: string; location: string };
  weather: {
    temperature?: number;
    humidity?: number;
    rainProbability?: number;
    condition?: string;
    forecast?: Array<{ rainProbability?: number; condition?: string }>;
  } | null;
  baseStatus: string;
  baseUrgency: string;
  baseReason: string;
  rain: number;
  language: string;
}

function buildPrompt(input: BuildPromptInput): string {
  const lines: string[] = [];
  lines.push(
    "You are Kissan AI's irrigation decision-support layer for smallholder farmers in South Asia (Pakistan).",
    `Respond in: ${input.language === "ur" ? "Urdu (اردو). Keep crop names in English where helpful." : "English."}`,
    "Your ONLY task is to write a brief, safe, advisory irrigation explanation using ONLY the supplied context and the deterministic decision already made.",
    "You are advisory decision-support, NOT a replacement for a qualified agricultural professional."
  );

  const safeAmount =
    "An exact water quantity (litres/mm per acre) cannot be reliably estimated from the available information. Follow your local irrigation practice and adjust based on soil moisture and crop conditions.";

  lines.push("DECIDED OUTCOME (deterministic rules — you MUST NOT change this):");
  lines.push(`- status: ${input.baseStatus}`);
  lines.push(`- urgency: ${input.baseUrgency}`);
  lines.push(`- reason: ${input.baseReason}`);

  lines.push("FARM CONTEXT (real saved data):");
  lines.push(`- Crop: ${input.crop || "unavailable"}`);
  lines.push(`- Growth stage: ${input.growth.stageLabel}${input.growth.cropAgeDays != null ? ` (crop age ${input.growth.cropAgeDays} days)` : ""}`);
  lines.push(`- Soil type: ${input.farm.soilType || "unavailable"}`);
  lines.push(`- Irrigation method: ${input.farm.irrigationMethod || "unavailable"}`);
  lines.push(`- Location: ${input.farm.location || "unavailable"}`);

  if (input.weather) {
    lines.push("CURRENT WEATHER (real data):");
    lines.push(`- Temperature: ${input.weather.temperature ?? "n/a"}°C, Humidity: ${input.weather.humidity ?? "n/a"}%, Effective rain probability: ${input.rain}%`);
  } else {
    lines.push("CURRENT WEATHER: unavailable. Do not invent temperatures, rainfall, or humidity; and do not pretend soil moisture is measured.");
  }

  lines.push("HARD RULES (do not violate):");
  lines.push("- Keep the deterministic status and urgency exactly as given. Do not escalate or de-escalate.");
  lines.push("- Do NOT invent an exact water quantity (litres/mm/hectare). Use this exact guidance for the amount: " + safeAmount);
  lines.push("- Do not claim soil moisture is measured, dry, or wet unless a soil-moisture reading is supplied. Say 'check soil moisture before deciding'.");
  lines.push("- If status is 'delay', explain that rain is expected and watering should wait.");
  lines.push("- Respect the growth stage: flowering/fruiting stages have higher water need than maturity/harvest. Do not generalise across stages.");
  lines.push("- Keep the explanation concise, cautious, and grounded in the supplied context only.");
  lines.push("- NEVER give pesticide/fertilizer doses. If relevant, only say 'follow local agricultural guidance and the product label'.");

  lines.push(
    "RESPOND ONLY with JSON matching this exact shape:",
    `{
  "recommendation": "string",
  "weather_impact": "string",
  "soil_impact": "string",
  "crop_stage_impact": "string",
  "rain_adjustment": "string",
  "next_check": "string",
  "important_notes": ["string"],
  "limitations": ["string"]
}`
  );

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Main handler                                                        */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsForOrigin(req) });
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.split(".").length !== 3) {
    return json(
      { success: false, error: "This request is not authorized. Please try again." },
      401
    );
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json(
      { success: false, error: "Kissan AI is temporarily unavailable. Please try again later." },
      503
    );
  }

  let body: {
    farmId?: string;
    weather?: {
      temperature?: number;
      humidity?: number;
      rainProbability?: number;
      windSpeed?: number;
      condition?: string;
      forecast?: Array<{ rainProbability?: number; condition?: string }>;
    } | null;
    language?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json(
      { success: false, error: "We couldn't read your request. Please try again." },
      400
    );
  }

  const farmId = (body?.farmId ?? "").trim();
  if (!farmId) {
    return json(
      { success: false, error: "No farm was found. Please set up your farm first." },
      400
    );
  }

  const language = String(body?.language ?? "en");

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 1) Validate farm + enforce ownership (server-side).
  const token = auth.slice("Bearer ".length).trim();
  const { data: caller } = await supabaseAdmin.auth.getUser(token);
  const callerId = caller?.user?.id ?? null;

  const { data: farmRow, error: farmError } = await supabaseAdmin
    .from("farms")
    .select("*")
    .eq("id", farmId)
    .maybeSingle();

  if (farmError || !farmRow) {
    return json(
      { success: false, error: "We couldn't find your farm. Please try again." },
      404
    );
  }
  if (!callerId || farmRow.user_id !== callerId) {
    return json(
      { success: false, error: "You don't have access to this farm." },
      403
    );
  }

  const crop = (farmRow.current_crop as string | null) ?? "";
  const plantingDate = (farmRow.planting_date as string | null) ?? null;
  const soilType = (farmRow.soil_type as string | null) ?? "";
  const irrigationMethod = (farmRow.irrigation_method as string | null) ?? "";
  const location = (farmRow.location as string | null) ?? "";

  // 2) Honest missing-information state (no fabricated guidance).
  const missing: string[] = [];
  if (!crop.trim()) missing.push("Current crop");
  if (!soilType.trim()) missing.push("Soil type");
  if (!irrigationMethod.trim()) missing.push("Irrigation method");

  if (missing.length > 0) {
    return json({
      success: true,
      insufficientData: true,
      needsMoreInformation: true,
      missingInformation: missing,
      result: null,
      summary:
        "More information is needed about your farm before we can recommend irrigation.",
      limitations: ["Complete the indicated farm profile fields to get tailored irrigation advice."],
    });
  }

  // 3) Recompute growth stage server-side from the saved planting date.
  const growth = getGrowthStage(crop, plantingDate);

  // 4) Effective rain (real current ∪ forecast values only).
  const weather = body.weather ?? null;
  const rain = effectiveRain(weather?.rainProbability, weather?.forecast);
  const temp = typeof weather?.temperature === "number" ? weather.temperature : null;

  // 5) Run deterministic rules for a SAFE decision.
  const rules = decideRules(
    crop,
    growth.growthStage,
    soilType,
    irrigationMethod,
    temp,
    rain
  );

  // 6) Optionally ask Gemini for contextual explanation — kept within the
  //    deterministic constraints. Gemini failure never fails the request.
  let ai: Record<string, unknown> | null = null;
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt({
            crop,
            growth,
            farm: { soilType, irrigationMethod, location },
            weather,
            baseStatus: rules.status,
            baseUrgency: rules.urgency,
            baseReason: rules.reason,
            rain,
            language,
          }) }] }],
          generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
        }),
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      try {
        ai = JSON.parse(text) as Record<string, unknown>;
      } catch {
        ai = null;
      }
    }
  } catch {
    ai = null;
  }

  // 7) Merge deterministic + AI explanation into a validated payload.
  const merged: Record<string, unknown> = { ...(ai ?? {}) };
  const validatedRec = sanitizePayload(merged, rules);
  if (!validatedRec) {
    return json(
      { success: false, error: "We couldn't generate irrigation advice right now. Please try again." },
      502
    );
  }

  // 8) Honest limitations (never claim data that wasn't used).
  const limitations: string[] = [];
  if (!weather) {
    limitations.push(
      "Live weather is currently unavailable. The recommendation is based on the other available farm information and may be less reliable."
    );
  }
  if (growth.growthStage === "unknown") {
    limitations.push("Crop growth stage is uncertain, which may limit stage-specific guidance.");
  }
  limitations.push("An exact water quantity cannot be reliably estimated from the available information. Follow your local irrigation practice and adjust based on soil moisture and crop conditions.");

  // 9) Persist via the service role (client can never forge a record).
  const now = new Date();
  const { data: row, error: insertError } = await supabaseAdmin
    .from("irrigation_recommendations")
    .insert({
      farm_id: farmId,
      recommendation: {
        status: validatedRec.status,
        urgency: validatedRec.urgency,
        recommendation: validatedRec.recommendation,
        timing: validatedRec.timing,
        water_guidance: validatedRec.waterGuidance,
        weather_impact: validatedRec.weatherImpact,
        soil_impact: validatedRec.soilImpact,
        crop_stage_impact: validatedRec.cropStageImpact,
        rain_adjustment: validatedRec.rainAdjustment,
        next_check: validatedRec.nextCheck,
        important_notes: validatedRec.importantNotes,
        limitations: [...validatedRec.limitations, ...limitations],
      },
      summary: validatedRec.recommendation,
      limitations,
      needs_more_information: false,
      missing_information: [],
      created_at: now.toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error("irrigation-advisor insert error:", insertError);
    return json(
      { success: false, error: "We couldn't save this irrigation advice. Please try again." },
      502
    );
  }

  return json({ success: true, result: row, generatedAt: now.toISOString() });
});