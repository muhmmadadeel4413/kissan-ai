import { supabase } from "./supabase";
import type { WeatherForecastDay as BaseForecastDay } from "../types";

/**
 * Weather data layer.
 *
 * The real weather request happens server-side in the `get-weather` Edge
 * Function (which owns the OpenWeatherMap API key). The browser only sends the
 * farm's location string and receives normalized weather — no key ever reaches
 * client code.
 *
 * Responses are cached in localStorage with a short TTL so Dashboard and the
 * Weather page share the same fetch instead of hammering the provider on every
 * navigation. Only real provider responses are ever cached.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface WeatherForecastDay extends BaseForecastDay {
  /** Machine-friendly condition code, e.g. "Clear", "Clouds", "Rain". */
  conditionCode?: string;
  /** Average humidity for the day (%). */
  humidity?: number;
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
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry || entry.location !== location) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(location: string, data: WeatherData) {
  try {
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
  // Log the human-friendly reason rather than the raw FunctionsHttpError
  // (whose message is only "Edge Function returned a non-2xx status code" and
  // tells the user nothing useful).
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
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch live weather for a farm location (real data, cached briefly).
 * Throws a human-friendly message on any failure — never a raw error.
 */
export async function getWeather(location: string): Promise<WeatherData> {
  const loc = location.trim();
  if (!loc) {
    throw new Error("Add your farm location to see live weather for your farm.");
  }

  const cached = readCache(loc);
  if (cached) return cached;

  const { data, error } = await supabase.functions.invoke("get-weather", {
    body: { location: loc },
  });

  if (error) {
    friendlyError(error, await edgeErrorToMessage(error));
  }

  const payload = data as { success?: boolean; weather?: WeatherData; error?: string };
  if (!payload?.success || !payload.weather) {
    friendlyError(
      payload?.error,
      payload?.error || "We couldn't load the weather. Please try again."
    );
  }

  writeCache(loc, payload.weather as WeatherData);
  return payload.weather as WeatherData;
}