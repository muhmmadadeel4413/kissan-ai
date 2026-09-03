import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * today-actions
 *
 * Kissan AI "What Should I Do Today?" Decision Engine (Prompt 10).
 *
 * Architecture:
 *   Browser  →  this Edge Function  →  Gemini (decision reasoning layer)
 *                                        →  persisted `action_items`
 *
 * This is NOT a generic recommendation engine. It consumes the farmer's real,
 * saved context (farm profile, growth stage, current weather snapshot, recent
 * diagnoses, active risks) and asks Gemini to produce a small set (1–4) of
 * prioritized, evidence-backed actions. Every action carries a reason and its
 * source list so the farmer can trust WHY it appears.
 *
 * Security model (mirrors assess-risks / chat-assistant):
 *  - GEMINI_API_KEY lives only in Supabase secrets, read here with
 *    Deno.env.get — never reaches the browser.
 *  - verify_jwt is disabled at the platform level (anon-based app); we do a
 *    lightweight Bearer JWT sanity check here, same as the other functions.
 *  - The farm is validated server-side via the service role. Actions are
 *    inserted/updated via the service role; the client can never inject
 *    arbitrary action rows. Old incomplete rows for the same day are replaced;
 *    completed rows are never deleted (preserved as history).
 *  - AI output is validated & sanitized server-side before persisting.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-3.6-flash";
const MAX_ACTIONS = 4;

const VALID_PRIORITIES = new Set(["low", "medium", "high"]);

const VALID_CATEGORIES = new Set([
  "crop_health",
  "weather",
  "irrigation",
  "pest",
  "disease",
  "field_inspection",
  "growth_stage",
  "farm_management",
  "harvest",
  "monitoring",
]);

const VALID_TIMINGS = new Set([
  "today",
  "this_morning",
  "this_afternoon",
  "this_evening",
  "before_rain",
  "this_week",
  "monitor",
]);

const VALID_SOURCES = new Set([
  "farm_context",
  "growth_stage",
  "weather",
  "diagnosis",
  "risk",
  "yield",
  "history",
]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/* ------------------------------------------------------------------ */
/* Resilient Gemini call (handles free-tier 429 rate limits)           */
/* ------------------------------------------------------------------ */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Call Gemini's generateContent endpoint with a bounded retry on transient
 * failures (429 rate-limit / 5xx). The free tier allows a small number of
 * requests per minute, so a quick retry smooths over momentary exhaustion.
 * Throws a dedicated error when the quota is truly exhausted so the caller
 * can reply with an honest, actionable message instead of a generic 502.
 */
async function callGemini(
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ text: string }> {
  const url = `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;
  const maxAttempts = 3;
  let lastError = "Kissan AI is temporarily unavailable. Please try again.";
  let quotaExhausted = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      lastError = "Kissan AI is temporarily unavailable. Please try again.";
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw new Error(lastError);
    }

    if (resp.ok) {
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) {
        lastError = "Kissan AI couldn't form a reply. Please try again.";
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
      }
      return { text };
    }

    const errText = await resp.text();
    console.error(`${MODEL} error (attempt ${attempt}/${maxAttempts}):`, resp.status, errText.slice(0, 300));

    if (resp.status === 429) {
      quotaExhausted = true;
      if (attempt < maxAttempts) {
        // Wait for the rate-limit window (quota errors include a retry hint).
        const waitMs = 5000 * attempt;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      break;
    }
    if (resp.status >= 500 && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    break;
  }

  if (quotaExhausted) {
    throw new Error(
      "Kissan AI is a bit busy right now — its request limit for this moment was reached. Please wait a minute and try again."
    );
  }
  throw new Error(lastError);
}

/* ------------------------------------------------------------------ */
/* Deterministic growth stage (mirrors Prompt 3 engine + assess-risks) */
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
/* Validation / sanitization of AI output (server-side, strict)        */
/* ------------------------------------------------------------------ */

interface ValidatedAction {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  category: string;
  reason: string;
  timing: string | null;
  source: string[];
}

function cleanString(value: unknown, maxLen: number): string {
  const s = String(value ?? "").trim().replace(/\s+/g, " ");
  return s.slice(0, maxLen);
}

/**
 * Parse + validate the structured Gemini reply.
 * - Rejects invalid priorities/categories/timings/sources.
 * - Drops items with empty titles, descriptions or reasons.
 * - Caps at MAX_ACTIONS (never silently displays an invalid result).
 * - Returns null if the overall payload is unusable.
 */
function sanitizeDecision(raw: unknown): { summary: string; actions: ValidatedAction[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.actions)) return null;

  const actions: ValidatedAction[] = [];
  for (const item of r.actions) {
    if (actions.length >= MAX_ACTIONS) break;
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;

    const title = cleanString(it.title, 120);
    const description = cleanString(it.description, 500);
    const reason = cleanString(it.reason, 400);
    if (!title || !description || !reason) continue;

    const priority = String(it.priority ?? "");
    if (!VALID_PRIORITIES.has(priority)) continue;

    const category = String(it.category ?? "");
    if (!VALID_CATEGORIES.has(category)) continue;

    const timingRaw = String(it.timing ?? "");
    const timing = timingRaw && VALID_TIMINGS.has(timingRaw) ? timingRaw : null;

    const source = Array.isArray(it.source)
      ? it.source.map((s) => String(s)).filter((s) => VALID_SOURCES.has(s)).slice(0, 6)
      : [];

    actions.push({ title, description, priority: priority as ValidatedAction["priority"], category, reason, timing, source });
  }

  const summary = cleanString(r.summary, 400);

  return { summary, actions };
}

/* ------------------------------------------------------------------ */
/* Decision Engine prompt                                              */
/* ------------------------------------------------------------------ */

interface DecisionInput {
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
    forecast?: Array<{ date?: string; condition?: string; temperatureMax?: number; rainProbability?: number; windSpeed?: number }>;
  } | null;
  recentDiagnoses: Array<{
    diagnosis: string;
    severity: string;
    confidence: number;
    createdAt: string;
  }>;
  risks: Array<{ riskType: string; level: string; title: string; explanation: string }>;
}

function buildDecisionPrompt(input: DecisionInput): string {
  const lines: string[] = [];

  lines.push(
    "You are Kissan AI's agricultural decision-support engine for smallholder farmers in South Asia (Pakistan).",
    "Your ONLY task is to decide what the farmer should prioritize TODAY using only the supplied farm context.",
    "You are a decision-support assistant, NOT a replacement for a qualified agricultural professional."
  );

  lines.push("RULES:");
  lines.push("- Return 1 to 4 actions maximum. Only include actions that are truly meaningful for THIS farm right now. 1 or 2 strong actions is fine — never pad to reach four.");
  lines.push("- Do NOT create filler actions. If nothing is worth doing, return an empty actions array.");
  lines.push("- Each action needs: title, description, priority, category, reason, timing, source.");
  lines.push("- priority must be exactly one of: low, medium, high. Do not mark everything high. HIGH only for a meaningful immediate concern (high crop-health/weather risk, high pest/disease risk, urgent recent diagnosis, urgent management concern). MEDIUM for important but non-urgent (routine inspection, monitoring a developing risk, weather-aware planning, growth-stage management). LOW for useful but non-urgent (record keeping, monitoring, planning, preparation).");
  lines.push("- category must be one of: crop_health, weather, irrigation, pest, disease, field_inspection, growth_stage, farm_management, harvest, monitoring.");
  lines.push("- timing must be one of: today, this_morning, this_afternoon, this_evening, before_rain, this_week, monitor. Only use a timing actually supported by the context (e.g. before_rain only if rain info exists).");
  lines.push("- source lists which context you actually used, from: farm_context, growth_stage, weather, diagnosis, risk, yield, history. Only list sources you truly used.");
  lines.push("- Do not invent missing information. No fake weather, no fake diagnosis, no fake measurements, no invented farm history. If a fact isn't in the context, don't claim it.");
  lines.push("- Do not assume a disease or pest exists unless a diagnosis or risk signal supports it. Use cautious wording ('may be related to', 'monitor for signs').");
  lines.push("- Match actions to the crop's actual growth stage. A vegetative-stage crop gets vegetative-stage actions, not flowering-stage ones.");
  lines.push("- NEVER give pesticide/fertilizer dosages, concentrations, mixing instructions, or unsupported application rates. If treatment is relevant, say 'follow the product label and local agricultural guidance' and prefer inspect/monitor/confirm first.");
  lines.push("- If a serious condition may exist, stay cautious: 'inspect the affected area today', 'if symptoms worsen, contact a local agricultural expert'.");
  lines.push("- Do not say 'your soil is dry' unless soil moisture is actually measured. Say 'check field moisture before deciding whether irrigation is needed.'");
  lines.push("- Do not recommend irrigation simply because a crop exists. Consider irrigation method, crop, growth stage, weather and rain probability.");
  lines.push("- Avoid duplicate actions that say essentially the same thing — combine them into one meaningful action.");
  lines.push("- Yield information must only be used if supplied in the context; never invent yield numbers or fertilizer advice from them.");

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
    lines.push("CURRENT WEATHER (real data):");
    lines.push(`- Temperature: ${w.temperature ?? "n/a"}°C, Humidity: ${w.humidity ?? "n/a"}%, Rain probability: ${w.rainProbability ?? "n/a"}%, Wind: ${w.windSpeed ?? "n/a"} km/h, Condition: ${w.condition ?? "n/a"}`);
    if (Array.isArray(w.forecast) && w.forecast.length > 0) {
      const tomorrow = w.forecast[0];
      lines.push(`- Tomorrow: ${tomorrow.condition ?? "n/a"}, max ${tomorrow.temperatureMax ?? "n/a"}°C, rain ${tomorrow.rainProbability ?? "n/a"}%`);
    }
  } else {
    lines.push("CURRENT WEATHER: unavailable. Do not include weather-based recommendations.");
  }

  if (input.recentDiagnoses.length > 0) {
    lines.push("RECENT CROP DIAGNOSES (real, from the AI Crop Doctor):");
    for (const d of input.recentDiagnoses.slice(0, 3)) {
      lines.push(`- ${d.diagnosis} (severity ${d.severity}, confidence ${d.confidence}%, ${d.createdAt})`);
    }
    lines.push("A diagnosis is not a forever-fact. Use it only if it is recent and relevant. Use cautious wording when its current relevance is uncertain.");
  } else {
    lines.push("RECENT CROP DIAGNOSES: none available. Do not claim the crop is disease-free; just don't invent a diagnosis.");
  }

  if (input.risks.length > 0) {
    lines.push("ACTIVE RISKS (from the farm Risk Engine, real):");
    for (const r of input.risks.slice(0, 5)) {
      lines.push(`- [${r.level}] ${r.title} (${r.riskType}): ${r.explanation}`);
    }
  } else {
    lines.push("ACTIVE RISKS: none currently flagged.");
  }

  lines.push(
    "RESPOND ONLY with JSON matching this exact shape:",
    '{ "summary": "one short sentence of overall guidance", "actions": [ { "title": "...", "description": "...", "priority": "low|medium|high", "category": "...", "reason": "...", "timing": "...", "source": ["..."] } ] }',
    "If there are no meaningful actions, return { \"summary\": \"...\", \"actions\": [] }."
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

  let body: {
    farmId?: string;
    actionDate?: string;
    weather?: DecisionInput["weather"] | null;
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

  const actionDate = /^\d{4}-\d{2}-\d{2}$/.test(body?.actionDate ?? "")
    ? body!.actionDate!
    : new Date().toISOString().slice(0, 10);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 1) Validate the farm exists (server-side).
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

  const crop = (farmRow.current_crop as string | null) ?? "";
  const plantingDate = (farmRow.planting_date as string | null) ?? null;

  // 2) Insufficient data — crop info missing → honest "complete your profile" state.
  if (!crop.trim()) {
    return json({
      success: true,
      insufficientData: true,
      actionDate,
      actions: [],
      summary:
        "More farm information is needed. Complete your farm profile and add crop information to receive personalized actions.",
      message:
        "More farm information is needed. Complete your farm profile and add crop information to receive personalized actions.",
      limitations: ["No crop is saved on this farm yet."],
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
    console.error("today-actions diagnoses error:", diagError);
    return json(
      { success: false, error: "We couldn't update today's actions right now. Please try again." },
      502
    );
  }

  // 4) Load active risk alerts (service role).
  const { data: riskRows, error: riskError } = await supabaseAdmin
    .from("risk_alerts")
    .select("risk_type, level, title, explanation")
    .eq("farm_id", farmId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(5);

  if (riskError) {
    console.error("today-actions risks error:", riskError);
    return json(
      { success: false, error: "We couldn't update today's actions right now. Please try again." },
      502
    );
  }

  // 5) Recompute growth stage server-side from the saved planting date.
  const growth = getGrowthStage(crop, plantingDate);

  // 6) Build the decision input with only real data.
  const input: DecisionInput = {
    farm: {
      location: (farmRow.location as string | null) ?? undefined,
      landArea: (farmRow.land_area as string | null) ?? undefined,
      soilType: (farmRow.soil_type as string | null) ?? undefined,
      irrigationMethod: (farmRow.irrigation_method as string | null) ?? undefined,
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
    risks: ((riskRows as Array<{ risk_type: string; level: string; title: string; explanation: string }>) ?? []).map(
      (r) => ({ riskType: r.risk_type, level: r.level, title: r.title, explanation: r.explanation })
    ),
  };

  // 7) Call Gemini with a forced structured JSON response.
  const prompt = buildDecisionPrompt(input);

  let geminiText: string;
  try {
    const result = await callGemini(apiKey, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            summary: { type: "STRING" },
            actions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  description: { type: "STRING" },
                  priority: { type: "STRING", enum: ["low", "medium", "high"] },
                  category: {
                    type: "STRING",
                    enum: [
                      "crop_health", "weather", "irrigation", "pest", "disease",
                      "field_inspection", "growth_stage", "farm_management",
                      "harvest", "monitoring",
                    ],
                  },
                  reason: { type: "STRING" },
                  timing: {
                    type: "STRING",
                    enum: [
                      "today", "this_morning", "this_afternoon", "this_evening",
                      "before_rain", "this_week", "monitor",
                    ],
                  },
                  source: {
                    type: "ARRAY",
                    items: {
                      type: "STRING",
                      enum: [
                        "farm_context", "growth_stage", "weather", "diagnosis",
                        "risk", "yield", "history",
                      ],
                    },
                  },
                },
                required: ["title", "description", "priority", "category", "reason", "timing", "source"],
              },
            },
          },
          required: ["actions"],
        },
      },
    });
    geminiText = result.text;
  } catch (err) {
    console.error("today-actions Gemini error:", err instanceof Error ? err.message : err);
    return json(
      { success: false, error: err instanceof Error ? err.message : "Kissan AI is temporarily unavailable. Please try again." },
      502
    );
  }

  let decision: { summary: string; actions: ValidatedAction[] } | null = null;
  try {
    decision = sanitizeDecision(JSON.parse(geminiText));
  } catch {
    decision = null;
  }

  if (!decision) {
    console.error("today-actions parse failure. Raw:", geminiText.slice(0, 500));
    return json(
      {
        success: false,
        error: "Kissan AI couldn't form today's actions. Please try again.",
      },
      502
    );
  }

  // 8) Persist. Replace today's incomplete rows for this farm; keep completed
  //    rows as history (never delete completed actions).
  const now = new Date();

  const { error: clearError } = await supabaseAdmin
    .from("action_items")
    .delete()
    .eq("farm_id", farmId)
    .eq("action_date", actionDate)
    .eq("completed", false);

  if (clearError) {
    console.error("today-actions clear error:", clearError);
  }

  const rows = decision.actions.map((a) => ({
    farm_id: farmId,
    action_date: actionDate,
    title: a.title,
    description: a.description,
    priority: a.priority,
    category: a.category,
    reason: a.reason,
    timing: a.timing,
    source: a.source,
    completed: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }));

  let persisted: unknown[] = [];
  if (rows.length > 0) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("action_items")
      .insert(rows)
      .select();

    if (insertError) {
      console.error("today-actions insert error:", insertError);
      return json(
        { success: false, error: "We couldn't save today's actions right now. Please try again." },
        502
      );
    }
    persisted = inserted ?? [];
  }

  // 9) Honest limitations — never pretend unavailable data was used.
  const limitations: string[] = [];
  if (!body.weather) {
    limitations.push(
      "Weather information is currently unavailable, so weather-based recommendations were not included."
    );
  }
  if (growth.growthStage === "unknown") {
    limitations.push("Growth stage is unavailable, so crop-stage-specific actions are limited.");
  }
  if (input.recentDiagnoses.length === 0) {
    limitations.push("No recent crop-health diagnosis is available.");
  }

  return json({
    success: true,
    generatedAt: now.toISOString(),
    actionDate,
    actions: persisted,
    summary: decision.summary,
    limitations,
  });
});