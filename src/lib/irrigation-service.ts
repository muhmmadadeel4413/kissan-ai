import { supabase } from "./supabase";
import type {
  IrrigationRecommendation,
  IrrigationRecommendationRecord,
} from "../types";

/**
 * Irrigation Advisor — client data layer (Prompt 14).
 *
 * The real irrigation reasoning happens server-side in the `irrigation-advisor`
 * Edge Function (which owns the Gemini API key, validates the farm, runs the
 * deterministic rain-aware rules, and persists the record via the service
 * role). The browser only:
 *   1. sends the active farm id + the already-fetched weather snapshot,
 *   2. reads back saved irrigation records for the history section.
 *
 * No AI key ever reaches client code, and records are RLS-scoped to owned
 * farms. Nothing here is ever fabricated.
 */

/* ------------------------------------------------------------------ */
/* Row shape from the `irrigation_recommendations` table (snake_case)  */
/* ------------------------------------------------------------------ */

export interface IrrigationRecommendationRow {
  id: string;
  farm_id: string;
  recommendation: IrrigationRecommendation;
  summary: string;
  limitations: string[];
  needs_more_information: boolean;
  missing_information: string[];
  created_at: string;
}

/** The snapshot of weather we forward so advice reflects live data. */
export interface IrrigationWeatherInput {
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

function normalizeRecommendation(raw: unknown): IrrigationRecommendation {
  if (!raw || typeof raw !== "object") return sanitizeEmptyRecommendation();
  const r = raw as Record<string, unknown>;

  const status = (String(r.status ?? r.irrigation_status ?? "adequate")) as IrrigationRecommendation["status"];
  const urgency = (String(r.urgency ?? "low")) as IrrigationRecommendation["urgency"];
  const recommendation = String(r.recommendation ?? r.summary ?? "");

  const rawWg = (typeof r.waterGuidance === "object" && r.waterGuidance
    ? r.waterGuidance
    : typeof r.water_guidance === "object" && r.water_guidance
    ? r.water_guidance
    : {}) as Record<string, unknown>;

  const waterGuidance = {
    amount: String(rawWg.amount ?? ""),
    unit: String(rawWg.unit ?? ""),
    confidence: Number(rawWg.confidence ?? 0),
    relative: String(rawWg.relative ?? r.water_guidance_relative ?? ""),
  };

  const rawTiming = (typeof r.timing === "object" && r.timing ? r.timing : null) as Record<string, unknown> | null;
  const timing = rawTiming
    ? {
        recommended_time: String(rawTiming.recommended_time ?? rawTiming.recommendedTime ?? ""),
        reason: String(rawTiming.reason ?? ""),
      }
    : null;

  return {
    status,
    urgency,
    recommendation,
    timing,
    waterGuidance,
    weatherImpact: String(r.weatherImpact ?? r.weather_impact ?? ""),
    soilImpact: String(r.soilImpact ?? r.soil_impact ?? ""),
    cropStageImpact: String(r.cropStageImpact ?? r.crop_stage_impact ?? ""),
    rainAdjustment: String(r.rainAdjustment ?? r.rain_adjustment ?? ""),
    nextCheck: String(r.nextCheck ?? r.next_check ?? ""),
    importantNotes: (Array.isArray(r.importantNotes)
      ? r.importantNotes
      : Array.isArray(r.important_notes)
      ? r.important_notes
      : []) as string[],
    limitations: (Array.isArray(r.limitations) ? r.limitations : []) as string[],
  };
}

function mapRow(row: IrrigationRecommendationRow): IrrigationRecommendationRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    recommendation: normalizeRecommendation(row.recommendation),
    summary: row.summary ?? "",
    limitations: Array.isArray(row.limitations) ? row.limitations : [],
    needsMoreInformation: row.needs_more_information ?? false,
    missingInformation: Array.isArray(row.missing_information)
      ? row.missing_information
      : [],
    createdAt: row.created_at,
  };
}

/** Honest fallback if a stored recommendation is somehow empty. */
function sanitizeEmptyRecommendation(): IrrigationRecommendation {
  return {
    status: "insufficient",
    urgency: "low",
    recommendation:
      "This irrigation record is missing its recommendation. Please run the Irrigation Advisor again.",
    timing: null,
    waterGuidance: { amount: "", unit: "", confidence: 0, relative: "" },
    weatherImpact: "",
    soilImpact: "",
    cropStageImpact: "",
    rainAdjustment: "",
    nextCheck: "",
    importantNotes: [],
    limitations: [],
  };
}

/** Never surface raw DB/network errors to the UI. */
function friendlyError(err: unknown, fallback: string): never {
  console.error("irrigation-service:", err);
  throw new Error(fallback);
}

/** Extract a human-friendly message from a Supabase Edge Function error. */
async function edgeErrorToMessage(err: unknown): Promise<string> {
  const e = err as { context?: { text?: () => Promise<string> } };
  const fallback =
    "We couldn't generate irrigation advice right now. Please try again.";
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

/* ------------------------------------------------------------------ */
/* Edge Function call                                                  */
/* ------------------------------------------------------------------ */

export interface RequestIrrigationAdviceInput {
  farmId: string;
  /** The already-loaded weather snapshot, if live weather is available. */
  weather?: IrrigationWeatherInput | null;
  /** App language ("en" | "ur") so the AI publishes in the right language. */
  language?: string;
}

export interface RequestIrrigationResult {
  record: IrrigationRecommendationRecord | null;
  insufficientData: boolean;
  missingInformation: string[];
}

/**
 * Ask the Edge Function to generate tailored irrigation advice for the active
 * farm. Handles both the normal path (a persisted record) and the honest
 * missing-information path. Throws a friendly message on any genuine failure.
 */
export async function requestIrrigationAdvice(
  input: RequestIrrigationAdviceInput
): Promise<RequestIrrigationResult> {
  const { data, error } = await supabase.functions.invoke("irrigation-advisor", {
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
    result?: IrrigationRecommendationRow;
    error?: string;
  };

  if (!payload?.success) {
    const fallback =
      "We couldn't generate irrigation advice right now. Please try again.";
    friendlyError(payload?.error ?? new Error("request failed"), fallback);
  }

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
      "We couldn't load the irrigation advice. Please try again."
    );
  }

  return {
    record: mapRow(payload.result as IrrigationRecommendationRow),
    insufficientData: false,
    missingInformation: [],
  };
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

/**
 * Previous irrigation recommendations for a farm (latest first). Backed by
 * real saved records only.
 */
export async function fetchIrrigationHistory(
  farmId: string,
  limit = 10
): Promise<IrrigationRecommendationRecord[]> {
  const { data, error } = await supabase
    .from("irrigation_recommendations")
    .select("*")
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("irrigation-service:", error);
    throw new Error(
      "We couldn't load your previous irrigation advice. Please try again."
    );
  }
  return ((data as IrrigationRecommendationRow[] | null) ?? []).map(mapRow);
}