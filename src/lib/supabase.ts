import { createClient } from "@supabase/supabase-js";

/**
 * Read and validate the Supabase connection settings.
 *
 * A "TypeError: Failed to fetch" in the console almost always means the
 * browser could not complete the request to Supabase at the network level —
 * usually because the configured URL is malformed (stray whitespace, a
 * trailing slash, a placeholder value) or points at the wrong project. We
 * normalise and validate here, at module load, so those mistakes surface as
 * a clear, actionable error instead of a cryptic fetch failure later.
 */

/**
 * Validate a raw env value that has already been read via a static
 * `import.meta.env.VITE_*` access.
 *
 * We deliberately read env vars through LITERAL property access
 * (`import.meta.env.VITE_SUPABASE_URL`) rather than a dynamic string key
 * (`import.meta.env[name]`): Vite statically replaces only the literal forms
 * during `vite build` and does NOT replace dynamic `import.meta.env[key]`
 * access, so the latter resolves to `undefined` in the production bundle even
 * when the variable is configured. This module-load-time validation surfaces a
 * clear, actionable error instead of a cryptic fetch failure later.
 */
function readRequiredEnv(name: string, raw: string | undefined): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(
      `Supabase is not configured. Add ${name} in the Environment settings panel (it must use the VITE_ prefix to be exposed to the browser).`
    );
  }
  return raw.trim();
}

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes("your_supabase") ||
    lower.includes("your-supabase") ||
    lower.includes("placeholder") ||
    lower.includes("example.com") ||
    lower === "https://your-project.supabase.co" ||
    lower.startsWith("http://localhost") ||
    lower.startsWith("https://localhost")
  );
}

function resolveSupabaseUrl(raw: string): string {
  // Normalise: strip trailing slashes so we never double-slam a path segment.
  const url = raw.replace(/\/+$/, "");

  if (isPlaceholder(url)) {
    throw new Error(
      `VITE_SUPABASE_URL looks like a placeholder ("${url}"). Set it to your real project URL, e.g. https://vxldkzrmtygurdggtjro.supabase.co, in the Environment settings panel.`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `VITE_SUPABASE_URL is not a valid URL ("${url}"). It should look like https://<project-ref>.supabase.co. Fix it in the Environment settings panel.`
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `VITE_SUPABASE_URL must use https:// (got "${parsed.protocol}//"). An http:// API called from an https:// page is blocked by the browser as mixed content, which shows up as "Failed to fetch". Fix it in the Environment settings panel.`
    );
  }

  if (!parsed.hostname.endsWith("supabase.co")) {
    throw new Error(
      `VITE_SUPABASE_URL host "${parsed.hostname}" does not look like a Supabase project (expected *.supabase.co). Fix it in the Environment settings panel.`
    );
  }

  return url;
}

const supabaseUrl = resolveSupabaseUrl(
  readRequiredEnv("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL)
);

/**
 * Resolve the browser-safe API key to send with every request.
 *
 * Project credentials are usually configured as VITE_SUPABASE_ANON_KEY (legacy
 * JWT). Newer projects expose a modern publishable key instead
 * (VITE_SUPABASE_PUBLISHABLE_KEY, format "sb_publishable_..."). We prefer the
 * publishable key when it is set (it is the recommended, independently
 * rotatable credential) and fall back to the legacy anon key otherwise, so the
 * app works whichever key the environment is populated with.
 *
 * Like the anon key, the publishable key is safe to ship to the browser: it is
 * a public credential, and Row Level Security governs what it can read/write.
 */
export const supabaseAnonKey: string = (() => {
  const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof publishable === "string" && publishable.trim().length > 0) {
    return publishable.trim();
  }
  return readRequiredEnv("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY);
})();

/**
 * Shared Supabase client.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Non-secret connection details, useful for diagnostics. Never put the key
 * in here — the URL alone is enough to confirm which project is configured.
 */
export const supabaseConfig = {
  url: supabaseUrl,
  host: new URL(supabaseUrl).host,
} as const;

/**
 * Lightweight startup connectivity check. Runs once, fire-and-forget, and
 * converts a cryptic browser "Failed to fetch" into a clear PASS/FAIL log that
 * names the exact host the app is trying to reach — so a misconfigured
 * VITE_SUPABASE_URL is obvious instead of looking like a code bug.
 */
export interface SupabaseConnectivity {
  ok: boolean;
  host: string;
  httpStatus: number | null;
  detail: string;
}

let connectivityCache: Promise<SupabaseConnectivity> | null = null;

export function checkSupabaseConnectivity(): Promise<SupabaseConnectivity> {
  if (!connectivityCache) {
    connectivityCache = runConnectivityCheck();
  }
  return connectivityCache;
}

async function runConnectivityCheck(): Promise<SupabaseConnectivity> {
  const host = supabaseConfig.host;
  try {
    // Probe a real table query rather than the bare /rest/v1/ root, which
    // answers 401 for ANY key (even a valid one) and would be a false alarm.
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/farms?select=id&limit=1`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          Accept: "application/json",
        },
      }
    );
    if (res.ok) {
      return { ok: true, host, httpStatus: res.status, detail: "connected" };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        host,
        httpStatus: res.status,
        detail: `Supabase rejected the request with HTTP ${res.status} — the URL or API key configured for this environment is wrong.`,
      };
    }
    // Any other status (e.g. 404 if the farms table is missing) means the
    // project is reachable and authenticated — that is a schema issue, not a
    // connectivity failure.
    return {
      ok: true,
      host,
      httpStatus: res.status,
      detail: `connected (project reachable; table query returned HTTP ${res.status})`,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    return {
      ok: false,
      host,
      httpStatus: null,
      detail: `The browser could not reach ${host} (${reason}). Check that VITE_SUPABASE_URL in Environment settings is exactly https://vxldkzrmtygurdggtjro.supabase.co and that the environment allows outbound https requests.`,
    };
  }
}

// Run the check once at startup and log the result clearly.
if (typeof window !== "undefined") {
  void checkSupabaseConnectivity().then((result) => {
    if (result.ok) {
      console.info(`[supabase] connectivity OK — ${result.host} (HTTP ${result.httpStatus})`);
    } else {
      console.warn(`[supabase] connectivity FAILED — ${result.detail}`);
    }
  });
}