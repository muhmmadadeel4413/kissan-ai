import type { Level, Severity } from "../types";

/**
 * Farm Risk Engine — deterministic rule layer (Prompt 8).
 *
 * This is a PURE, dependency-free module: no Supabase, no AI. It reads real
 * farm context (crop, growth stage), real weather, and real saved diagnoses
 * and produces evidence-based risk signals.
 *
 * Design principles:
 *  - Risk is NOT diagnosis. Output is advisory ("conditions may increase the
 *    risk of…"), never "your crop definitely has X".
 *  - No invented values. Missing data yields fewer/lower signals, never fake
 *    ones. Unsupported crops / missing weather / no diagnoses are handled as
 *    "insufficient evidence".
 *  - Scoring is evidence-based. Each rule adds points; a score maps to a level
 *    (low / medium / high) via documented thresholds. We never expose the raw
 *    score to farmers — they see LOW / MEDIUM / HIGH.
 *  - Thresholds are kept in one place so they can be refined agronomically
 *    without touching the UI or the AI integration.
 *
 * The deterministic result feeds the hybrid engine (Edge Function) which may
 * ask Gemini to explain / prioritise — but deterministic safety rules are
 * never overridden by the AI.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type RiskCategory =
  | "disease"
  | "pest"
  | "weather"
  | "irrigation"
  | "crop_stress";

export type RiskSource = "weather" | "diagnosis" | "farm" | "growth";

export type RiskLevel = Level; // "low" | "medium" | "high"

/** Context the rules evaluate — mirrors real saved/derived data. */
export interface RiskEngineInput {
  farm: {
    currentCrop: string;
    location?: string;
    landArea?: string;
    soilType?: string;
    irrigationMethod?: string;
    plantingDate?: string | null;
  } | null;
  growth: {
    cropAgeDays: number | null;
    growthStage: string;
    stageLabel: string;
  } | null;
  weather: {
    temperature: number;
    humidity: number;
    rainProbability: number;
    windSpeed: number;
    condition?: string;
    forecast?: Array<{ rainProbability?: number; temperatureMax?: number }>;
  } | null;
  recentDiagnoses: Array<{
    diagnosis: string;
    severity: Severity;
    confidence: number;
    createdAt: string;
  }>;
}

/** One evidence-based risk signal produced by the rule layer. */
export interface RiskSignal {
  category: RiskCategory;
  level: RiskLevel;
  /** Internal evidence score (never shown raw to farmers). */
  score: number;
  title: string;
  explanation: string;
  evidence: string[];
  recommendedActions: string[];
  source: RiskSource;
}

/**
 * Growth stages most sensitive to environmental stress. Kept as a
 * `readonly string[]` so it can be checked against arbitrary stage labels.
 */
const SENSITIVE_STAGES: readonly string[] = [
  "flowering",
  "fruiting",
  "germination",
  "seedling",
];

/* ------------------------------------------------------------------ */
/* Documented, configurable thresholds                                 */
/* ------------------------------------------------------------------ */

export const RISK_THRESHOLDS = {
  /** °C above which heat risk is HIGH. */
  heatHigh: 42,
  /** °C above which heat risk is MEDIUM. */
  heatMedium: 38,
  /** °C above which mild heat/crop stress is considered. */
  heatWarm: 33,
  /** Relative humidity % above which fungal-risk conditions are HIGH. */
  humidityHigh: 85,
  /** Relative humidity % above which fungal-risk conditions are MEDIUM. */
  humidityMedium: 70,
  /** Rain probability % above which waterlogging risk is HIGH. */
  rainHigh: 70,
  /** Rain probability % above which rain risk is MEDIUM. */
  rainMedium: 40,
  /** Wind km/h above which wind risk is HIGH. */
  windHigh: 40,
  /** Wind km/h above which wind risk is MEDIUM. */
  windMedium: 25,
  /** Humidity % below which (with heat) drought stress is considered. */
  humidityDry: 30,
  /** Diagnoses within this many days are treated as fully recent. */
  recentDiagnosisDays: 14,
  /** Diagnoses older than this are treated as low-relevance. */
  oldDiagnosisDays: 30,
  /** Growth stages most sensitive to environmental stress. */
  sensitiveStages: SENSITIVE_STAGES,
} as const;

/** Score → level mapping (documented; see scoring below). */
export function scoreToLevel(score: number): RiskLevel {
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

/* ------------------------------------------------------------------ */
/* Keyword classifiers for diagnosis text                              */
/* ------------------------------------------------------------------ */

const PEST_KEYWORDS = [
  "pest",
  "insect",
  "aphid",
  "whitefly",
  "jassid",
  "bollworm",
  "thrips",
  "mite",
  "mites",
  "caterpillar",
  "locust",
  "armyworm",
  "mealybug",
  "sucking",
  "leafhopper",
  "weevil",
  "borer",
  "sawfly",
];

const DISEASE_KEYWORDS = [
  "blight",
  "rust",
  "mildew",
  "wilt",
  "fungus",
  "fungal",
  "bacterial",
  "virus",
  "viral",
  "leaf spot",
  "leafspot",
  "smut",
  "rot",
  "scorch",
  "mosaic",
  "yellow vein",
  "curl",
  "nematode",
  "powdery",
  "downy",
];

function classifyDiagnosisText(text: string): {
  pest: boolean;
  disease: boolean;
} {
  const lower = text.toLowerCase();
  const pest = PEST_KEYWORDS.some((k) => lower.includes(k));
  const disease = DISEASE_KEYWORDS.some((k) => lower.includes(k));
  return { pest, disease };
}

/* ------------------------------------------------------------------ */
/* Recency & confidence weighting                                      */
/* ------------------------------------------------------------------ */

function daysSince(iso: string, now: Date): number | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/**
 * Recency weight: recent diagnoses are the most relevant. Fully recent = 1,
 * decaying to 0.5 at ~2 weeks and a low 0.25 once older than a month.
 */
function recencyWeight(days: number): number {
  if (days <= RISK_THRESHOLDS.recentDiagnosisDays) return 1;
  if (days <= RISK_THRESHOLDS.oldDiagnosisDays) return 0.5;
  return 0.25;
}

/** Confidence weight: high-confidence findings count more than guesses. */
function confidenceWeight(confidence: number): number {
  if (confidence >= 85) return 1;
  if (confidence >= 60) return 0.75;
  return 0.5;
}

/* ------------------------------------------------------------------ */
/* Weather signals                                                     */
/* ------------------------------------------------------------------ */

function weatherSignals(input: RiskEngineInput): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const w = input.weather;
  if (!w) return signals;
  const { growth } = input;
  const sensitive = growth
    ? RISK_THRESHOLDS.sensitiveStages.includes(growth.growthStage)
    : false;

  const { temperature, humidity, rainProbability, windSpeed } = w;
  const forecastRain = Math.max(
    rainProbability,
    ...(w.forecast ?? []).map((f) => f.rainProbability ?? 0)
  );

  /* ------------------------------- Heat ------------------------------- */
  if (temperature >= RISK_THRESHOLDS.heatHigh) {
    signals.push({
      category: "weather",
      level: "high",
      score: 4 + (sensitive ? 1 : 0),
      title: "Extreme heat risk",
      explanation:
        "Very high temperatures may cause heat stress — leaves can wilt, flowers may drop, and the crop loses water faster than it can take it up.",
      evidence: [`Current temperature is ${temperature}°C (≥ ${RISK_THRESHOLDS.heatHigh}°C).`],
      recommendedActions: [
        "Irrigate early morning or late evening to reduce water loss.",
        "Provide light shade to young plants if practical.",
        "Avoid spraying or transplanting during the hottest hours.",
      ],
      source: "weather",
    });
  } else if (temperature >= RISK_THRESHOLDS.heatMedium) {
    signals.push({
      category: "weather",
      level: "medium",
      score: 3 + (sensitive ? 1 : 0),
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
  } else if (temperature >= RISK_THRESHOLDS.heatWarm) {
    signals.push({
      category: "weather",
      level: "low",
      score: 1,
      title: "Warm conditions",
      explanation:
        "Warm conditions are manageable but slightly increase water demand.",
      evidence: [`Current temperature is ${temperature}°C.`],
      recommendedActions: ["Monitor soil moisture and irrigate young crops if the topsoil is dry."],
      source: "weather",
    });
  }

  /* ----------------------------- Rainfall ---------------------------- */
  if (forecastRain >= RISK_THRESHOLDS.rainHigh) {
    signals.push({
      category: "weather",
      level: "high",
      score: 4,
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
  } else if (forecastRain >= RISK_THRESHOLDS.rainMedium) {
    signals.push({
      category: "weather",
      level: "medium",
      score: 2,
      title: "Rain possible — waterlogging watch",
      explanation:
        "A moderate chance of rain means fields may get wet; low-lying areas are at some risk of waterlogging.",
      evidence: [`Rain probability is up to ${forecastRain}%.`],
      recommendedActions: ["Delay watering until rain passes; watch low-lying fields."],
      source: "weather",
    });
  }

  /* ----------------------------- Humidity ---------------------------- */
  if (humidity >= RISK_THRESHOLDS.humidityHigh) {
    signals.push({
      category: "disease",
      level: "high",
      score: 4 + (temperature >= RISK_THRESHOLDS.heatMedium ? 1 : 0),
      title: "High humidity — disease conditions",
      explanation:
        "Warm, very humid air may increase the risk of fungal diseases like blight and mildew. This is a conditions warning, not a diagnosis.",
      evidence: [`Humidity is ${humidity}% (≥ ${RISK_THRESHOLDS.humidityHigh}%).`],
      recommendedActions: [
        "Check leaves for spots or powdery growth.",
        "Improve airflow between rows where possible.",
        "If spots appear, have a Crop Doctor photo check done before treating.",
      ],
      source: "weather",
    });
  } else if (humidity >= RISK_THRESHOLDS.humidityMedium) {
    signals.push({
      category: "disease",
      level: "medium",
      score: 2,
      title: "Humid conditions — disease watch",
      explanation:
        "Moderate humidity may slightly increase the risk of fungal problems if it stays damp for a couple of days.",
      evidence: [`Humidity is ${humidity}%.`],
      recommendedActions: ["Watch leaves for spots; avoid dense, wet foliage overnight."],
      source: "weather",
    });
  }

  /* ------------------------------- Wind ------------------------------ */
  if (windSpeed >= RISK_THRESHOLDS.windHigh) {
    signals.push({
      category: "weather",
      level: "high",
      score: 3,
      title: "Strong wind risk",
      explanation:
        "Strong winds may damage young or tall plants and cause spray drift if any treatment is applied.",
      evidence: [`Wind is ${windSpeed} km/h (≥ ${RISK_THRESHOLDS.windHigh} km/h).`],
      recommendedActions: [
        "Do not spray pesticides or fertiliser in strong wind.",
        "Support young or tall plants; shelter sensitive crops if possible.",
      ],
      source: "weather",
    });
  } else if (windSpeed >= RISK_THRESHOLDS.windMedium) {
    signals.push({
      category: "weather",
      level: "medium",
      score: 2,
      title: "Breezy conditions",
      explanation: "Moderate winds can cause spray drift and stress young plants.",
      evidence: [`Wind is ${windSpeed} km/h.`],
      recommendedActions: ["Skip spraying today; check young plants are supported."],
      source: "weather",
    });
  }

  return signals;
}

/* ------------------------------------------------------------------ */
/* Diagnosis signals                                                   */
/* ------------------------------------------------------------------ */

function diagnosisSignals(input: RiskEngineInput, now: Date): RiskSignal[] {
  const signals: RiskSignal[] = [];
  if (!input.recentDiagnoses.length) return signals;
  const { growth } = input;
  const sensitive = growth
    ? RISK_THRESHOLDS.sensitiveStages.includes(growth.growthStage)
    : false;

  for (const d of input.recentDiagnoses.slice(0, 5)) {
    const days = daysSince(d.createdAt, now);
    const recency = days === null ? 0.5 : recencyWeight(days);
    const confidence = confidenceWeight(d.confidence);
    const { pest, disease } = classifyDiagnosisText(d.diagnosis);

    if (pest) {
      const base = 3;
      const score = Math.round(base * recency * confidence) + (sensitive ? 1 : 0);
      if (score > 0) {
        signals.push({
          category: "pest",
          level: scoreToLevel(score),
          score,
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
      const base = 3;
      const humidity = input.weather?.humidity ?? 0;
      const humidityBoost =
        humidity >= RISK_THRESHOLDS.humidityMedium ? 1 : 0;
      const score = Math.round(base * recency * confidence) + humidityBoost;
      if (score > 0) {
        signals.push({
          category: "disease",
          level: scoreToLevel(score),
          score,
          title: "Elevated disease risk",
          explanation:
            "A recent crop check found a disease. Current conditions (and humidity if elevated) may keep disease risk elevated — monitor closely rather than assume.",
          evidence: [
            `Recent diagnosis: ${d.diagnosis} (confidence ${d.confidence}%).`,
            humidity >= RISK_THRESHOLDS.humidityMedium
              ? `Humidity is ${humidity}%, which may favour disease spread.`
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

  return signals;
}

/* ------------------------------------------------------------------ */
/* Irrigation signals (only when there is sufficient farm/weather data) */
/* ------------------------------------------------------------------ */

function irrigationSignals(input: RiskEngineInput): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const w = input.weather;
  const method = input.farm?.irrigationMethod?.toLowerCase() ?? "";
  const hasFarmContext = Boolean(input.farm && input.farm.currentCrop);
  if (!hasFarmContext || !w) return signals;

  const rainDependent = /rain|barani|rainfed|rain-fed/i.test(method);

  // Water stress: rain-dependent irrigation + hot + little rain expected.
  if (rainDependent && w.rainProbability < RISK_THRESHOLDS.rainMedium) {
    const heatStress = w.temperature >= RISK_THRESHOLDS.heatMedium;
    if (heatStress) {
      signals.push({
        category: "irrigation",
        level: "medium",
        score: 3,
        title: "Possible water stress",
        explanation:
          "Your irrigation depends on rainfall and conditions are hot with little rain expected — the crop may face water stress.",
        evidence: [
          `Irrigation method: ${input.farm?.irrigationMethod}.`,
          `Temperature ${w.temperature}°C with only ${w.rainProbability}% chance of rain.`,
        ],
        recommendedActions: [
          "Check soil moisture at root depth before watering.",
          "If water is available, irrigate early or late in the day.",
        ],
        source: "farm",
      });
    }
  }

  // Excess moisture: heavy rain expected regardless of method.
  if (w.rainProbability >= RISK_THRESHOLDS.rainHigh) {
    signals.push({
      category: "irrigation",
      level: "medium",
      score: 2,
      title: "Excess moisture watch",
      explanation:
        "Heavy rain is expected; fields may hold too much water, especially in heavy soil.",
      evidence: [`Rain probability is ${w.rainProbability}%.`],
      recommendedActions: ["Clear drainage channels; avoid further irrigation before rain."],
      source: "weather",
    });
  }

  return signals;
}

/* ------------------------------------------------------------------ */
/* General crop stress (environmental + observed conditions)           */
/* ------------------------------------------------------------------ */

function cropStressSignals(input: RiskEngineInput): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const w = input.weather;
  const growth = input.growth;
  if (!w || !growth) return signals;

  const sensitive = RISK_THRESHOLDS.sensitiveStages.includes(growth.growthStage);
  const hot = w.temperature >= RISK_THRESHOLDS.heatWarm;
  const dry = w.humidity < RISK_THRESHOLDS.humidityDry;
  const littleRain = w.rainProbability < RISK_THRESHOLDS.rainMedium;

  // Heat + dry air + little rain → general environmental stress.
  if (hot && dry && littleRain) {
    signals.push({
      category: "crop_stress",
      level: sensitive ? "high" : "medium",
      score: sensitive ? 4 : 3,
      title: "Environmental crop stress",
      explanation:
        "Hot, dry conditions with little rain may stress the crop, especially in a sensitive growth stage.",
      evidence: [
        `Temperature ${w.temperature}°C, humidity ${w.humidity}%, rain ${w.rainProbability}%.`,
        growth ? `Current stage: ${growth.stageLabel}.` : null,
      ].filter(Boolean) as string[],
      recommendedActions: [
        "Water early or late to keep the root zone moist.",
        "Mulch around plants to reduce evaporation.",
        "Monitor young plants for wilting.",
      ],
      source: "weather",
    });
  }

  return signals;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Evaluate all deterministic risk signals for a farm's current context.
 * Returns an array of signals, each with an evidence score and level.
 * Empty result = no meaningful risk detected from the available data
 * (never invent one just to fill the screen).
 */
export function evaluateRiskSignals(
  input: RiskEngineInput,
  now: Date = new Date()
): RiskSignal[] {
  const signals: RiskSignal[] = [
    ...weatherSignals(input),
    ...diagnosisSignals(input, now),
    ...irrigationSignals(input),
    ...cropStressSignals(input),
  ];

  // Keep the strongest signal per category so the farmer sees each risk once,
  // prioritised by evidence strength.
  const byCategory = new Map<RiskCategory, RiskSignal>();
  for (const s of signals) {
    const existing = byCategory.get(s.category);
    if (!existing || s.score > existing.score) byCategory.set(s.category, s);
  }

  return [...byCategory.values()].sort((a, b) => b.score - a.score);
}

/**
 * Collapse signals into a prioritised, capped list of risks to display.
 * Max 5 risks; prefer the strongest evidence.
 */
export function prioritiseRisks(signals: RiskSignal[], max = 5): RiskSignal[] {
  return signals.slice(0, max);
}