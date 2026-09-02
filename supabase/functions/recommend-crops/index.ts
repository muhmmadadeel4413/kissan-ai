import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * recommend-crops
 *
 * Kissan AI "Smart Crop Recommendation" Engine (Prompt 13).
 *
 * Architecture:
 *   Browser  →  this Edge Function  →  Gemini (agricultural suitability layer)
 *                                          →  validated, persisted `crop_recommendations`
 *
 * This is NOT a generic crop list. It consumes the farmer's real, saved context
 * (farm profile, growth stage, current weather snapshot when available) and asks
 * Gemini to recommend a small set (3–5) of crops suited to THIS farm, with
 * suitability + separate confidence + reasons grounded in the supplied context.
 *
 * Security model (mirrors today-actions / assess-risks / analyze-crop):
 *  - GEMINI_API_KEY lives only in Supabase secrets, read here with
 *    Deno.env.get — never reaches the browser.
 *  - verify_jwt is disabled at the platform level (anon-based app); we do a
 *    lightweight Bearer JWT sanity check here, same as other functions.
 *  - The farm is validated server-side and ownership is enforced. Results are
 *    inserted via the service role so the client can never forge a record.
 *  - AI output is validated & sanitized server-side before persisting/returning.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-3.6-flash";
const MAX_RECOMMENDATIONS = 5;
const MIN_RECOMMENDATIONS = 1;

const VALID_SUITABILITY = new Set(["high", "moderate", "low"]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/* ------------------------------------------------------------------ */
/* Validation / sanitization of AI output (server-side, strict)        */
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

/**
 * Parse + validate the structured Gemini reply.
 * - Coerces suitability into one of high/moderate/load.
 * - Clamps confidence to 0–100.
 * - Drops items without a crop name or "why" reason.
 * - Caps at MAX_RECOMMENDATIONS and requires at least MIN.
 * - Returns null if the overall payload is unusable.
 */
function sanitizePayload(raw: unknown): ValidatedPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.recommendations)) return null;

  const recommendations: ValidatedRecommendation[] = [];
  for (const item of r.recommendations) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break;
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;

    const crop = cleanString(it.crop, 120);
    if (!crop) continue;

    const whySuitable = cleanString(it.why_suitable ?? it.reason, 600);
    if (!whySuitable) continue;

    const suitabilityRaw = String(it.suitability ?? "");
    const suitability = VALID_SUITABILITY.has(suitabilityRaw)
      ? (suitabilityRaw as ValidatedRecommendation["suitability"])
      : "moderate";

    const confidence = Math.max(
      0,
      Math.min(100, Math.round(Number(it.confidence) || 0))
    );

    recommendations.push({
      crop,
      suitability,
      confidence,
      whySuitable,
      soilFit: cleanString(it.soil_fit, 400),
      waterRequirement: cleanString(it.water_requirement, 400),
      weatherFit: cleanString(it.weather_fit, 400),
      keyConsiderations: cleanStrings(it.key_considerations, 8, 300),
    });
  }

  if (recommendations.length < MIN_RECOMMENDATIONS) return null;

  const limitationStrs = cleanStrings(r.limitations, 10, 400);
  const missing = cleanStrings(r.missing_information, 12, 200);

  return {
    recommendations,
    summary: cleanString(r.summary, 600),
    limitations: limitationStrs,
    needsMoreInformation: r.needs_more_information === true,
    missingInformation: missing,
  };
}

/* ------------------------------------------------------------------ */
/* Deterministic growth stage (mirrors today-actions engine)            */
/* ------------------------------------------------------------------ */

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
/* Recommendation prompt                                               */
/* ------------------------------------------------------------------ */

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
  growth: { growthStage: string; stageLabel: string; cropAgeDays: number | null };
  weather: {
    temperature?: number;
    humidity?: number;
    rainProbability?: number;
    windSpeed?: number;
    condition?: string;
    forecast?: Array<{ date?: string; condition?: string; temperatureMax?: number; rainProbability?: number }>;
  } | null;
  recentDiagnoses: Array<{
    diagnosis: string;
    severity: string;
    confidence: number;
    createdAt: string;
  }>;
  language: string;
}

function buildRecommendationPrompt(input: RecommendationInput): string {
  const lines: string[] = [];

  lines.push(
    "You are Kissan AI's agricultural decision-support system for smallholder farmers in South Asia (Pakistan).",
    `Respond in the following language: ${input.language === "ur" ? "Urdu (اردو). Keep the crop names in English where helpful, but the explanations and labels in Urdu." : "English."}`,
    "Your ONLY task is to recommend a small set of crops that MAY be suitable for THIS farm, using ONLY the supplied farm context.",
    "You are advisory decision-support, NOT a replacement for a qualified agricultural professional, and never a guarantee of yield or profit."
  );

  lines.push("RULES:");
  lines.push("- Return 3 to 5 recommendations maximum. Quality over quantity — never pad the list.");
  lines.push("- Suitability is ESTIMATED suitability, not certainty. Never claim guaranteed yield, profit, success, or disease resistance.");
  lines.push("- Base every recommendation on the supplied soil, irrigation, weather, location, and farm context. If a fact is not supplied, do not invent it.");
  lines.push("- Explain WHY each crop is recommended using the farmer's actual context (soil compatibility, water availability under their irrigation method, local weather, farm characteristics). Avoid generic paragraphs identical for every farmer.");
  lines.push("- Consider suitability for the farmer's conditions — not just crop popularity.");
  lines.push("- Each recommendation needs: crop, suitability (high|moderate|low), confidence (0-100 integer), why_suitable, soil_fit, water_requirement, weather_fit, key_considerations (a short list).");
  lines.push("- Confidence is the AI's self-assessed confidence in the recommendation, shown separately from suitability.");
  lines.push("- If the current crop is already well-suited, you may still include it; otherwise include crops appropriate to the season/conditions. Avoid repeating forced suggestions.");
  lines.push("- NEVER give chemical/pesticide doses or application instructions. If relevant, only say 'follow local agricultural guidance and the product label'.");
  lines.push("- Be honest about missing information: if soil type, irrigation, location, or weather are missing/unknown and affect the recommendation, note them in missing_information and set needs_more_information true. Never fabricate values like a fake temperature or rainfall.");
  lines.push("- Use cautious, advisory language throughout (e.g. 'may be suitable', 'based on the available farm information', 'consider local agricultural advice before major planting decisions').");
  lines.push("- Keep limitations and recommendations advisory — never present outcomes as guaranteed.");

  lines.push("FARM CONTEXT (real saved data):");
  lines.push(`- Farm location: ${input.farm.location ?? "unavailable"}`);
  lines.push(`- Land area: ${input.farm.landArea ?? "unavailable"}`);
  lines.push(`- Soil type: ${input.farm.soilType ?? "unavailable"}`);
  lines.push(`- Irrigation method: ${input.farm.irrigationMethod ?? "unavailable"}`);
  lines.push(`- Crop: ${input.farm.crop ?? "unavailable"}${input.farm.variety ? ` (${input.farm.variety})` : ""}`);
  lines.push(`- Planting date: ${input.farm.plantingDate ?? "unavailable"}`);
  lines.push(`- Growth stage: ${input.growth.stageLabel}${input.growth.cropAgeDays != null ? ` (crop age ${input.growth.cropAgeDays} days)` : ""}`);

  if (input.weather) {
    const w = input.weather;
    lines.push("CURRENT WEATHER (real data, when live):");
    lines.push(`- Temperature: ${w.temperature ?? "n/a"}°C, Humidity: ${w.humidity ?? "n/a"}%, Rain probability: ${w.rainProbability ?? "n/a"}%, Wind: ${w.windSpeed ?? "n/a"} km/h, Condition: ${w.condition ?? "n/a"}`);
    if (Array.isArray(w.forecast) && w.forecast.length > 0) {
      const tomorrow = w.forecast[0];
      lines.push(`- Tomorrow: ${tomorrow.condition ?? "n/a"}, max ${tomorrow.temperatureMax ?? "n/a"}°C, rain ${tomorrow.rainProbability ?? "n/a"}%`);
    }
  } else {
    lines.push("CURRENT WEATHER: unavailable. Do not invent temperatures, rainfall, or humidity. Recommendations must not rely on fake weather values; base them only on the other available farm information.");
  }

  if (input.recentDiagnoses.length > 0) {
    lines.push("RECENT CROP DIAGNOSES (real, from the AI Crop Doctor):");
    for (const d of input.recentDiagnoses.slice(0, 3)) {
      lines.push(`- ${d.diagnosis} (severity ${d.severity}, confidence ${d.confidence}%, ${d.createdAt})`);
    }
  } else {
    lines.push("RECENT CROP DIAGNOSES: none available.");
  }

  lines.push(
    "RESPOND ONLY with JSON matching this exact shape:",
    `{
  "recommendations": [
    {
      "crop": "string",
      "suitability": "high" | "moderate" | "low",
      "confidence": 0-100 integer,
      "why_suitable": "string",
      "soil_fit": "string",
      "water_requirement": "string",
      "weather_fit": "string",
      "key_considerations": ["string", "string"]
    }
  ],
  "summary": "string",
  "limitations": ["string"],
  "needs_more_information": false,
  "missing_information": []
}`
  );

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Main handler                                                        */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
      {
        success: false,
        error: "Kissan AI is temporarily unavailable. Please try again later.",
      },
      503
    );
  }

  let body: { farmId?: string; weather?: RecommendationInput["weather"] | null; language?: string };
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

  // 1) Validate the farm exists (server-side) + enforce ownership.
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

  // 2) Missing info honest state — the core required context is absent.
  const missingRequired: string[] = [];
  const location = (farmRow.location as string | null) ?? "";
  const soilType = (farmRow.soil_type as string | null) ?? "";
  const irrigation = (farmRow.irrigation_method as string | null) ?? "";
  if (!location.trim()) missingRequired.push("Farm location");
  if (!soilType.trim()) missingRequired.push("Soil type");
  if (!irrigation.trim()) missingRequired.push("Irrigation method");

  if (missingRequired.length > 0) {
    return json({
      success: true,
      insufficientData: true,
      needsMoreInformation: true,
      missingInformation: missingRequired,
      recommendations: [],
      summary:
        "We need a little more information about your farm to recommend crops that may suit it.",
      limitations: ["Complete the indicated farm profile fields to get tailored crop recommendations."],
      language,
    });
  }

  // 3) Load real recent diagnoses (service role).
  const { data: diagnosisRows, error: diagError } = await supabaseAdmin
    .from("diagnoses")
    .select("diagnosis, severity, confidence, created_at")
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (diagError) {
    console.error("recommend-crops diagnoses error:", diagError);
    return json(
      { success: false, error: "We couldn't generate crop recommendations right now. Please try again." },
      502
    );
  }

  // 4) Recompute growth stage server-side from the saved planting date.
  const growth = getGrowthStage(crop, plantingDate);

  // 5) Build the recommendation input using only real data.
  const input: RecommendationInput = {
    farm: {
      location,
      landArea: (farmRow.land_area as string | null) ?? undefined,
      soilType,
      irrigationMethod: irrigation,
      crop,
      variety: (farmRow.current_crop_variety as string | null) ?? null,
      plantingDate,
    },
    growth,
    weather: body.weather ?? null,
    recentDiagnoses: ((diagnosisRows as Array<{ diagnosis: string; severity: string; confidence: number; created_at: string }>) ?? []).map(
      (d) => ({
        diagnosis: d.diagnosis,
        severity: d.severity,
        confidence: d.confidence ?? 0,
        createdAt: d.created_at,
      })
    ),
    language,
  };

  // 6) Call Gemini with a forced structured JSON response.
  const prompt = buildRecommendationPrompt(input);

  let geminiResp: Response;
  try {
    geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                summary: { type: "STRING" },
                recommendations: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      crop: { type: "STRING" },
                      suitability: { type: "STRING", enum: ["high", "moderate", "low"] },
                      confidence: { type: "INTEGER" },
                      why_suitable: { type: "STRING" },
                      soil_fit: { type: "STRING" },
                      water_requirement: { type: "STRING" },
                      weather_fit: { type: "STRING" },
                      key_considerations: { type: "ARRAY", items: { type: "STRING" } },
                    },
                    required: ["crop", "suitability", "confidence", "why_suitable"],
                  },
                },
                limitations: { type: "ARRAY", items: { type: "STRING" } },
                needs_more_information: { type: "BOOLEAN" },
                missing_information: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["recommendations"],
            },
          },
        }),
      }
    );
  } catch {
    return json(
      { success: false, error: "Kissan AI is temporarily unavailable. Please try again." },
      502
    );
  }

  if (!geminiResp.ok) {
    const errText = await geminiResp.text();
    console.error("recommend-crops Gemini error:", geminiResp.status, errText.slice(0, 300));
    return json(
      { success: false, error: "Kissan AI is temporarily unavailable. Please try again." },
      502
    );
  }

  const geminiData = await geminiResp.json();
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let payload: ValidatedPayload | null = null;
  try {
    payload = sanitizePayload(JSON.parse(text));
  } catch {
    payload = null;
  }

  if (!payload) {
    console.error("recommend-crops parse failure. Raw:", text.slice(0, 500));
    return json(
      {
        success: false,
        error: "We couldn't generate crop recommendations right now. Please try again.",
      },
      502
    );
  }

  // 7) Honest limitations — never pretend unavailable data was used.
  const limitations: string[] = [...payload.limitations];
  if (!body.weather) {
    limitations.push(
      "Weather information is currently unavailable, so recommendations are based on the other available farm information."
    );
  }
  if (growth.growthStage === "unknown") {
    limitations.push("Crop growth stage is uncertain, which may limit season-specific guidance.");
  }

  // 8) Persist via the service role (client can never forge a record).
  const now = new Date();
  const { data: row, error: insertError } = await supabaseAdmin
    .from("crop_recommendations")
    .insert({
      farm_id: farmId,
      recommendations: payload.recommendations.map((r) => ({
        crop: r.crop,
        suitability: r.suitability,
        confidence: r.confidence,
        why_suitable: r.whySuitable,
        soil_fit: r.soilFit,
        water_requirement: r.waterRequirement,
        weather_fit: r.weatherFit,
        key_considerations: r.keyConsiderations,
      })),
      summary: payload.summary,
      limitations,
      needs_more_information: payload.needsMoreInformation,
      missing_information: payload.missingInformation,
      created_at: now.toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error("recommend-crops insert error:", insertError);
    return json(
      { success: false, error: "We couldn't save your recommendations right now. Please try again." },
      502
    );
  }

  return json({ success: true, result: row, generatedAt: now.toISOString() });
});