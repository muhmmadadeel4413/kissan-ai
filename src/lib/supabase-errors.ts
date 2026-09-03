import { supabaseConfig } from "./supabase";

/** The host this app's Supabase project should be pointed at. */
export const EXPECTED_SUPABASE_HOST = "vxldkzrmtygurdggtjro.supabase.co";
/**
 * Detect browser-level network failures ("TypeError: Failed to fetch" and
 * friends). These mean the HTTP request never completed — the browser could
 * not reach the configured Supabase URL. That is different from a server
 * error (4xx/5xx), which Supabase returns as a normal HTTP response.
 */
export function isNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("fetch failed") ||
    message.includes("Load failed") ||
    message.includes("Network request failed")
  );
}

/**
 * Human-friendly message for a network failure that includes the host the app
 * is actually configured to reach, so a wrong/stale URL is instantly obvious.
 */
export function networkErrorMessage(): string {
  const configured = supabaseConfig.host;
  if (!configured) {
    return (
      "We couldn't reach the app's database because Supabase isn't configured yet. " +
      "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Environment settings panel, " +
      "then restart the preview server."
    );
  }
  const onPoint =
    configured === EXPECTED_SUPABASE_HOST
      ? `The app is set to reach ${configured}, which looks correct.`
      : `The app is set to reach ${configured}, but it should be ${EXPECTED_SUPABASE_HOST}.`;

  return (
    `We couldn't reach the app's database. ${onPoint} This is usually a ` +
    "temporary network issue or a misconfigured URL. Check VITE_SUPABASE_URL " +
    "and VITE_SUPABASE_ANON_KEY in the Environment settings panel."
  );
}