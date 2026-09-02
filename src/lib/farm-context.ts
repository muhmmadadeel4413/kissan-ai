import { fetchFarm } from "./farm-service";
import { getGrowthStage } from "./growth-stage";
import type { Farm, FarmContext, FarmContextResult } from "../types";

/**
 * Farm Context Engine.
 *
 * Collects the relevant farm information from Supabase and combines it with
 * the deterministic growth-stage information into one reusable `FarmContext`.
 * Every future Kissan AI feature (Crop Doctor, AI Chat, Risk Engine) should
 * consume this same structure so they never independently query `farms` or
 * re-derive crop age — preventing inconsistent information between features.
 */

/** Build a Farm Context from an already-loaded farm record (pure). */
export function buildFarmContext(farm: Farm): FarmContext {
  return {
    farm,
    crop: {
      name: farm.currentCrop,
      variety: farm.currentCropVariety ?? null,
      plantingDate: farm.plantingDate ?? null,
    },
    growth: getGrowthStage(farm.currentCrop, farm.plantingDate),
  };
}

/**
 * Load the Farm Context for the active farm by its Supabase ID.
 *
 * Never throws to the UI — missing ID, missing record, and Supabase failures
 * are all returned as structured results with human-friendly messages.
 */
export async function getFarmContext(
  activeFarmId: string | null | undefined
): Promise<FarmContextResult> {
  if (!activeFarmId) {
    return {
      status: "no_farm",
      context: null,
      message: "No active farm selected. Please set up your farm first.",
    };
  }

  try {
    const farm = await fetchFarm(activeFarmId);
    if (!farm) {
      return {
        status: "not_found",
        context: null,
        message: "Farm profile could not be found.",
      };
    }
    return { status: "ready", context: buildFarmContext(farm) };
  } catch (err) {
    console.error("farm-context:", err);
    return {
      status: "error",
      context: null,
      message: "Unable to load farm information. Please try again.",
    };
  }
}