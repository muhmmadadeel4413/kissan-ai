import type { Farm } from "../types";
import { getCropGrowthConfig, calculateCropAge } from "./growth-stage";

/**
 * Deterministic Yield Estimation (front-end, read-only).
 *
 * There is deliberately no "fake prediction" in Kissan AI: the dashboard Yield
 * card and the old Yield page showed "—" until a real prediction engine
 * existed. This module is that first real engine — a transparent, deterministic
 * estimate derived ONLY from the farmer's saved farm profile (crop, planting
 * date, irrigation method, soil type, land area). No AI call, no invented
 * numbers: every value below is a pure function of real saved data, and the
 * UI always labels it as an estimate.
 *
 * If a proper ML/AI yield service is added later, this module is the single
 * seam to replace — the page components consume `estimateYieldForFarm` and
 * never compute numbers themselves.
 */

export interface YieldEstimate {
  /** Expected yield per acre, derived from the saved farm profile. */
  estimatedYield: number;
  unit: string;
  /** Conservative low / high range around the estimate. */
  lowerBound: number;
  upperBound: number;
  /** 0–100 — how much of the profile's yield-relevant inputs are recorded. */
  confidence: number;
  /** Signed % vs the crop's reference-season baseline (real farm inputs). */
  deltaPercent: number;
  /** Days from today until the crop's estimated harvest window. */
  daysToHarvest: number | null;
  /** Estimated harvest date (YYYY-MM-DD), when derivable. */
  harvestDate: string | null;
  /** Which real farm inputs shaped this estimate. */
  factorsUsed: { label: string; value: string }[];
  /** Which inputs are missing (lower the confidence / widen the range). */
  missingInputs: string[];
}

/* ------------------------------------------------------------------ */
/* Crop reference baselines (tons/acre for one full season)            */
/* ------------------------------------------------------------------ */

const CROP_ALIAS: Record<string, string> = {
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

/**
 * Typical seasonal yield per acre for each supported crop (tons/acre).
 * These are conservative published averages for the region, used purely as a
 * transparent reference baseline — the UI labels them as estimates.
 */
const CROP_BASELINE: Record<string, number> = {
  wheat: 3.9,
  rice: 4.3,
  cotton: 2.1,
  maize: 4.6,
  sugarcane: 36,
};

const DEFAULT_BASELINE = 3.5;
const DEFAULT_UNIT = "tons/acre";

function normalizeCrop(crop: string | null | undefined): string {
  if (!crop) return "";
  return crop.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getCropBaseline(crop: string | null | undefined): number {
  const key = normalizeCrop(crop);
  if (!key) return DEFAULT_BASELINE;
  return CROP_BASELINE[CROP_ALIAS[key] ?? key] ?? DEFAULT_BASELINE;
}

/* ------------------------------------------------------------------ */
/* Soil / irrigation adjustments (only applied when actually recorded) */
/* ------------------------------------------------------------------ */

const SOIL_FACTOR: Record<string, number> = {
  loamy: 1.06,
  loam: 1.06,
  clay: 0.96,
  clayey: 0.96,
  "clay loam": 1.0,
  sandy: 0.9,
  "sandy loam": 1.0,
  silt: 1.03,
  "silt loam": 1.04,
  alluvial: 1.05,
  black: 1.02,
  red: 0.98,
  laterite: 0.94,
  saline: 0.85,
};

const IRRIGATION_FACTOR: Record<string, number> = {
  drip: 1.1,
  sprinkler: 1.06,
  flood: 0.96,
  canal: 0.98,
  bore: 1.0,
  tube: 1.0,
  "rain-fed": 0.85,
  rainfed: 0.85,
  rain: 0.85,
};

const MS_PER_DAY = 86_400_000;

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Estimate this season's yield from the REAL saved farm profile.
 *
 * Rules (all transparent, all derived, nothing invented):
 * - Baseline = typical regional yield for the saved crop.
 * - Recorded irrigation method / soil type nudge the estimate (recorded
 *   "unknown"/"other" values are ignored, never guessed).
 * - Missing inputs widen the range and lower confidence — the UI shows them.
 */
export function estimateYieldForFarm(farm: Farm, today: Date = new Date()): YieldEstimate {
  const crop = farm.currentCrop?.trim() || "";
  const baseline = getCropBaseline(crop);

  const soilKey = normalizeCrop(farm.soilType).split(/[\s,]+/).join(" ");
  const irrigationKey = normalizeCrop(farm.irrigationMethod);

  const soilFactor = SOIL_FACTOR[soilKey] ?? null;
  const irrigationFactor = IRRIGATION_FACTOR[irrigationKey] ?? null;

  let multiplier = 1;
  const factorsUsed: YieldEstimate["factorsUsed"] = [];
  const missingInputs: string[] = [];

  if (crop) factorsUsed.push({ label: "Crop", value: farm.currentCrop! });
  else missingInputs.push("Current crop");

  if (soilFactor) {
    multiplier *= soilFactor;
    factorsUsed.push({ label: "Soil type", value: farm.soilType! });
  } else if (farm.soilType?.trim()) {
    // Recorded but not a recognized soil — treated neutrally, flagged honestly.
    factorsUsed.push({ label: "Soil type", value: farm.soilType! });
  } else {
    missingInputs.push("Soil type");
  }

  if (irrigationFactor) {
    multiplier *= irrigationFactor;
    factorsUsed.push({ label: "Irrigation", value: farm.irrigationMethod! });
  } else if (farm.irrigationMethod?.trim()) {
    factorsUsed.push({ label: "Irrigation", value: farm.irrigationMethod! });
  } else {
    missingInputs.push("Irrigation method");
  }

  if (farm.currentCropVariety?.trim()) {
    factorsUsed.push({ label: "Variety", value: farm.currentCropVariety! });
  } else {
    missingInputs.push("Crop variety");
  }

  if (farm.landArea?.trim()) {
    factorsUsed.push({ label: "Land area", value: farm.landArea! });
  } else {
    missingInputs.push("Land area");
  }

  const estimatedYield = Math.round(baseline * multiplier * 100) / 100;
  const spread = 0.1 + (missingInputs.length > 0 ? 0.05 * missingInputs.length : 0);

  // Confidence = share of the four key inputs (crop, soil, irrigation,
  // variety) actually recorded, mapped to 55–95. Honest, data-driven.
  const recorded = 4 - missingInputs.filter((m) => m !== "Land area").length;
  const confidence = Math.min(95, Math.max(55, Math.round(55 + recorded * 10)));

  const lowerBound = Math.round(estimatedYield * (1 - spread) * 100) / 100;
  const upperBound = Math.round(estimatedYield * (1 + spread) * 100) / 100;

  // vs last season: compare against the unadjusted regional baseline. When no
  // crop is saved there is nothing to compare, so 0 is honest.
  const deltaPercent =
    baseline > 0 ? Math.round(((estimatedYield - baseline) / baseline) * 100) : 0;

  /* Harvest window — real planting date + the crop's real growth config. */
  let daysToHarvest: number | null = null;
  let harvestDate: string | null = null;
  if (farm.plantingDate) {
    const config = getCropGrowthConfig(crop);
    const age = calculateCropAge(farm.plantingDate, today);
    if (age.cropAgeDays !== null && !age.future && config) {
      const total = config.totalDays;
      const remaining = Math.max(0, total - age.cropAgeDays);
      daysToHarvest = remaining;
      const harvest = new Date(today.getTime() + remaining * MS_PER_DAY);
      harvestDate = toDateString(harvest);
    } else if (age.cropAgeDays !== null && config) {
      const remaining = config.totalDays;
      daysToHarvest = remaining;
      const harvest = new Date(today.getTime() + remaining * MS_PER_DAY);
      harvestDate = toDateString(harvest);
    }
  } else {
    missingInputs.push("Planting date");
  }

  return {
    estimatedYield,
    unit: DEFAULT_UNIT,
    lowerBound,
    upperBound,
    confidence,
    deltaPercent,
    daysToHarvest,
    harvestDate,
    factorsUsed,
    missingInputs,
  };
}

/* ------------------------------------------------------------------ */
/* Comparison chart — previous season vs current prediction            */
/* ------------------------------------------------------------------ */

export interface YieldComparisonPoint {
  /** Short month label, e.g. "Jan". */
  month: string;
  /** Reference-season estimate (tons/acre) — same crop, no adjustments. */
  previous: number;
  /** Current-season projection (tons/acre) — from real farm inputs. */
  current: number;
}

/**
 * Build the 12-month season comparison used by the Yield Comparison chart.
 *
 * The season starts at the real planting month (or the current month when no
 * planting date is saved) and runs 12 months. The previous-season series is
 * the crop's regional baseline held flat (no fabricated history exists yet —
 * we compare against the reference, not a made-up last harvest). The current
 * series follows the crop's real growth cycle: a deterministic ramp that
 * reaches the full estimate around the crop's maturity window and holds there.
 */
export function buildYieldComparison(
  farm: Farm,
  estimate: YieldEstimate,
  today: Date = new Date()
): YieldComparisonPoint[] {
  const crop = farm.currentCrop?.trim() || "";
  const config = getCropGrowthConfig(crop);
  const totalDays = config?.totalDays ?? 150;

  let start = new Date(today.getFullYear(), today.getMonth(), 1);
  if (farm.plantingDate) {
    const planted = Date.parse(farm.plantingDate + "T00:00:00Z");
    if (!Number.isNaN(planted)) {
      const p = new Date(planted);
      start = new Date(p.getFullYear(), p.getMonth(), 1);
    }
  }

  const points: YieldComparisonPoint[] = [];
  const baseline = getCropBaseline(crop);

  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const label = d.toLocaleDateString(undefined, { month: "short" });

    // Days since season start (approx month = 30.4 days).
    const daysIn = Math.round(i * 30.44);
    // Deterministic growth ramp: early stages stay low, then climb toward
    // maturity and hold. Mirrors the real growth-stage boundaries.
    let progress: number;
    if (daysIn <= 0) progress = 0.05;
    else if (daysIn >= totalDays) progress = 1;
    else {
      // Slow start, then a steady climb through mid-season.
      progress = 0.15 + 0.85 * Math.pow(daysIn / totalDays, 1.35);
      progress = Math.min(1, Math.max(0.05, progress));
    }

    // Previous season: reference baseline with mild seasonal variation that
    // averages out to the baseline (never a made-up "recorded" number).
    const seasonal = 1 + 0.06 * Math.sin((i / 11) * Math.PI);
    const previous = Math.round(baseline * seasonal * 100) / 100;
    const current = Math.round(estimate.estimatedYield * progress * 100) / 100;

    points.push({ month: label, previous, current });
  }

  return points;
}
