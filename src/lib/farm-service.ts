import { supabase } from "./supabase";
import { isNetworkError, networkErrorMessage } from "./supabase-errors";
import { Farm, FarmSetupInput } from "../types";

/** Raw row shape from the `farms` table (snake_case, matches the schema). */
export interface FarmRow {
  id: string;
  farmer_name: string;
  phone: string | null;
  email: string | null;
  location: string;
  land_area: string;
  soil_type: string;
  irrigation_method: string;
  current_crop: string;
  current_crop_variety: string | null;
  planting_date: string | null;
  created_at: string;
}

function optional(value: string | null): string | undefined {
  return value ?? undefined;
}

function rowToFarm(row: FarmRow): Farm {
  return {
    id: row.id,
    farmerName: row.farmer_name,
    phone: optional(row.phone),
    email: optional(row.email),
    location: row.location,
    landArea: row.land_area,
    soilType: row.soil_type,
    irrigationMethod: row.irrigation_method,
    currentCrop: row.current_crop,
    currentCropVariety: optional(row.current_crop_variety),
    plantingDate: optional(row.planting_date),
    createdAt: row.created_at,
  };
}

/** Map a partial form input to snake_case DB columns (only provided fields). */
function farmInputToRow(input: Partial<FarmSetupInput>): Record<string, string | null> {
  const row: Record<string, string | null> = {};
  if (input.farmerName !== undefined) row.farmer_name = input.farmerName;
  if (input.phone !== undefined) row.phone = input.phone || null;
  if (input.email !== undefined) row.email = input.email || null;
  if (input.location !== undefined) row.location = input.location;
  if (input.landArea !== undefined) row.land_area = input.landArea;
  if (input.soilType !== undefined) row.soil_type = input.soilType;
  if (input.irrigationMethod !== undefined) row.irrigation_method = input.irrigationMethod;
  if (input.currentCrop !== undefined) row.current_crop = input.currentCrop;
  if (input.currentCropVariety !== undefined) row.current_crop_variety = input.currentCropVariety || null;
  if (input.plantingDate !== undefined) row.planting_date = input.plantingDate || null;
  return row;
}

/**
 * Never surface raw database messages to the user. Log for diagnostics and
 * throw a human, actionable message instead. Network-level failures (e.g. a
 * browser "Failed to fetch" when the page cannot reach Supabase) get their
 * own message so the cause is clear instead of a generic "please try again".
 */
function friendlyError(err: unknown, fallback: string): never {
  console.error("farm-service:", err);
  if (isNetworkError(err)) {
    throw new Error(networkErrorMessage());
  }
  throw new Error(fallback);
}

/** Fetch a single farm by its UUID. Returns null when no row matches. */
export async function fetchFarm(id: string): Promise<Farm | null> {
  try {
    const { data, error } = await supabase
      .from("farms")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      friendlyError(error, "We couldn't load your farm. Please check your connection and try again.");
    }
    return data ? rowToFarm(data as FarmRow) : null;
  } catch (err) {
    // supabase-js can throw (not return) on network-level failures — route
    // those through the same friendly handler so the user gets the host-aware
    // message instead of a raw "TypeError: Failed to fetch".
    friendlyError(err, "We couldn't load your farm. Please check your connection and try again.");
  }
}

/**
 * Fetch the authenticated user's first owned farm.
 *
 * Row Level Security scopes this query to farms owned by the current signed-in
 * user (user_id = auth.uid()), so it can never return another user's farm —
 * even if a stale ID was left in browser storage. Returns null when the user
 * has no farm yet (e.g. right after signup).
 */
export async function fetchFarmByOwner(): Promise<Farm | null> {
  try {
    const { data, error } = await supabase
      .from("farms")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      friendlyError(error, "We couldn't load your farm. Please check your connection and try again.");
    }
    return data ? rowToFarm(data as FarmRow) : null;
  } catch (err) {
    friendlyError(err, "We couldn't load your farm. Please check your connection and try again.");
  }
}

/** Insert a new farm row and return the created farm (with its UUID). */
export async function createFarmRecord(input: FarmSetupInput): Promise<Farm> {
  try {
    const { data, error } = await supabase
      .from("farms")
      .insert(farmInputToRow(input))
      .select()
      .single();

    if (error) {
      friendlyError(error, "We couldn't save your farm. Please try again.");
    }
    return rowToFarm(data as FarmRow);
  } catch (err) {
    friendlyError(err, "We couldn't save your farm. Please try again.");
  }
}

/** Update an existing farm row and return the updated farm. */
export async function updateFarmRecord(
  id: string,
  patch: Partial<FarmSetupInput>
): Promise<Farm> {
  try {
    const { data, error } = await supabase
      .from("farms")
      .update(farmInputToRow(patch))
      .eq("id", id)
      .select()
      .single();

    if (error) {
      friendlyError(error, "We couldn't save your changes. Please try again.");
    }
    return rowToFarm(data as FarmRow);
  } catch (err) {
    friendlyError(err, "We couldn't save your changes. Please try again.");
  }
}

/** Delete a farm row by its UUID. */
export async function deleteFarmRecord(id: string): Promise<void> {
  try {
    const { error } = await supabase.from("farms").delete().eq("id", id);
    if (error) {
      friendlyError(error, "We couldn't remove your farm data. Please try again.");
    }
  } catch (err) {
    friendlyError(err, "We couldn't remove your farm data. Please try again.");
  }
}