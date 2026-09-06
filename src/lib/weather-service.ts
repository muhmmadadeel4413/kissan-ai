import { supabase } from "./supabase";
import type { WeatherForecastDay as BaseForecastDay } from "../types";
import { resolveLocation, type ResolvedLocation } from "./location-matcher";

/**
 * Weather data layer.
 *
 * Fetches real live weather for a farm location.
 * Uses a resilient, multi-tiered architecture:
 *  1. Smart location resolution & typo tolerance (e.g. "Fasialabad" -> "Faisalabad")
 *  2. Server-side Supabase Edge Function (`get-weather`)
 *  3. Client-side direct Open-Meteo fallback with pre-verified district coordinates
 *     if the Edge Function is unavailable or returns 404
 *  4. Client-side caching with 15-minute TTL to minimize network overhead
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface WeatherForecastDay extends BaseForecastDay {
  /** Machine-friendly condition code, e.g. "Clear", "Clouds", "Rain". */
  conditionCode?: string;
  /** Average humidity for the day (%). */
  humidity?: number;
  /** Total precipitation for the day (mm). */
  precipitation?: number;
  /** Total rain for the day (mm). */
  rain?: number;
  /** Average soil moisture 0-1cm (m³/m³), null if unavailable. */
  soilMoisture?: number | null;
  /** Daily ET0 evapotranspiration (mm), null if unavailable. */
  et0?: number | null;
}

export interface CurrentWeather {
  /** °C */
  temperature: number;
  /** °C */
  feelsLike: number;
  /** % */
  humidity: number;
  /** % chance of rain today (derived from today's forecast). */
  rainProbability: number;
  /** km/h */
  windSpeed: number;
  /** Human-readable condition, e.g. "clear sky". */
  condition: string;
  /** Machine-friendly condition code, e.g. "Clear". */
  conditionCode: string;
  /** ISO timestamp of when the data was fetched. */
  capturedAt: string;
}

export interface WeatherLocation {
  name: string;
  country: string;
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: WeatherForecastDay[];
  location: WeatherLocation;
}

/* ------------------------------------------------------------------ */
/* WMO code helpers (for direct client-side fallback)                 */
/* ------------------------------------------------------------------ */

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

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function safeNumOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ */
/* Cache (short TTL, real data only)                                   */
/* ------------------------------------------------------------------ */

const CACHE_KEY = "kissanai.weather.v1";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  location: string;
  data: WeatherData;
  fetchedAt: number;
}

function readCache(location: string): WeatherData | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry || entry.location.toLowerCase() !== location.toLowerCase()) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(location: string, data: WeatherData) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const entry: CacheEntry = { location, data, fetchedAt: Date.now() };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Storage may be unavailable (private mode etc.) — fetch still works.
  }
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

function friendlyError(err: unknown, fallback: string): never {
  console.error("weather-service:", fallback);
  if (err) {
    console.debug("weather-service (detail):", err);
  }
  throw new Error(fallback);
}

/** Extract a human-friendly message from a Supabase Edge Function error. */
async function edgeErrorToMessage(err: unknown): Promise<string> {
  const e = err as {
    context?: { text?: () => Promise<string> };
    message?: string;
  };
  if (e?.context && typeof e.context.text === "function") {
    try {
      const text = await e.context.text();
      const parsed = JSON.parse(text) as { error?: string };
      return parsed.error || "We couldn't load the weather. Please try again.";
    } catch {
      return "We couldn't load the weather. Please try again.";
    }
  }
  return e?.message || "We couldn't load the weather. Please try again.";
}

/* ------------------------------------------------------------------ */
/* Client-Side Direct Open-Meteo Fallback                              */
/* ------------------------------------------------------------------ */

/**
 * Direct fetch from Open-Meteo forecast endpoint using verified coordinates.
 * Open-Meteo is completely free, keyless, and safe to call client-side.
 * Used when the Edge Function is unavailable or fails to geocode.
 */
async function fetchDirectForecast(
  lat: number,
  lon: number,
  locationName: string,
  country = "Pakistan",
  timezone = "auto"
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: timezone || "auto",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "weather_code",
      "wind_speed_10m",
    ].join(","),
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

  const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!resp.ok) {
    throw new Error(`Weather provider error: ${resp.status}`);
  }

  const raw = await resp.json();
  const current = raw?.current;
  if (!current) {
    throw new Error("Invalid response from weather provider.");
  }

  const currentCode = safeNum(current.weather_code);
  const todayPrecipProb = safeNum(
    raw?.daily?.precipitation_probability_max?.[0]
  );

  const currentWeather: CurrentWeather = {
    temperature: Math.round(safeNum(current.temperature_2m)),
    feelsLike: Math.round(safeNum(current.apparent_temperature) || safeNum(current.temperature_2m)),
    humidity: Math.round(safeNum(current.relative_humidity_2m)),
    rainProbability: Math.round(todayPrecipProb),
    windSpeed: Math.round(safeNum(current.wind_speed_10m)),
    condition: wmoToDescription(currentCode),
    conditionCode: wmoToConditionCode(currentCode),
    capturedAt: current.time ?? new Date().toISOString(),
  };

  const daily = raw?.daily;
  const hourly = raw?.hourly;
  const forecast: WeatherForecastDay[] = [];

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
        humidity: 0,
        precipitation: safeNum(daily.precipitation_sum?.[i]),
        rain: safeNum(daily.rain_sum?.[i]),
        soilMoisture: null,
        et0: safeNumOrNull(daily.et0_fao_evapotranspiration?.[i]),
      });
    }
  }

  // Aggregate hourly humidity & soil moisture
  if (hourly && Array.isArray(hourly.time)) {
    const dayMap = new Map<string, {
      humSum: number;
      humCount: number;
      smSum: number;
      smCount: number;
    }>();

    for (let i = 0; i < hourly.time.length; i++) {
      const date = hourly.time[i].slice(0, 10);
      const acc = dayMap.get(date) ?? { humSum: 0, humCount: 0, smSum: 0, smCount: 0 };
      const hum = safeNumOrNull(hourly.relative_humidity_2m?.[i]);
      if (hum !== null) {
        acc.humSum += hum;
        acc.humCount += 1;
      }
      const sm = safeNumOrNull(hourly.soil_moisture_0_to_1cm?.[i]);
      if (sm !== null) {
        acc.smSum += sm;
        acc.smCount += 1;
      }
      dayMap.set(date, acc);
    }

    for (const day of forecast) {
      const acc = dayMap.get(day.date);
      if (acc) {
        day.humidity = acc.humCount > 0 ? Math.round(acc.humSum / acc.humCount) : 0;
        day.soilMoisture = acc.smCount > 0 ? Math.round((acc.smSum / acc.smCount) * 100) / 100 : null;
      }
    }
  }

  return {
    current: currentWeather,
    forecast: forecast.slice(0, 5),
    location: {
      name: locationName,
      country,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch live weather for a farm location (real data, cached briefly).
 * Automatically resolves common typos (e.g. "Fasialabad" -> "Faisalabad"),
 * proxies through the secure Supabase Edge Function, and provides an unbreakable
 * direct fallback using Open-Meteo.
 */
export async function getWeather(location: string): Promise<WeatherData> {
  const loc = location.trim();
  if (!loc) {
    throw new Error("Add your farm location to see live weather for your farm.");
  }

  // Check cache for original query
  const cached = readCache(loc);
  if (cached) return cached;

  // Resolve location to canonical name and coordinates
  const resolved: ResolvedLocation | null = resolveLocation(loc);

  // If resolved, check cache for the canonical name as well
  if (resolved) {
    const cachedResolved = readCache(resolved.name);
    if (cachedResolved) {
      writeCache(loc, cachedResolved);
      return cachedResolved;
    }
  }

  // Determine query to send to Edge Function (prefer canonical name e.g. "Faisalabad")
  const queryToSend = resolved?.name ?? loc;

  try {
    const { data, error } = await supabase.functions.invoke("get-weather", {
      body: { location: queryToSend },
    });

    if (!error && data?.success && data.weather) {
      const weatherData = data.weather as WeatherData;
      writeCache(loc, weatherData);
      if (resolved?.name) writeCache(resolved.name, weatherData);
      return weatherData;
    }

    // Edge function returned non-2xx or error payload.
    // If we have resolved coordinates, execute direct Open-Meteo fallback!
    if (resolved) {
      console.warn(
        `weather-service: Edge Function geocode failed for "${loc}". Using direct fallback to ${resolved.name}.`
      );
      const fallbackWeather = await fetchDirectForecast(
        resolved.latitude,
        resolved.longitude,
        resolved.name,
        resolved.country,
        resolved.timezone
      );
      writeCache(loc, fallbackWeather);
      writeCache(resolved.name, fallbackWeather);
      return fallbackWeather;
    }

    // No fallback available; extract human-friendly error
    const msg = error ? await edgeErrorToMessage(error) : (data?.error || "We couldn't load the weather. Please try again.");
    friendlyError(error || new Error(msg), msg);
  } catch (err: unknown) {
    // If network or Edge Function failed, but we have resolved coordinates, attempt fallback
    if (resolved) {
      try {
        console.warn(
          `weather-service: Edge Function request failed. Attempting direct fallback for ${resolved.name}.`
        );
        const fallbackWeather = await fetchDirectForecast(
          resolved.latitude,
          resolved.longitude,
          resolved.name,
          resolved.country,
          resolved.timezone
        );
        writeCache(loc, fallbackWeather);
        writeCache(resolved.name, fallbackWeather);
        return fallbackWeather;
      } catch (fallbackErr) {
        console.error("weather-service: direct fallback failed:", fallbackErr);
      }
    }

    if (err instanceof Error) {
      throw err;
    }
    friendlyError(err, "We couldn't load the weather. Please try again.");
  }
}