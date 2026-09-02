import { supabase } from "./supabase";
import type { CropRecommendation, CropRecommendationRecord, CropSuitability } from "../types";

/**
 * Smart Crop Recommendation data layer (Prompt 13).
 *
 * The real crop-suitability reasoning happens server-side in the
 * `recommend-crops` Edge Function (which owns the Gemini API key and enforces
 * farm ownership). The browser only:
 *   1. sends the active farm id + the already-fetched weather snapshot,
 *   2. reads back saved recommendation records for the history section.
 *
 * No AI key ever reaches client code, and the farm id is always the user's
 * own active farm (RLS scopes every read to owned farms).
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Row shape from the `crop_recommendations` table (snake_case). */
export interface CropRecommendationRow {
  id: string;
  farm_id: string;
  recommendations: CropRecommendation[];
  summary: string;
  limitations: string[];
  needs_more_information: boolean;
  missing_information: string[];
  created_at: string;
}

/** The snapshot of weather we forward so recommendations reflect live data. */
export interface RecommendationWeatherInput {
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
}

function mapRow(row: CropRecommendationRow): CropRecommendationRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    recommendations: Array.isArray(row.recommendations)
      ? row.recommendations.map(sanitizeRecommendation)
      : [],
    summary: row.summary ?? "",
    limitations: row.limitations ?? [],
    needsMoreInformation: row.needs_more_information ?? false,
    missingInformation: row.missing_information ?? [],
    createdAt: row.created_at,
  };
}

/** Defensive client-side normalisation so the UI can trust the shape. */
function sanitizeRecommendation(value: unknown): CropRecommendation {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    crop: String(v.crop ?? "Crop").slice(0, 120),
    suitability: isValidSuitability(v.suitability)
      ? (v.suitability as CropSuitability)
      : "moderate",
    confidence: Math.max(0, Math.min(100, Math.round(Number(v.confidence) || 0))),
    whySuitable: String(v.why_suitable ?? "").slice(0, 600),
    soilFit: String(v.soil_fit ?? "").slice(0, 400),
    waterRequirement: String(v.water_requirement ?? "").slice(0, 400),
    weatherFit: String(v.weather_fit ?? "").slice(0, 400),
    keyConsiderations: Array.isArray(v.key_considerations)
      ? v.key_considerations.map((k) => String(k)).slice(0, 8)
      : [],
  };
}

function isValidSuitability(v: unknown): boolean {
  return v === "high" || v === "moderate" || v === "low";
}

async function edgeErrorToMessage(err: unknown): Promise<string> {
  const e = err as { context?: { text?: () => Promise<string> } };
  const fallback =
    "We couldn't generate crop recommendations right now. Please try again.";
  if (e?.context && typeof e.context.text === "function") {
    try {
      const text = await e.context.text();
      const parsed = JSON.parse(text) as { error?: string };
      return parsed.error || fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function friendlyError(err: unknown, fallback: string): never {
  console.error("crop-recommendation-service:", err);
  throw new Error(fallback);
}

/* ------------------------------------------------------------------ */
/* Edge Function call                                                  */
/* ------------------------------------------------------------------ */

export interface RequestCropRecommendationsInput {
  farmId: string;
  /** The already-loaded weather snapshot, if live weather is available. */
  weather?: RecommendationWeatherInput | null;
  /** App language ("en" | "ur") so the AI publishes in the right language. */
  language?: string;
}

export interface RequestRecommendationsResult {
  record: CropRecommendationRecord | null;
  insufficientData: boolean;
  missingInformation: string[];
}

/**
 * Ask the Edge Function to generate tailored crop recommendations for the
 * active farm. Handles both the normal path (a persisted record) and the
 * honest "we need more information" path. Throws a friendly message on any
 * genuine failure — never a raw error.
 */
export async function requestCropRecommendations(
  input: RequestCropRecommendationsInput
): Promise<RequestRecommendationsResult> {
  const { data, error } = await supabase.functions.invoke("recommend-crops", {
    body: {
      farmId: input.farmId,
      weather: input.weather ?? null,
      language: input.language ?? "en",
    },
  });

  if (error) {
    friendlyError(error, await edgeErrorToMessage(error));
  }

  const payload = data as {
    success?: boolean;
    insufficientData?: boolean;
    needsMoreInformation?: boolean;
    missingInformation?: string[];
    result?: CropRecommendationRow;
    error?: string;
  };

  if (!payload?.success) {
    const fallback =
      "We couldn't generate crop recommendations right now. Please try again.";
    friendlyError(payload?.error ?? new Error("request failed"), fallback);
  }

  // Honest missing-information state (no forged/fake data produced).
  if (payload.insufficientData || payload.needsMoreInformation) {
    return {
      record: null,
      insufficientData: true,
      missingInformation: payload.missingInformation ?? [],
    };
  }

  if (!payload.result) {
    friendlyError(
      new Error("missing result"),
      "We couldn't load the crop recommendations. Please try again."
    );
  }

  return {
    record: mapRow(payload.result as CropRecommendationRow),
    insufficientData: false,
    missingInformation: [],
  };
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

/**
 * Previous recommendations for a farm (latest first). Backed by real saved
 * records only — never mocked.
 */
export async function fetchCropRecommendations(
  farmId: string,
  limit = 10
): Promise<CropRecommendationRecord[]> {
  const { data, error } = await supabase
    .from("crop_recommendations")
    .select("*")
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("crop-recommendation-service:", error);
    throw new Error(
      "We couldn't load your previous crop recommendations. Please try again."
    );
  }
  return ((data as CropRecommendationRow[] | null) ?? []).map(mapRow);
}