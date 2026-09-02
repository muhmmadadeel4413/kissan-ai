import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * assess-risks
 *
 * Farm Risk Engine (Prompt 8) — server-authoritative hybrid assessment.
 *
 * Architecture:
 *   Browser  →  this Edge Function  →  deterministic rules (+ optional Gemini)
 *                                        →  persisted `risk_alerts`
 *
 * What happens here:
 *   1. Validate the farm exists (service role) — never trust a client-supplied
 *      farm ID blindly.
 *   2. Load REAL farm + recent diagnoses from the database (service role).
 *   3. Recompute the growth stage from the saved planting date (mirrors the
 *      Prompt 3 growth engine; kept in sync manually).
 *   4. Run the deterministic rule engine (documented thresholds in this file).
 *   5. If there are meaningful (medium/high) signals AND Gemini is configured,
 *      ask Gemini to refine farmer-friendly explanations/actions. Deterministic
 *      levels are NEVER overridden by the AI.
 *   6. Persist the active risks via the service role; previous active rows are
 *      marked `expired` (history is never deleted). Clients can never inject
 *      arbitrary risk records.
 *
 * Security: Gemini key lives only in Supabase secrets (GEMINI_API_KEY). No
 * secret reaches the browser. verify_jwt is disabled at the platform level
 * (anon-based app) — we do a lightweight Bearer JWT sanity check, matching the
 * other functions.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-3.6-flash";
/** Risk alerts are considered current for this long before being re-run. */
const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_RISKS = 5;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/* ------------------------------------------------------------------ */
/* Deterministic growth stage (mirrors Prompt 3's engine)              */
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
/* Deterministic risk rules (mirrors src/lib/risk-engine.ts)           */
/* ------------------------------------------------------------------ */

type RiskCategory = "disease" | "pest" | "weather" | "irrigation" | "crop_stress";
type RiskLevel = "low" | "medium" | "high";

interface RiskSignal {
  category: RiskCategory;
  level: RiskLevel;
  score: number;
  title: string;
  explanation: string;
  evidence: string[];
  recommendedActions: string[];
  source: string;
}

const THRESHOLDS = {
  heatHigh: 42,
  heatMedium: 38,
  heatWarm: 33,
  humidityHigh: 85,
  humidityMedium: 70,
  rainHigh: 70,
  rainMedium: 40,
  windHigh: 40,
  windMedium: 25,
  humidityDry: 30,
  recentDiagnosisDays: 14,
  oldDiagnosisDays: 30,
  sensitiveStages: ["flowering", "fruiting", "germination", "seedling"],
} as const;

function scoreToLevel(score: number): RiskLevel {
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

const PEST_KEYWORDS = [
  "pest", "insect", "aphid", "whitefly", "jassid", "bollworm", "thrips",
  "mite", "mites", "caterpillar", "locust", "armyworm", "mealybug", "sucking",
  "leafhopper", "weevil", "borer", "sawfly",
];

const DISEASE_KEYWORDS = [
  "blight", "rust", "mildew", "wilt", "fungus", "fungal", "bacterial", "virus",
  "viral", "leaf spot", "leafspot", "smut", "rot", "scorch", "mosaic",
  "yellow vein", "curl", "nematode", "powdery", "downy",
];

function daysSince(iso: string): number | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function recencyWeight(days: number): number {
  if (days <= THRESHOLDS.recentDiagnosisDays) return 1;
  if (days <= THRESHOLDS.oldDiagnosisDays) return 0.5;
  return 0.25;
}

function confidenceWeight(confidence: number): number {
  if (confidence >= 85) return 1;
  if (confidence >= 60) return 0.75;
  return 0.5;
}

interface EngineInput {
  farm: {
    currentCrop: string;
    irrigationMethod?: string;
  } | null;
  growth: { growthStage: string; stageLabel: string } | null;
  weather: {
    temperature: number;
    humidity: number;
    rainProbability: number;
    windSpeed: number;
    forecast?: Array<{ rainProbability?: number }>;
  } | null;
  recentDiagnoses: Array<{
    diagnosis: string;
    confidence: number;
    createdAt: string;
  }>;
}

function evaluateRiskSignals(input: EngineInput): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const w = input.weather;
  const growth = input.growth;
  const sensitive = growth
    ? THRESHOLDS.sensitiveStages.includes(growth.growthStage)
    : false;

  /* Weather */
  if (w) {
    const { temperature, humidity, rainProbability, windSpeed } = w;
    const forecastRain = Math.max(
      rainProbability,
      ...(w.forecast ?? []).map((f) => f.rainProbability ?? 0)
    );

    if (temperature >= THRESHOLDS.heatHigh) {
      signals.push({
        category: "weather", level: "high", score: 4 + (sensitive ? 1 : 0),
        title: "Extreme heat risk",
        explanation:
          "Very high temperatures may cause heat stress — leaves can wilt, flowers may drop, and the crop loses water faster than it can take it up.",
        evidence: [`Current temperature is ${temperature}°C (≥ ${THRESHOLDS.heatHigh}°C).`],
        recommendedActions: [
          "Irrigate early morning or late evening to reduce water loss.",
          "Provide light shade to young plants if practical.",
          "Avoid spraying or transplanting during the hottest hours.",
        ],
        source: "weather",
      });
    } else if (temperature >= THRESHOLDS.heatMedium) {
      signals.push({
        category: "weather", level: "medium", score: 3 + (sensitive ? 1 : 0),
        title: "High heat risk",
        explanation:
          "High temperatures may increase heat stress and water demand for the crop.",
        evidence: [`Current temperature is ${temperature}°C.`],
        recommendedActions: [
          "Water early or late in the day; check young plants for wilting.",
          "Keep an eye on soil moisture and mulch to hold water.",
        ],
        source: "weather",
      });
    } else if (temperature >= THRESHOLDS.heatWarm) {
      signals.push({
        category: "weather", level: "low", score: 1,
        title: "Warm conditions",
        explanation:
          "Warm conditions are manageable but slightly increase water demand.",
        evidence: [`Current temperature is ${temperature}°C.`],
        recommendedActions: ["Monitor soil moisture and irrigate young crops if the topsoil is dry."],
        source: "weather",
      });
    }

    if (forecastRain >= THRESHOLDS.rainHigh) {
      signals.push({
        category: "weather", level: "high", score: 4,
        title: "Heavy rain / waterlogging risk",
        explanation:
          "High chance of heavy rain may cause waterlogging, especially in low-lying fields or heavy soils, which can suffocate roots.",
        evidence: [`Rain probability is up to ${forecastRain}%.`],
        recommendedActions: [
          "Ensure drainage channels are clear before heavy rain.",
          "Avoid irrigation while rain is expected.",
          "Check low-lying areas for standing water after rain.",
        ],
        source: "weather",
      });
    } else if (forecastRain >= THRESHOLDS.rainMedium) {
      signals.push({
        category: "weather", level: "medium", score: 2,
        title: "Rain possible — waterlogging watch",
        explanation:
          "A moderate chance of rain means fields may get wet; low-lying areas are at some risk of waterlogging.",
        evidence: [`Rain probability is up to ${forecastRain}%.`],
        recommendedActions: ["Delay watering until rain passes; watch low-lying fields."],
        source: "weather",
      });
    }

    if (humidity >= THRESHOLDS.humidityHigh) {
      signals.push({
        category: "disease", level: "high", score: 4 + (temperature >= THRESHOLDS.heatMedium ? 1 : 0),
        title: "High humidity — disease conditions",
        explanation:
          "Warm, very humid air may increase the risk of fungal diseases like blight and mildew. This is a conditions warning, not a diagnosis.",
        evidence: [`Humidity is ${humidity}% (≥ ${THRESHOLDS.humidityHigh}%).`],
        recommendedActions: [
          "Check leaves for spots or powdery growth.",
          "Improve airflow between rows where possible.",
          "If spots appear, have a Crop Doctor photo check done before treating.",
        ],
        source: "weather",
      });
    } else if (humidity >= THRESHOLDS.humidityMedium) {
      signals.push({
        category: "disease", level: "medium", score: 2,
        title: "Humid conditions — disease watch",
        explanation:
          "Moderate humidity may slightly increase the risk of fungal problems if it stays damp for a couple of days.",
        evidence: [`Humidity is ${humidity}%.`],
        recommendedActions: ["Watch leaves for spots; avoid dense, wet foliage overnight."],
        source: "weather",
      });
    }

    if (windSpeed >= THRESHOLDS.windHigh) {
      signals.push({
        category: "weather", level: "high", score: 3,
        title: "Strong wind risk",
        explanation:
          "Strong winds may damage young or tall plants and cause spray drift if any treatment is applied.",
        evidence: [`Wind is ${windSpeed} km/h (≥ ${THRESHOLDS.windHigh} km/h).`],
        recommendedActions: [
          "Do not spray pesticides or fertiliser in strong wind.",
          "Support young or tall plants; shelter sensitive crops if possible.",
        ],
        source: "weather",
      });
    } else if (windSpeed >= THRESHOLDS.windMedium) {
      signals.push({
        category: "weather", level: "medium", score: 2,
        title: "Breezy conditions",
        explanation: "Moderate winds can cause spray drift and stress young plants.",
        evidence: [`Wind is ${windSpeed} km/h.`],
        recommendedActions: ["Skip spraying today; check young plants are supported."],
        source: "weather",
      });
    }
  }

  /* Recent diagnoses */
  for (const d of input.recentDiagnoses.slice(0, 5)) {
    const days = daysSince(d.createdAt);
    const recency = days === null ? 0.5 : recencyWeight(days);
    const confidence = confidenceWeight(d.confidence);
    const lower = d.diagnosis.toLowerCase();
    const pest = PEST_KEYWORDS.some((k) => lower.includes(k));
    const disease = DISEASE_KEYWORDS.some((k) => lower.includes(k));

    if (pest) {
      const score = Math.round(3 * recency * confidence) + (sensitive ? 1 : 0);
      if (score > 0) {
        signals.push({
          category: "pest", level: scoreToLevel(score), score,
          title: "Elevated pest pressure",
          explanation:
            "A recent crop check found a pest problem. Combined with the current growth stage, pest pressure may remain elevated and deserves monitoring.",
          evidence: [
            `Recent diagnosis: ${d.diagnosis} (confidence ${d.confidence}%).`,
            days !== null ? `Diagnosis was ${days} day(s) ago.` : "Diagnosis date unavailable.",
            sensitive ? "Crop is in a sensitive growth stage." : null,
          ].filter(Boolean) as string[],
          recommendedActions: [
            "Inspect plants regularly for live pests and new damage.",
            "Follow the product label and local agricultural guidance if you treat — do not mix or dose on your own.",
            "Ask the Crop Doctor or a local agriculture officer if the problem is spreading.",
          ],
          source: "diagnosis",
        });
      }
    }

    if (disease) {
      const humidityBoost = w && w.humidity >= THRESHOLDS.humidityMedium ? 1 : 0;
      const score = Math.round(3 * recency * confidence) + humidityBoost;
      if (score > 0) {
        signals.push({
          category: "disease", level: scoreToLevel(score), score,
          title: "Elevated disease risk",
          explanation:
            "A recent crop check found a disease. Current conditions (and humidity if elevated) may keep disease risk elevated — monitor closely rather than assume.",
          evidence: [
            `Recent diagnosis: ${d.diagnosis} (confidence ${d.confidence}%).`,
            w && w.humidity >= THRESHOLDS.humidityMedium
              ? `Humidity is ${w.humidity}%, which may favour disease spread.`
              : null,
          ].filter(Boolean) as string[],
          recommendedActions: [
            "Watch for new or spreading spots/lesions on leaves.",
            "Follow the product label and local agricultural guidance if you treat.",
            "Consult a local agriculture officer if symptoms are worsening.",
          ],
          source: "diagnosis",
        });
      }
    }
  }

  /* Irrigation (only with sufficient farm + weather context) */
  const method = input.farm?.irrigationMethod?.toLowerCase() ?? "";
  const rainDependent = /rain|barani|rainfed|rain-fed/i.test(method);
  if (w && input.farm?.currentCrop) {
    if (rainDependent && w.rainProbability < THRESHOLDS.rainMedium && w.temperature >= THRESHOLDS.heatMedium) {
      signals.push({
        category: "irrigation", level: "medium", score: 3,
        title: "Possible water stress",
        explanation:
          "Your irrigation depends on rainfall and conditions are hot with little rain expected — the crop may face water stress.",
        evidence: [
          `Irrigation method: ${input.farm.irrigationMethod}.`,
          `Temperature ${w.temperature}°C with only ${w.rainProbability}% chance of rain.`,
        ],
        recommendedActions: [
          "Check soil moisture at root depth before watering.",
          "If water is available, irrigate early or late in the day.",
        ],
        source: "farm",
      });
    }
    if (w.rainProbability >= THRESHOLDS.rainHigh) {
      signals.push({
        category: "irrigation", level: "medium", score: 2,
        title: "Excess moisture watch",
        explanation:
          "Heavy rain is expected; fields may hold too much water, especially in heavy soil.",
        evidence: [`Rain probability is ${w.rainProbability}%.`],
        recommendedActions: ["Clear drainage channels; avoid further irrigation before rain."],
        source: "weather",
      });
    }
  }

  /* General crop stress */
  if (w && growth) {
    const sensitiveStage = THRESHOLDS.sensitiveStages.includes(growth.growthStage);
    const hot = w.temperature >= THRESHOLDS.heatWarm;
    const dry = w.humidity < THRESHOLDS.humidityDry;
    const littleRain = w.rainProbability < THRESHOLDS.rainMedium;
    if (hot && dry && littleRain) {
      signals.push({
        category: "crop_stress", level: sensitiveStage ? "high" : "medium",
        score: sensitiveStage ? 4 : 3,
        title: "Environmental crop stress",
        explanation:
          "Hot, dry conditions with little rain may stress the crop, especially in a sensitive growth stage.",
        evidence: [
          `Temperature ${w.temperature}°C, humidity ${w.humidity}%, rain ${w.rainProbability}%.`,
          `Current stage: ${growth.stageLabel}.`,
        ],
        recommendedActions: [
          "Water early or late to keep the root zone moist.",
          "Mulch around plants to reduce evaporation.",
          "Monitor young plants for wilting.",
        ],
        source: "weather",
      });
    }
  }

  // Keep the strongest signal per category, then prioritise by evidence score.
  const byCategory = new Map<RiskCategory, RiskSignal>();
  for (const s of signals) {
    const existing = byCategory.get(s.category);
    if (!existing || s.score > existing.score) byCategory.set(s.category, s);
  }
  return [...byCategory.values()].sort((a, b) => b.score - a.score).slice(0, MAX_RISKS);
}

/* ------------------------------------------------------------------ */
/* Optional Gemini enrichment (explanation + actions only)             */
/* ------------------------------------------------------------------ */

interface AiRiskRefinement {
  category: RiskCategory;
  explanation: string;
  recommendedActions: string[];
}

function sanitizeAiRefinements(raw: unknown): AiRiskRefinement[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const list = Array.isArray(r.risks) ? r.risks : [];
  const out: AiRiskRefinement[] = [];
  const valid = new Set(["disease", "pest", "weather", "irrigation", "crop_stress"]);
  for (const item of list.slice(0, MAX_RISKS)) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const category = String(it.category ?? "");
    if (!valid.has(category)) continue;
    out.push({
      category: category as RiskCategory,
      explanation: String(it.explanation ?? "").slice(0, 800) || "",
      recommendedActions: Array.isArray(it.recommendedActions)
        ? it.recommendedActions.map((a) => String(a)).slice(0, 5)
        : [],
    });
  }
  return out;
}

async function enrichWithGemini(
  apiKey: string,
  signals: RiskSignal[],
  context: Record<string, unknown>
): Promise<AiRiskRefinement[]> {
  const prompt = `You are an agricultural risk explainer for smallholder farmers in South Asia (Pakistan).

Below is a deterministic risk assessment computed from real farm data, weather, and recent diagnoses. The risk levels are already decided by safety rules and MUST NOT be changed. Your job is only to:
- write a clear, cautious, farmer-friendly explanation for each risk (advisory, never "definitely has X"),
- suggest safe, practical next steps (never invent pesticide dosages; if treatment is mentioned, say to follow the product label and local agricultural guidance),
- keep explanations honest about uncertainty.

Context (real data):
${JSON.stringify(context, null, 2)}

Respond ONLY with JSON:
{
  "risks": [
    {
      "category": "one of: disease, pest, weather, irrigation, crop_stress",
      "explanation": "2-3 sentences, cautious, farmer-friendly",
      "recommendedActions": ["action 1", "action 2", "action 3"]
    }
  ]
}
Do not include risks outside the provided list. Do not claim a diagnosis with certainty.`;

  const geminiResp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              risks: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    category: { type: "STRING", enum: ["disease", "pest", "weather", "irrigation", "crop_stress"] },
                    explanation: { type: "STRING" },
                    recommendedActions: { type: "ARRAY", items: { type: "STRING" } },
                  },
                  required: ["category", "explanation", "recommendedActions"],
                },
              },
            },
            required: ["risks"],
          },
        },
      }),
    }
  );

  if (!geminiResp.ok) {
    const errText = await geminiResp.text();
    console.error("assess-risks Gemini error:", geminiResp.status, errText.slice(0, 300));
    return [];
  }

  const geminiData = await geminiResp.json();
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  try {
    return sanitizeAiRefinements(JSON.parse(text));
  } catch {
    console.error("assess-risks Gemini parse failure. Raw:", text.slice(0, 500));
    return [];
  }
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

  let body: {
    farmId?: string;
    weather?: EngineInput["weather"] | null;
    growth?: { growthStage?: string; stageLabel?: string } | null;
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

  const token = auth.slice("Bearer ".length).trim();

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 1) Validate the farm exists (server-side) and load its owner.
  const { data: farmRow, error: farmError } = await supabaseAdmin
    .from("farms")
    .select("id, user_id, current_crop, planting_date, irrigation_method")
    .eq("id", farmId)
    .maybeSingle();

  if (farmError || !farmRow) {
    return json(
      { success: false, error: "We couldn't find your farm. Please try again." },
      404
    );
  }

  // 1b) Ownership: only the authenticated owner of the farm may run an
  // assessment. Resolve the caller from the client JWT and compare it to the
  // farm's owner. Never trusts the client-supplied farmId as authorization.
  const { data: caller, error: callerError } = await supabaseAdmin.auth.getUser(token);
  const callerId = caller?.user?.id ?? null;
  if (callerError || !callerId || farmRow.user_id !== callerId) {
    return json(
      { success: false, error: "You don't have access to that farm." },
      403
    );
  }

  // 2) Load recent diagnoses (real saved data).
  const { data: diagnosisRows, error: diagError } = await supabaseAdmin
    .from("diagnoses")
    .select("diagnosis, confidence, created_at")
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (diagError) {
    console.error("assess-risks diagnoses error:", diagError);
    return json(
      { success: false, error: "We couldn't update your farm risk assessment right now. Please try again." },
      502
    );
  }

  // 3) Recompute growth stage server-side from saved planting date.
  const growth = getGrowthStage(
    farmRow.current_crop ?? "",
    (farmRow.planting_date as string | null) ?? undefined
  );

  // 4) Run the deterministic engine.
  const input: EngineInput = {
    farm: {
      currentCrop: farmRow.current_crop ?? "",
      irrigationMethod: farmRow.irrigation_method ?? undefined,
    },
    growth: { growthStage: growth.growthStage, stageLabel: growth.stageLabel },
    weather: body.weather ?? null,
    recentDiagnoses: ((diagnosisRows as Array<{ diagnosis: string; confidence: number; created_at: string }>) ?? []).map(
      (d) => ({ diagnosis: d.diagnosis, confidence: d.confidence ?? 0, createdAt: d.created_at })
    ),
  };

  let signals = evaluateRiskSignals(input);

  // 5) Optional AI enrichment when meaningful risks exist and Gemini is set.
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  let usedAi = false;
  const hasMeaningful = signals.some((s) => s.level === "high" || s.level === "medium");
  if (apiKey && hasMeaningful && signals.length > 0) {
    const refinements = await enrichWithGemini(apiKey, signals, {
      farm: input.farm,
      crop: { name: input.farm?.currentCrop, plantingDate: farmRow.planting_date },
      growth: input.growth,
      weather: input.weather,
      recentDiagnoses: input.recentDiagnoses,
      ruleSignals: signals.map((s) => ({ category: s.category, level: s.level, title: s.title })),
    });
    if (refinements.length > 0) {
      usedAi = true;
      const byCat = new Map(refinements.map((r) => [r.category, r]));
      signals = signals.map((s) => {
        const refine = byCat.get(s.category);
        if (!refine) return s;
        return {
          ...s,
          explanation: refine.explanation || s.explanation,
          recommendedActions:
            refine.recommendedActions.length > 0 ? refine.recommendedActions : s.recommendedActions,
        };
      });
    }
  }

  // 6) Persist: mark previous active rows expired, insert the new set.
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACTIVE_WINDOW_MS).toISOString();

  const { error: expireError } = await supabaseAdmin
    .from("risk_alerts")
    .update({ status: "expired", updated_at: now.toISOString() })
    .eq("farm_id", farmId)
    .eq("status", "active");

  if (expireError) {
    console.error("assess-risks expire error:", expireError);
  }

  const rows = signals.map((s) => ({
    farm_id: farmId,
    risk_type: s.category,
    level: s.level,
    title: s.title,
    explanation: s.explanation,
    evidence: s.evidence,
    recommended_actions: s.recommendedActions,
    status: "active",
    source: usedAi ? "hybrid" : "deterministic",
    expires_at: expiresAt,
  }));

  let persisted: unknown[] = [];
  if (rows.length > 0) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("risk_alerts")
      .insert(rows)
      .select();

    if (insertError) {
      console.error("assess-risks insert error:", insertError);
      return json(
        { success: false, error: "We couldn't save your farm risk assessment right now. Please try again." },
        502
      );
    }
    persisted = inserted ?? [];
  }

  // 7) Limitations — honest about missing inputs (never guess).
  const limitations: string[] = [];
  if (!body.weather) limitations.push("Risk assessment is limited because current weather data is unavailable.");
  if (growth.growthStage === "unknown")
    limitations.push("Growth stage is unavailable, so crop-stage-specific risks are limited.");
  if (input.recentDiagnoses.length === 0)
    limitations.push("No recent crop diagnoses were found, so disease/pest risks are based on conditions alone.");

  return json({
    success: true,
    assessedAt: now.toISOString(),
    risks: persisted,
    limitations,
  });
});