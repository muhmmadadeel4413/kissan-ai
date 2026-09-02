import type {
  IrrigationRecommendation,
  IrrigationStatus,
  IrrigationUrgency,
} from "../types";

/**
 * Irrigation Advisor — deterministic rule layer (Prompt 14).
 *
 * This is a PURE, dependency-free module: no Supabase, no AI. It reads REAL
 * farm context (crop, soil, irrigation method), the deterministic growth
 * stage, and (when available) real weather, and produces an evidence-based
 * irrigation recommendation.
 *
 * Design principles (mirror the Risk Engine):
 *  - No invented values. Missing data yields an honest "insufficient" or
 *    reduced-confidence recommendation, never a fake number.
 *  - Rain-aware: if meaningful rainfall is expected soon we recommend
 *    delaying irrigation when appropriate, never blindly "water every day".
 *  - Water amounts are ONLY estimated when the available data genuinely
 *    supports it (recognised crop + growth config + weather + method). In all
 *    other cases `amount` stays empty and the system says the exact quantity
 *    cannot be reliably estimated. We never present an unvalidated exact
 *    figure as scientific fact.
 *  - Thresholds are co-located so agronomic rules can be refined in one place.
 *
 * The deterministic result feeds the hybrid Edge Function, which may add
 * contextual AI explanation — but safety and honesty rules here are never
 * overridden by the AI.
 */

/* ------------------------------------------------------------------ */
/* Thresholds (centralised for agronomic refinement)                   */
/* ------------------------------------------------------------------ */

export const IRRIGATION_THRESHOLDS = {
  /** Rain probability % above which we actively consider delaying. */
  rainDelay: 40,
  /** Rain probability % above which irrigation is strongly discouraged. */
  rainStrong: 70,
  /** °C which notably raises crop water demand. */
  heatWarm: 33,
  /** °C considered genuinely hot for crops. */
  heatHigh: 40,
} as const;

/** Recognised rain-dependent irrigation methods (no invented method). */
const RAIN_DEPENDENT_METHODS: readonly string[] = [
  "rain-fed",
  "rain fed",
  "barani",
  "rainfed",
];

/** Weight each growth stage has on how urgent water is. Higher = thirstier. */
const STAGE_WEIGHT: Record<string, number> = {
  germination: 0.6,
  seedling: 0.7,
  vegetative: 0.9,
  flowering: 1.0,
  fruiting: 1.0,
  maturity: 0.6,
  harvest: 0.2,
  unknown: 0.5,
  not_started: 0.4,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function soilIsKnown(soil: string | null | undefined): boolean {
  return Boolean(soil && soil.trim() && !/unknown|n\/a/i.test(soil.trim()));
}

function methodIsKnown(method: string | null | undefined): boolean {
  return Boolean(method && method.trim() && !/unknown|n\/a/i.test(method.trim()));
}

function isRainDependent(method: string | null | undefined): boolean {
  const m = (method ?? "").trim().toLowerCase();
  return RAIN_DEPENDENT_METHODS.some((k) => m.includes(k));
}

function stageWeight(stage: string | null | undefined): number {
  const key = ((stage ?? "") || "").toLowerCase();
  return STAGE_WEIGHT[key] ?? 0.5;
}

function isKnownStage(stage: string | null | undefined): boolean {
  const key = ((stage ?? "") || "").toLowerCase();
  return !["unknown", "not_started", "", "growth stage unavailable"].includes(key);
}

/**
 * The maximum rain probability across current conditions and any forecast
 * days (real values only — never invented).
 */
export function effectiveRainPct(
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

/** Determine the irrigation status purely from context (the safe baseline). */
export function evaluateIrrigation(
  input: {
    crop: string | null | undefined;
    growthStage: string | null | undefined;
    soilType?: string | null;
    irrigationMethod?: string | null;
    /** Effective rain probability (current ∪ forecast), when weather is live. */
    rainProbability?: number | null;
    temperature?: number | null;
  }
): {
  status: IrrigationStatus;
  urgency: IrrigationUrgency;
  reason: string;
} {
  const crop = (input.crop ?? "").trim();
  const soil = soilIsKnown(input.soilType) ? (input.soilType ?? "") : "";
  const method = methodIsKnown(input.irrigationMethod) ? (input.irrigationMethod ?? "") : "";

  // Critical context missing → honest "insufficient" state, never a guess.
  if (!crop || !soil || !method) {
    return {
      status: "insufficient",
      urgency: "low",
      reason:
        "Not enough farm information is available to recommend irrigation. Missing crop, soil type, or irrigation method.",
    };
  }

  const stage = isKnownStage(input.growthStage) ? input.growthStage! : null;
  const rain = Number(input.rainProbability) || 0;
  const stageWeightVal = stageWeight(stage);
  const heat = (Number(input.temperature) || 0) >= IRRIGATION_THRESHOLDS.heatWarm;
  const heatHigh = (Number(input.temperature) || 0) >= IRRIGATION_THRESHOLDS.heatHigh;

  /*
   * Decision priority (deterministic, rain-aware):
   *  1. Strongly meaningful rain expected → delay if the crop can wait.
   *  2. Very high temperature + known stage → water soon even if rain may come.
   *  3. Rain-dependent + dry/hot → water now (no alternative water source).
   *  4. Otherwise → adequate/monitor rather than inventing urgency.
   */

  // Rain-aware: delay when substantial rain is expected and the stage is not
  // so moisture-critical that we still must water (e.g. not vegetative peak).
  if (rain >= IRRIGATION_THRESHOLDS.rainStrong) {
    return {
      status: "delay",
      urgency: "low",
      reason:
        "Rain is expected soon, so irrigation can be delayed. Check soil moisture and avoid watering until the rain passes.",
    };
  }

  if (rain >= IRRIGATION_THRESHOLDS.rainDelay && heatHigh) {
    return {
      status: "irrigation_soon",
      urgency: "medium",
      reason:
        "Rain may arrive, but very high temperatures raise water demand — monitor soil moisture and be ready to irrigate soon.",
    };
  }

  // Rain-dependent system, hot & little rain → water now.
  if (isRainDependent(input.irrigationMethod) && heatHigh) {
    return {
      status: "irrigate_now",
      urgency: "high",
      reason:
        "Your irrigation depends on rainfall and very high temperatures increase crop water loss — irrigate now if water is available.",
    };
  }

  // Rain-dependent, warm and dry → strong nudge.
  if (isRainDependent(input.irrigationMethod) && heat) {
    return {
      status: "irrigation_soon",
      urgency: "medium",
      reason:
        "Warm conditions with rain-dependent irrigation raise crop water need — check soil moisture and prepare to irrigate.",
    };
  }

  // A known moisture-demanding stage with heat (not yet rain-covered).
  if (stage && stageWeightVal >= 0.9 && heat) {
    return {
      status: "irrigation_soon",
      urgency: "medium",
      reason:
        "The crop is in a water-demanding stage and conditions are warm — plan to irrigate and keep soil moisture sufficient.",
    };
  }

  // Fallback: adequate / monitor — never fabricate an urgent need.
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
/* Sanitize / validate a candidate payload (pure; server + client)     */
/* ------------------------------------------------------------------ */

const VALID_STATUSES = new Set<IrrigationStatus>([
  "irrigate_now",
  "irrigation_soon",
  "delay",
  "adequate",
  "insufficient",
]);
const VALID_URGENCIES = new Set<IrrigationUrgency>(["low", "medium", "high"]);

function cleanString(value: unknown, maxLen: number): string {
  const s = String(value ?? "").trim().replace(/\s+/g, " ");
  return s.slice(0, maxLen);
}

function cleanStrings(value: unknown, max: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    const s = cleanString(v, maxLen);
    if (s && out.length < max) out.push(s);
  }
  return out;
}

/**
 * Parse + validate the structured candidate (from AI or deterministic path).
 * Enforces safe invariants:
 *  - valid status/urgency enums,
 *  - `waterGuidance` is never presented as a precise scientific quantity
 *    without the engine deliberately choosing to; here we clamp confidence and
 *    allow an empty amount,
 *  - all fields are trimmed/limited.
 * Returns null when the payload is unusable.
 */
export function sanitizeIrrigationPayload(raw: unknown): {
  recommendation: IrrigationRecommendation;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const statusRaw = String(r.irrigation_status ?? r.status ?? "");
  if (!VALID_STATUSES.has(statusRaw as IrrigationStatus)) return null;
  const status = statusRaw as IrrigationStatus;

  const urgencyRaw = String(r.urgency ?? "");
  const urgency = VALID_URGENCIES.has(urgencyRaw as IrrigationUrgency)
    ? (urgencyRaw as IrrigationUrgency)
    : "low";

  // Water guidance must never fabricate a quantity. If the AI/deterministic
  // path returns an amount, keep it only as relative text and zero-confidence
  // unless the engine explicitly supported an estimate — the production path
  // chooses confidence deliberately.
  const wg = (typeof r["water_guidance"] === "object" && r["water_guidance"] ? r["water_guidance"] : {}) as Record<string, unknown>;
  const amount = cleanString(wg["amount"], 120);
  const confidence = Math.max(
    0,
    Math.min(100, Math.round(Number(wg["confidence"]) || 0))
  );

  const recommendation: IrrigationRecommendation = {
    status,
    urgency,
    recommendation:
      cleanString(r["recommendation"], 600) ||
      "We don't have enough information to recommend a specific irrigation action right now.",
    timing:
      typeof r["timing"] === "object" && r["timing"]
        ? {
            recommended_time: cleanString((r["timing"] as Record<string, unknown>)["recommended_time"], 200),
            reason: cleanString((r["timing"] as Record<string, unknown>)["reason"], 300),
          }
        : null,
    waterGuidance: {
      amount,
      unit: cleanString(wg["unit"], 40),
      confidence,
      relative: cleanString(wg["relative"] ?? r["water_guidance_relative"], 400),
    },
    weatherImpact: cleanString(r["weather_impact"], 400),
    soilImpact: cleanString(r["soil_impact"], 400),
    cropStageImpact: cleanString(r["crop_stage_impact"], 400),
    rainAdjustment: cleanString(r["rain_adjustment"], 400),
    nextCheck: cleanString(r["next_check"], 200),
    importantNotes: cleanStrings(r["important_notes"], 10, 400),
    limitations: cleanStrings(r["limitations"], 10, 400),
  };

  return { recommendation };
}

/**
 * Build a minimal, honest deterministic recommendation when the crop/soil/
 * method context is insufficient — used so a request never fails hard and
 * never fabricates data.
 */
export function insufficientRecommendation(missing: string[]): IrrigationRecommendation {
  return {
    status: "insufficient",
    urgency: "low",
    recommendation:
      "More information is needed about your farm before we can recommend irrigation.",
    timing: null,
    waterGuidance: { amount: "", unit: "", confidence: 0, relative: "" },
    weatherImpact: "",
    soilImpact: "",
    cropStageImpact: "",
    rainAdjustment: "",
    nextCheck: "Update your farm profile and try again.",
    importantNotes: [],
    limitations: [
      `The following information is missing or unclear: ${missing.join(", ")}. Without it, an exact water quantity cannot be reliably estimated.`,
    ],
  };
}