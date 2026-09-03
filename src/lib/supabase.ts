import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase connection bootstrap.
 *
 * IMPORTANT: this module must NEVER throw at import time. Every feature module
 * imports it, so a module-load throw white-screens the whole app — including
 * the landing page, which needs no database at all. Instead we capture any
 * configuration problem here, expose a `supabaseReady` flag and a
 * `supabaseConfigError` message, and hand back a client that throws a clear,
 * actionable error only when some feature actually tries to use it.
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
 * when the variable is configured. This validation surfaces a clear, actionable
 * error instead of a cryptic fetch failure later.
 */
function readRequiredEnv(name: string, raw: string | undefined): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(
      `${name} is not set in this app bundle. If the variable is already listed in the Environment settings panel (with the VITE_ prefix), the running preview server is stale: stop and restart the preview so Vite re-reads the env vars — file edits alone don't reload them (HMR is disabled). If it is not listed at all, add ${name} in the Environment settings panel.`
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

/**
 * True when both required env vars were present and valid at startup, so a
 * real Supabase client could be created. Components use this to render a
 * friendly setup screen instead of crashing when the integration is missing.
 */
export const supabaseReady: boolean = (() => {
  try {
    resolveSupabaseUrl(readRequiredEnv("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL));
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
    readRequiredEnv("VITE_SUPABASE_ANON_KEY", anon);
    return true;
  } catch {
    return false;
  }
})();

/**
 * The human-readable reason Supabase is unavailable (or null when ready).
 * Shown verbatim on the setup screen so the user knows exactly what to fix.
 */
export const supabaseConfigError: string | null = (() => {
  if (supabaseReady) return null;
  try {
    resolveSupabaseUrl(readRequiredEnv("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL));
    readRequiredEnv("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY);
    return "Supabase configuration is incomplete.";
  } catch (err) {
    return err instanceof Error ? err.message : "Supabase configuration is incomplete.";
  }
})();

/**
 * Resolve the browser-safe API key to send with every request (only called
 * when `supabaseReady` is true, so it never throws at module scope).
 */
function resolveAnonKey(): string {
  const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof publishable === "string" && publishable.trim().length > 0) {
    return publishable.trim();
  }
  return readRequiredEnv("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY);
}

const supabaseUrl: string | null = (() => {
  if (!supabaseReady) return null;
  try {
    return resolveSupabaseUrl(
      readRequiredEnv("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL)
    );
  } catch {
    return null;
  }
})();

export const supabaseAnonKey: string | null = supabaseReady ? resolveAnonKey() : null;

const realClient: SupabaseClient | null = (() => {
  if (!supabaseReady || !supabaseUrl || !supabaseAnonKey) return null;
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Explicitly pin the auth flow type to `implicit` (the JavaScript
        // client default; PKCE is for SSR). The NativelyAI preview panel runs
        // the app inside a sandboxed iframe, where PKCE's redirect-with-code
        // exchange is unreliable. Implicit flow lets sign-in / sign-up
        // sessions be established directly in that context.
        flowType: "implicit",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    return null;
  }
})();

const NOT_READY_MESSAGE =
  "Supabase isn't configured yet, so this feature is unavailable right now. " +
  (supabaseConfigError ?? "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Environment settings panel.") +
  " Once configured, restart the preview server so the new variables take effect.";

/**
 * Shared Supabase client.
 *
 * When the integration is configured this is the real client. When it is not,
 * this is a throwing proxy: accessing ANY member throws the actionable
 * `NOT_READY_MESSAGE`. Feature code that calls `supabase.auth.getSession()`
 * or `supabase.from(...)` therefore fails with a clear, instructive error
 * instead of a cryptic `null` crash — and the UI can intercept it via the
 * usual try/catch paths. The landing page never touches this client, so it
 * stays fully functional even when the integration is missing.
 */
export const supabase: SupabaseClient = (() => {
  if (realClient) return realClient;

  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      // Symbol keys (e.g. Symbol.toStringTag / Promise internals) should not
      // throw — they are probed by libraries and devtools.
      if (typeof prop === "symbol") return undefined;
      throw new Error(NOT_READY_MESSAGE);
    },
  }) as SupabaseClient;
})();

/**
 * Non-secret connection details, useful for diagnostics. Never put the key
 * in here — the URL alone is enough to confirm which project is configured.
 * `host` is null when the integration is not ready.
 */
export const supabaseConfig: { url: string | null; host: string | null } = (() => {
  if (!supabaseUrl) return { url: null, host: null };
  try {
    return { url: supabaseUrl, host: new URL(supabaseUrl).host };
  } catch {
    return { url: null, host: null };
  }
})();

/**
 * Lightweight startup connectivity check. Runs once, fire-and-forget, and
 * converts a cryptic browser "Failed to fetch" into a clear PASS/FAIL log that
 * names the exact host the app is trying to reach — so a misconfigured
 * VITE_SUPABASE_URL is obvious instead of looking like a code bug.
 */
export interface SupabaseConnectivity {
  ok: boolean;
  host: string | null;
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
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      host: null,
      httpStatus: null,
      detail: "Supabase is not configured (missing or invalid VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).",
    };
  }
  const host = supabaseConfig.host;
  try {
    // Probe a real table query rather than the bare /rest/v1/ root, which
    // answers 401 for ANY key (even a valid one) and would be a false alarm.
    const res = await fetch(`${supabaseUrl}/rest/v1/farms?select=id&limit=1`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: "application/json",
      },
    });
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
