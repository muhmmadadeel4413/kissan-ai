import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * get-weather
 *
 * Securely fetches live weather for a farm location using OpenWeatherMap.
 *
 * Security model (mirrors analyze-crop):
 *  - The OpenWeatherMap API key lives ONLY in Supabase Edge Function secrets
 *    (OPENWEATHER_API_KEY). It is read here with Deno.env.get and never
 *    reaches the browser.
 *  - The client sends only the farm's location string. This function geocodes
 *    it to lat/lon, fetches current conditions + a 5-day forecast, aggregates
 *    the forecast into per-day summaries, and returns normalized JSON.
 *  - verify_jwt is disabled at the platform level (anon-based app, no user
 *    accounts); we do a lightweight Bearer JWT sanity check here.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";
const CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Convert m/s to km/h (OpenWeatherMap reports wind in m/s in metric mode). */
function toKmh(ms: number): number {
  return Math.round(ms * 3.6);
}

/** Coerce a value to a finite number, falling back to 0 (never NaN). */
function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface GeoPlace {
  lat?: number;
  lon?: number;
  name?: string;
  country?: string;
  state?: string;
}

/**
 * Build progressively-simplified search queries for a free-text location.
 *
 * Farm locations are typed by hand and often aren't an exact place name
 * (e.g. "Faisalabad Chiniot" — two neighbouring cities typed together).
 * OpenWeatherMap's geocoder returns nothing for those, so we derive a list of
 * fallback queries: the exact string, comma-separated parts, token reductions,
 * and (as a last resort) a country hint.
 */
function locationCandidates(raw: string): string[] {
  const clean = raw.trim().replace(/\s+/g, " ");
  if (!clean) return [];

  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    const t = q.trim().replace(/\s+/g, " ");
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      candidates.push(t);
    }
  };

  push(clean); // exact match first

  // Comma-separated parts, longest first (e.g. "Faisalabad, Punjab, Pakistan").
  const parts = clean
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  [...parts]
    .sort((a, b) => b.length - a.length)
    .forEach(push);

  // Token reductions: first two tokens, then first token, then last token.
  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length > 2) push(tokens.slice(0, 2).join(" "));
  if (tokens.length > 1) {
    push(tokens[0]);
    push(tokens[tokens.length - 1]);
  }

  // Country hint as a last resort, unless the query already mentions one.
  const hasCountry = /pakistan|india|bangladesh|\bPK\b|\bIN\b|,\s*[A-Z]{2}$/i.test(clean);
  if (!hasCountry) {
    for (const q of [...candidates]) push(`${q}, Pakistan`);
  }

  return candidates;
}

/**
 * Geocode a free-text location, trying progressively simpler forms.
 * Returns the best place found, or null if nothing matched.
 */
async function geocodeLocation(query: string, apiKey: string): Promise<GeoPlace | null> {
  const candidates = locationCandidates(query);
  for (const candidate of candidates) {
    try {
      const resp = await fetch(
        `${GEO_URL}?q=${encodeURIComponent(candidate)}&limit=5&appid=${apiKey}`
      );
      if (!resp.ok) continue;
      const list = (await resp.json()) as GeoPlace[];
      if (!Array.isArray(list) || list.length === 0) continue;

      // Prefer an exact-ish name match; otherwise use the first result.
      const lowerQuery = candidate.toLowerCase();
      const match =
        list.find((p) => {
          const name = (p.name ?? "").toLowerCase();
          return name === lowerQuery || name.includes(lowerQuery) || lowerQuery.includes(name);
        }) ?? list[0];
      return match;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/**
 * Map a forecast 3-hour entry into a "local date" string using the city's
 * UTC offset so daily grouping matches the farmer's calendar, not UTC.
 */
function localDateFrom(unixSeconds: number, tzSeconds: number): string {
  return new Date((unixSeconds + tzSeconds) * 1000).toISOString().slice(0, 10);
}

interface DayAcc {
  date: string;
  max: number;
  min: number;
  pop: number;
  wind: number;
  humiditySum: number;
  humidityCount: number;
  condition: string;
  conditionCode: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Lightweight JWT sanity check (anon-based app).
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.split(".").length !== 3) {
    return json(
      { success: false, error: "This request is not authorized. Please try again." },
      401
    );
  }

  const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
  if (!apiKey) {
    return json(
      {
        success: false,
        error:
          "Live weather isn't configured yet. Add the OpenWeatherMap API key (OPENWEATHER_API_KEY) in the project settings to enable weather for your farm.",
      },
      503
    );
  }

  let body: { location?: string };
  try {
    body = await req.json();
  } catch {
    return json(
      { success: false, error: "We couldn't read your request. Please try again." },
      400
    );
  }

  const location = (body?.location ?? "").trim();
  if (!location) {
    return json(
      { success: false, error: "No farm location was provided. Please add one on your farm profile." },
      400
    );
  }

  // 1) Geocode the farm location string -> lat/lon.
  //    Free-text farm locations often aren't an exact OpenWeatherMap place
  //    name (e.g. "Faisalabad Chiniot"), so we try progressively simpler
  //    forms before giving up.
  const place = await geocodeLocation(location, apiKey);
  if (!place || typeof place.lat !== "number" || typeof place.lon !== "number") {
    console.log("get-weather: no geocode match for", JSON.stringify(location));
    return json(
      {
        success: false,
        error: `We couldn't find "${location}" on the map. Please check the location saved on your farm profile.`,
      },
      404
    );
  }

  // 2) Fetch current conditions.
  let currentRaw: any;
  try {
    const resp = await fetch(
      `${CURRENT_URL}?lat=${place.lat}&lon=${place.lon}&units=metric&appid=${apiKey}`
    );
    if (!resp.ok) {
      return json(
        { success: false, error: "We couldn't load the current weather. Please try again." },
        502
      );
    }
    currentRaw = await resp.json();
  } catch {
    return json(
      { success: false, error: "We couldn't load the current weather. Please try again." },
      502
    );
  }

  // 3) Fetch the 5-day / 3-hour forecast.
  let forecastRaw: any;
  try {
    const resp = await fetch(
      `${FORECAST_URL}?lat=${place.lat}&lon=${place.lon}&units=metric&cnt=40&appid=${apiKey}`
    );
    if (!resp.ok) {
      return json(
        { success: false, error: "We couldn't load the weather forecast. Please try again." },
        502
      );
    }
    forecastRaw = await resp.json();
  } catch {
    return json(
      { success: false, error: "We couldn't load the weather forecast. Please try again." },
      502
    );
  }

  // 4) Aggregate the 3-hourly entries into per-day summaries (max 5 days).
  const tz = typeof forecastRaw?.city?.timezone === "number" ? forecastRaw.city.timezone : 0;
  const days = new Map<string, DayAcc>();

  for (const item of forecastRaw?.list ?? []) {
    const date = localDateFrom(item.dt, tz);
    const temp = safeNum(item.main?.temp);
    const acc: DayAcc = days.get(date) ?? {
      date,
      max: -Infinity,
      min: Infinity,
      pop: 0,
      wind: 0,
      humiditySum: 0,
      humidityCount: 0,
      condition: item.weather?.[0]?.description ?? "Conditions",
      conditionCode: item.weather?.[0]?.main ?? "",
    };
    acc.max = Math.max(acc.max, safeNum(item.main?.temp_max) || temp);
    acc.min = Math.min(acc.min, safeNum(item.main?.temp_min) || temp);
    acc.pop = Math.max(acc.pop, safeNum(item.pop));
    acc.wind = Math.max(acc.wind, safeNum(item.wind?.speed));
    acc.humiditySum += safeNum(item.main?.humidity);
    acc.humidityCount += 1;
    // Prefer the midday entry as the day's representative condition.
    const hour = new Date((item.dt + tz) * 1000).getUTCHours();
    if (hour === 12 && item.weather?.[0]) {
      acc.condition = item.weather[0].description ?? acc.condition;
      acc.conditionCode = item.weather[0].main ?? acc.conditionCode;
    }
    days.set(date, acc);
  }

  const sorted = [...days.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 5);

  const forecast = sorted.map((d) => ({
    date: d.date,
    condition: d.condition,
    conditionCode: d.conditionCode,
    temperatureMax: Math.round(d.max),
    temperatureMin: Math.round(d.min),
    rainProbability: Math.round(d.pop * 100),
    windSpeed: toKmh(d.wind),
    humidity: d.humidityCount > 0 ? Math.round(d.humiditySum / d.humidityCount) : 0,
  }));

  // 5) Build the current-conditions payload. Rain probability for "today"
  // comes from the current day's forecast (OpenWeatherMap does not expose
  // probability on the current-weather endpoint).
  const todayDate = localDateFrom(Math.floor(Date.now() / 1000), tz);
  const todayDay = sorted.find((d) => d.date === todayDate);

  const weather = {
    current: {
      temperature: Math.round(safeNum(currentRaw?.main?.temp)),
      feelsLike: Math.round(safeNum(currentRaw?.main?.feels_like) || safeNum(currentRaw?.main?.temp)),
      humidity: Math.round(safeNum(currentRaw?.main?.humidity)),
      rainProbability: Math.round((todayDay?.pop ?? 0) * 100),
      windSpeed: toKmh(safeNum(currentRaw?.wind?.speed)),
      condition: currentRaw?.weather?.[0]?.description ?? "Conditions",
      conditionCode: currentRaw?.weather?.[0]?.main ?? "",
      capturedAt: new Date().toISOString(),
    },
    forecast,
    location: {
      name: place.name ?? location,
      country: place.country ?? "",
    },
  };

  return json({ success: true, weather });
});