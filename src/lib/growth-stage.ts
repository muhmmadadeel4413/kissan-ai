import type {
  CropGrowthConfig,
  CropGrowthInfo,
  CropStageBoundary,
} from "../types";

/**
 * Deterministic growth-stage engine.
 *
 * Crop age and growth stage are derived from the saved planting date, the
 * current calendar date, and a per-crop growth configuration. No AI calls —
 * this is plain application logic that recomputes every day without the farmer
 * editing anything.
 *
 * Stage boundaries are MVP estimates, NOT scientifically exact. The config is
 * modular on purpose so agronomic rules can be refined later without touching
 * the engine or any UI component.
 */

const MS_PER_DAY = 86_400_000;

/* ------------------------------------------------------------------ */
/* Stage vocabulary                                                    */
/* ------------------------------------------------------------------ */

const STAGE_LABELS: Record<
  Exclude<CropStageBoundary["stage"], never>,
  string
> = {
  germination: "Germination / Emergence",
  vegetative: "Vegetative",
  flowering: "Flowering",
  fruiting: "Fruiting / Reproductive",
  maturity: "Maturity",
  harvest: "Harvest / Ready",
};

const STAGE_ORDER: Array<CropStageBoundary["stage"]> = [
  "germination",
  "vegetative",
  "flowering",
  "fruiting",
  "maturity",
  "harvest",
];

/* ------------------------------------------------------------------ */
/* Crop growth configuration                                          */
/* ------------------------------------------------------------------ */

/**
 * Build the ordered stage list for a crop from inclusive day boundaries.
 * `endDays` are the inclusive last day of each stage, in STAGE_ORDER.
 */
function buildStages(endDays: [number, number, number, number, number, number]): CropStageBoundary[] {
  let prevEnd = -1;
  return STAGE_ORDER.map((stage, i) => {
    const startDay = prevEnd + 1;
    const endDay = endDays[i];
    prevEnd = endDay;
    return { stage, label: STAGE_LABELS[stage], startDay, endDay };
  });
}

/**
 * MVP growth-cycle configurations for the crops supported by the Farm
 * Profile. Day ranges are estimates, kept separate from the engine so they
 * can be refined or extended without rewriting logic.
 */
const CROP_CONFIGS: Record<string, CropGrowthConfig> = {
  wheat: {
    crop: "wheat",
    label: "Wheat",
    totalDays: 150,
    stages: buildStages([10, 70, 95, 120, 140, 150]),
  },
  rice: {
    crop: "rice",
    label: "Rice",
    totalDays: 140,
    stages: buildStages([7, 55, 75, 105, 125, 140]),
  },
  cotton: {
    crop: "cotton",
    label: "Cotton",
    totalDays: 180,
    stages: buildStages([14, 55, 90, 140, 165, 180]),
  },
  maize: {
    crop: "maize",
    label: "Maize",
    totalDays: 120,
    stages: buildStages([7, 50, 65, 95, 110, 120]),
  },
  sugarcane: {
    crop: "sugarcane",
    label: "Sugarcane",
    totalDays: 365,
    stages: buildStages([30, 180, 240, 300, 340, 365]),
  },
};

/** Common name / alias → canonical config key (Urdu + English). */
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

function normalizeCrop(crop: string | null | undefined): string {
  if (!crop) return "";
  return crop.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Return the growth config for a crop, or null when not configured. */
export function getCropGrowthConfig(
  crop: string | null | undefined
): CropGrowthConfig | null {
  const key = normalizeCrop(crop);
  if (!key) return null;
  const canonical = CROP_ALIASES[key] ?? key;
  return CROP_CONFIGS[canonical] ?? null;
}

/* ------------------------------------------------------------------ */
/* Date handling — timezone-safe                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a "YYYY-MM-DD" value as a UTC-midnight timestamp so day arithmetic is
 * immune to local-timezone / DST drift. Returns null for invalid dates.
 */
function parseDateToUtc(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const ts = Date.UTC(year, month - 1, day);
  // Round-trip check rejects impossible dates such as Feb 30.
  const check = new Date(ts);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ts;
}

/** Midnight (UTC) of the given date's calendar day, using local calendar. */
function todayUtcMidnight(today: Date): number {
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export interface CropAgeResult {
  /** Days since planting; null when there is no valid planting date. */
  cropAgeDays: number | null;
  /** True when the planting date is in the future (age clamped to 0). */
  future: boolean;
}

/**
 * Number of whole days since planting. Missing/invalid dates return null;
 * future dates are clamped to 0 (never negative) and flagged via `future`.
 */
export function calculateCropAge(
  plantingDate: string | null | undefined,
  today: Date = new Date()
): CropAgeResult {
  if (!plantingDate) return { cropAgeDays: null, future: false };

  const planted = parseDateToUtc(plantingDate);
  if (planted === null) return { cropAgeDays: null, future: false };

  const days = Math.floor((todayUtcMidnight(today) - planted) / MS_PER_DAY);
  if (days < 0) return { cropAgeDays: 0, future: true };
  return { cropAgeDays: days, future: false };
}

/**
 * Calculate the growth stage for a crop given its planting date.
 * Handles missing/invalid dates, future dates, and unsupported crops without
 * crashing or inventing a scientifically precise stage.
 */
export function getGrowthStage(
  crop: string | null | undefined,
  plantingDate: string | null | undefined,
  today: Date = new Date()
): CropGrowthInfo {
  const cropName = normalizeCrop(crop) || "Unknown crop";
  const age = calculateCropAge(plantingDate, today);

  if (age.cropAgeDays === null) {
    return {
      crop: cropName,
      cropAgeDays: null,
      growthStage: "unknown",
      stageLabel: "Growth stage unavailable",
      confidence: "unknown",
      reason: "A planting date is needed to calculate the growth stage.",
    };
  }

  if (age.future) {
    return {
      crop: cropName,
      cropAgeDays: 0,
      growthStage: "not_started",
      stageLabel: "Not started",
      confidence: "estimated",
      reason: "The planting date is in the future.",
    };
  }

  const config = getCropGrowthConfig(cropName);
  if (!config) {
    return {
      crop: cropName,
      cropAgeDays: age.cropAgeDays,
      growthStage: "unknown",
      stageLabel: "Growth stage unavailable",
      confidence: "unknown",
      reason: `Growth-stage configuration is not available for ${cropName}.`,
    };
  }

  const days = age.cropAgeDays;
  const match = config.stages.find((s) => days >= s.startDay && days <= s.endDay);
  const stage = match ?? config.stages[config.stages.length - 1];

  return {
    crop: cropName,
    cropAgeDays: days,
    growthStage: stage.stage,
    stageLabel: stage.label,
    confidence: "estimated",
  };
}

/**
 * Convenience alias: full growth info for a crop. Equivalent to
 * `getGrowthStage` and kept for readability in consumers.
 */
export function getCropGrowthInfo(
  crop: string | null | undefined,
  plantingDate: string | null | undefined,
  today: Date = new Date()
): CropGrowthInfo {
  return getGrowthStage(crop, plantingDate, today);
}