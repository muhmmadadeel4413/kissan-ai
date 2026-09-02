import { supabase } from "./supabase";
import type { Diagnosis, Severity } from "../types";

/**
 * Crop Doctor data layer.
 *
 * The real diagnosis happens server-side in the `analyze-crop` Edge Function
 * (which owns the Gemini API key). The browser only ever:
 *   1. prepares/compresses a photo,
 *   2. uploads it to the public `crop-images` bucket,
 *   3. asks the Edge Function to analyze the uploaded photo,
 *   4. reads back saved diagnoses for the history page.
 *
 * No AI key ever reaches client code.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Row shape from the `diagnoses` table (snake_case). */
export interface DiagnosisRow {
  id: string;
  farm_id: string | null;
  crop: string;
  diagnosis: string;
  severity: Severity;
  confidence: number;
  description: string | null;
  causes: string[] | null;
  recommended_actions: string[] | null;
  notes: string | null;
  image_url: string | null;
  created_at: string;
}

function mapRow(row: DiagnosisRow): Diagnosis {
  return {
    id: row.id,
    farmId: row.farm_id ?? undefined,
    crop: row.crop,
    diagnosis: row.diagnosis,
    severity: row.severity,
    confidence: row.confidence,
    description: row.description ?? undefined,
    causes: row.causes ?? undefined,
    recommendedActions: row.recommended_actions ?? undefined,
    notes: row.notes ?? undefined,
    imageUrl: row.image_url ?? undefined,
    createdAt: row.created_at,
  };
}

/** Never surface raw DB/network errors to the UI. */
function friendlyError(err: unknown, fallback: string): never {
  console.error("diagnosis-service:", err);
  throw new Error(fallback);
}

/* ------------------------------------------------------------------ */
/* Image preparation (client-side only)                                */
/* ------------------------------------------------------------------ */

/**
 * Downscale + re-encode an image to a JPEG no larger than `maxDimension`
 * on the longest side. Keeps uploads small and Gemini requests fast.
 * Accepts any browser-supported image (file input / camera capture).
 */
export async function prepareImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // Fallback: return the original file unchanged if canvas is unavailable.
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    return blob ?? file;
  } finally {
    bitmap.close();
  }
}

/**
 * Upload a prepared image to the crop-images bucket → public URL.
 *
 * The object is stored under `diagnoses/<farmId>/<uuid>` so row-level
 * security on storage can scope every image to the farm that owns it. The
 * farm ID is taken from the authenticated user's active (owned) farm — it is
 * never a user-chosen arbitrary identifier that could cross ownership.
 */
export async function uploadCropImage(
  blob: Blob,
  file: File,
  farmId?: string
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
  const folder = farmId ? `diagnoses/${farmId}` : "diagnoses";
  const path = `${folder}/${crypto.randomUUID()}.${safeExt}`;

  const { error } = await supabase.storage
    .from("crop-images")
    .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });

  if (error) {
    friendlyError(error, "We couldn't upload your photo. Please try again.");
  }

  const { data } = supabase.storage.from("crop-images").getPublicUrl(path);
  return data.publicUrl;
}

/* ------------------------------------------------------------------ */
/* Edge Function call                                                  */
/* ------------------------------------------------------------------ */

export interface AnalyzeCropInput {
  imageUrl: string;
  farmId?: string;
  cropName?: string;
  growthStage?: string;
  variety?: string;
  location?: string;
}

/** Extract a human-friendly message from a Supabase Edge Function error. */
async function edgeErrorToMessage(err: unknown): Promise<string> {
  const e = err as {
    context?: { text?: () => Promise<string> };
    message?: string;
  };
  // Supabase FunctionsHttpError exposes the function's JSON response.
  if (e?.context && typeof e.context.text === "function") {
    try {
      const text = await e.context.text();
      const parsed = JSON.parse(text) as { error?: string };
      return parsed.error || "The analysis failed. Please try again.";
    } catch {
      return "The analysis failed. Please try again.";
    }
  }
  return e?.message || "The analysis failed. Please try again.";
}

/**
 * Ask the Edge Function to diagnose the uploaded photo.
 * Returns the persisted diagnosis row mapped to the app type.
 */
export async function analyzeCropPhoto(input: AnalyzeCropInput): Promise<Diagnosis> {
  const { data, error } = await supabase.functions.invoke("analyze-crop", {
    body: input,
  });

  if (error) {
    friendlyError(error, await edgeErrorToMessage(error));
  }

  const payload = data as { success?: boolean; diagnosis?: DiagnosisRow; error?: string };
  if (!payload?.success || !payload.diagnosis) {
    friendlyError(payload?.error, payload?.error || "The analysis failed. Please try again.");
  }
  return mapRow(payload.diagnosis as DiagnosisRow);
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

/** Latest-first diagnosis history, optionally scoped to a farm. */
export async function fetchDiagnoses(farmId?: string | null): Promise<Diagnosis[]> {
  let query = supabase
    .from("diagnoses")
    .select("*")
    .order("created_at", { ascending: false });

  if (farmId) query = query.eq("farm_id", farmId);

  const { data, error } = await query;
  if (error) {
    friendlyError(error, "We couldn't load your diagnosis history. Please try again.");
  }
  return (data as DiagnosisRow[] | null)?.map(mapRow) ?? [];
}