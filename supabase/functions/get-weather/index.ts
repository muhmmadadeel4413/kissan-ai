import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * get-weather
 *
 * Securely fetches live weather for a farm location using Open-Meteo.
 *
 * Security model:
 *  - Open-Meteo is a free, no-key API — no secrets needed.
 *  - The client sends only the farm's location string. This function geocodes
 *    it to lat/lon, fetches current conditions + a 7-day forecast with hourly
 *    detail, aggregates into per-day summaries, and returns normalized JSON.
 *  - verify_jwt is disabled at the platform level (anon-based app); we do a
 *    lightweight Bearer JWT sanity check here.
 *
 * Data includes soil moisture and ET0 (evapotranspiration) for irrigation
 * support — these are null if the provider doesn't return them.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Origins permitted to call this Edge Function (preflight gate). */
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "https://vxldkzrmtygurdggtjro.supabase.co",
];

function corsForOrigin(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
  };
}

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Coerce a value to a finite number, falling back to 0 (never NaN). */
function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce a value to a finite number or null. */
function safeNumOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

interface GeoPlace {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  admin1?: string;
  timezone?: string;
}

/**
 * Known province/state to major city mappings for fallback geocoding.
 * When a user enters a province name, we try the major city in that province.
 */
const PROVINCE_TO_CITY: Record<string, string> = {
  // Pakistan
  punjab: "Lahore",
  sindh: "Karachi",
  "khyber pakhtunkhwa": "Peshawar",
  kpk: "Peshawar",
  balochistan: "Quetta",
  "azad kashmir": "Muzaffarabad",
  gilgit: "Gilgit",
  // India
  maharashtra: "Mumbai",
  "uttar pradesh": "Lucknow",
  "tamil nadu": "Chennai",
  karnataka: "Bangalore",
  gujarat: "Ahmedabad",
  rajasthan: "Jaipur",
  "west bengal": "Kolkata",
  bihar: "Patna",
  "madhya pradesh": "Bhopal",
  haryana: "Chandigarh",
  telangana: "Hyderabad",
  kerala: "Thiruvananthapuram",
  assam: "Guwahati",
};

/**
 * Known city aliases for Pakistan (common spellings and major cities).
 * Used as fallback when geocoding fails for partial matches.
 */
const PAKISTAN_CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala",
  "Hyderabad",
  "Bahawalpur",
  "Sargodha",
  "Sukkur",
  "Larkana",
  "Abbottabad",
  "Mardan",
  "Muzaffarabad",
  "Gilgit",
  "Chiniot",
  "Jhang",
  "Sahiwal",
  "Okara",
  "Wah",
  "Dera Ghazi Khan",
  "Mingora",
  "Mirpur Khas",
  "Nawabshah",
  "Khanewal",
  "Jacobabad",
];

/**
 * Build progressively-simplified search queries for a free-text location.
 *
 * Farm locations are typed by hand and often aren't an exact place name
 * (e.g. "Faisalabad Chiniot" — two neighbouring cities typed together).
 * We derive a list of fallback queries: the exact string, comma-separated
 * parts, token reductions, province-to-city mappings, and country hints.
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

  // Remove common suffixes like "province", "state", "district".
  const withoutSuffix = clean.replace(/\s*(province|state|district|division|tehsil)$/i, "").trim();
  if (withoutSuffix && withoutSuffix !== clean) {
    push(withoutSuffix);
  }

  // Province/state to major city fallback.
  const lowerClean = clean.toLowerCase();
  for (const [province, city] of Object.entries(PROVINCE_TO_CITY)) {
    if (lowerClean.includes(province) || province.includes(lowerClean)) {
      push(city);
      push(`${city}, Pakistan`);
      push(`${city}, India`);
      break;
    }
  }

  // Check if any token matches a known Pakistan city (partial match fallback).
  const lowerTokens = tokens.map((t) => t.toLowerCase());
  for (const city of PAKISTAN_CITIES) {
    const lowerCity = city.toLowerCase();
    if (lowerTokens.some((t) => t === lowerCity || lowerCity.includes(t) || t.includes(lowerCity))) {
      push(city);
      push(`${city}, Pakistan`);
      break;
    }
  }

  // Country hints as a last resort, unless the query already mentions one.
  const hasCountry = /pakistan|india|bangladesh|\bPK\b|\bIN\b|\bBD\b|,\s*[A-Z]{2}$/i.test(clean);
  if (!hasCountry) {
    for (const q of [...candidates]) {
      push(`${q}, Pakistan`);
      push(`${q}, India`);
    }
  }

  return candidates;
}

/**
 * Geocode a free-text location using Open-Meteo Geocoding API.
 * Returns the best place found, or null if nothing matched.
 */
async function geocodeLocation(query: string): Promise<GeoPlace | null> {
  const candidates = locationCandidates(query);
  for (const candidate of candidates) {
    try {
      const resp = await fetch(
        `${GEO_URL}?name=${encodeURIComponent(candidate)}&count=5&language=en&format=json`
      );
      if (!resp.ok) continue;
      const data = (await resp.json()) as { results?: GeoPlace[] };
      const list = data.results;
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
 * Map WMO weather code to the condition codes used by the Kissan AI UI.
 * WMO codes: https://open-meteo.com/en/docs (Weather interpretation section)
 */
function wmoToConditionCode(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Clouds";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain";
  if (code === 85 || code === 86) return "Snow";
  if (code >= 95) return "Thunderstorm";
  return "Clouds";
}

/**
 * Map WMO weather code to a human-readable description.
 */
function wmoToDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return descriptions[code] ?? "Conditions";
}

interface DayAcc {
  date: string;
  max: number;
  min: number;
  pop: number;
  wind: number;
  humiditySum: number;
  humidityCount: number;
  rainSum: number;
  et0Sum: number;
  et0Count: number;
  soilMoistureSum: number;
  soilMoistureCount: number;
  condition: string;
  conditionCode: string;
  middayCode: number;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsForOrigin(req) });
  }

  // Lightweight JWT sanity check (anon-based app).
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.split(".").length !== 3) {
    return json(
      { success: false, error: "This request is not authorized. Please try again." },
      401
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
  const place = await geocodeLocation(location);
  if (
    !place ||
    typeof place.latitude !== "number" ||
    typeof place.longitude !== "number"
  ) {
    console.log("get-weather: no geocode match for", JSON.stringify(location));
    return json(
      {
        success: false,
        error: `We couldn't find "${location}" on the map. Please check the location saved on your farm profile.`,
      },
      404
    );
  }

  const lat = place.latitude;
  const lon = place.longitude;
  const tz = place.timezone ?? "auto";

  // 2) Fetch forecast with hourly + daily data from Open-Meteo.
  //    Includes soil moisture and ET0 for irrigation support.
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: tz,
    // Current weather variables
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "weather_code",
      "wind_speed_10m",
    ].join(","),
    // Hourly variables for aggregation
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation_probability",
      "precipitation",
      "rain",
      "weather_code",
      "wind_speed_10m",
      "soil_moisture_0_to_1cm",
      "et0_fao_evapotranspiration",
    ].join(","),
    // Daily variables
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "rain_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "et0_fao_evapotranspiration",
    ].join(","),
    forecast_days: "7",
  });

  let forecastRaw: any;
  try {
    const resp = await fetch(`${FORECAST_URL}?${params}`);
    if (!resp.ok) {
      console.error("get-weather: Open-Meteo API error", resp.status);
      return json(
        { success: false, error: "We couldn't load the weather. Please try again." },
        502
      );
    }
    forecastRaw = await resp.json();
  } catch (err) {
    console.error("get-weather: network error", err);
    return json(
      { success: false, error: "We couldn't load the weather. Please try again." },
      502
    );
  }

  // 3) Extract current conditions from the response.
  const current = forecastRaw?.current;
  if (!current) {
    return json(
      { success: false, error: "We couldn't load the current weather. Please try again." },
      502
    );
  }

  const currentCode = safeNum(current.weather_code);
  const todayPrecipProb = safeNum(
    forecastRaw?.daily?.precipitation_probability_max?.[0]
  );

  const currentWeather = {
    temperature: Math.round(safeNum(current.temperature_2m)),
    feelsLike: Math.round(safeNum(current.apparent_temperature) || safeNum(current.temperature_2m)),
    humidity: Math.round(safeNum(current.relative_humidity_2m)),
    rainProbability: Math.round(todayPrecipProb),
    windSpeed: Math.round(safeNum(current.wind_speed_10m)),
    condition: wmoToDescription(currentCode),
    conditionCode: wmoToConditionCode(currentCode),
    capturedAt: current.time ?? new Date().toISOString(),
  };

  // 4) Aggregate hourly data into per-day summaries.
  const hourly = forecastRaw?.hourly;
  const daily = forecastRaw?.daily;

  const forecast: Array<{
    date: string;
    condition: string;
    conditionCode: string;
    temperatureMax: number;
    temperatureMin: number;
    rainProbability: number;
    windSpeed: number;
    humidity: number;
    precipitation: number;
    rain: number;
    soilMoisture: number | null;
    et0: number | null;
  }> = [];

  // Use daily data if available (more accurate aggregates)
  if (daily && Array.isArray(daily.time)) {
    for (let i = 0; i < daily.time.length; i++) {
      const code = safeNum(daily.weather_code?.[i]);
      forecast.push({
        date: daily.time[i],
        condition: wmoToDescription(code),
        conditionCode: wmoToConditionCode(code),
        temperatureMax: Math.round(safeNum(daily.temperature_2m_max?.[i])),
        temperatureMin: Math.round(safeNum(daily.temperature_2m_min?.[i])),
        rainProbability: Math.round(safeNum(daily.precipitation_probability_max?.[i])),
        windSpeed: Math.round(safeNum(daily.wind_speed_10m_max?.[i])),
        humidity: 0, // Will be filled from hourly if needed
        precipitation: safeNum(daily.precipitation_sum?.[i]),
        rain: safeNum(daily.rain_sum?.[i]),
        soilMoisture: null, // Soil moisture is hourly-only
        et0: safeNumOrNull(daily.et0_fao_evapotranspiration?.[i]),
      });
    }
  }

  // Fill humidity from hourly data and compute average soil moisture per day
  if (hourly && Array.isArray(hourly.time)) {
    const dayMap = new Map<string, {
      humiditySum: number;
      humidityCount: number;
      soilMoistureSum: number;
      soilMoistureCount: number;
    }>();

    for (let i = 0; i < hourly.time.length; i++) {
      const date = hourly.time[i].slice(0, 10);
      const acc = dayMap.get(date) ?? {
        humiditySum: 0,
        humidityCount: 0,
        soilMoistureSum: 0,
        soilMoistureCount: 0,
      };
      const hum = safeNumOrNull(hourly.relative_humidity_2m?.[i]);
      if (hum !== null) {
        acc.humiditySum += hum;
        acc.humidityCount += 1;
      }
      const sm = safeNumOrNull(hourly.soil_moisture_0_to_1cm?.[i]);
      if (sm !== null) {
        acc.soilMoistureSum += sm;
        acc.soilMoistureCount += 1;
      }
      dayMap.set(date, acc);
    }

    for (const day of forecast) {
      const acc = dayMap.get(day.date);
      if (acc) {
        day.humidity = acc.humidityCount > 0
          ? Math.round(acc.humiditySum / acc.humidityCount)
          : 0;
        day.soilMoisture = acc.soilMoistureCount > 0
          ? Math.round((acc.soilMoistureSum / acc.soilMoistureCount) * 100) / 100
          : null;
      }
    }
  }

  // Limit to 5 days for the forecast strip (UI expects 5)
  const forecastLimited = forecast.slice(0, 5);

  // 5) Build the response payload.
  const weather = {
    current: currentWeather,
    forecast: forecastLimited,
    location: {
      name: place.name ?? location,
      country: place.country ?? "",
    },
  };

  return json({ success: true, weather });
});
