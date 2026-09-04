import * as React from "react";
import { useFarm } from "../context/FarmContext";
import { getWeather, type WeatherData } from "../lib/weather-service";

/**
 * Farm-aware weather hook.
 *
 * Integrates live weather with the existing Farm Context: it reads the active
 * farm (and its saved location) from `useFarm()`, fetches real weather through
 * the Edge Function, and exposes loading / ready / error states plus a retry.
 * Both the Dashboard summary and the Weather page share this single source, so
 * they always show the same values and never duplicate the fetch.
 */

export type WeatherStatus = "idle" | "loading" | "ready" | "error";

export function useFarmWeather() {
  const { farm } = useFarm();
  const [status, setStatus] = React.useState<WeatherStatus>(farm ? "loading" : "idle");
  const [weather, setWeather] = React.useState<WeatherData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!farm) {
      setStatus("idle");
      setWeather(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    const maxRetries = 3;
    const baseDelay = 1000;

    function fetchWithRetry(retriesLeft: number): Promise<WeatherData> {
      return getWeather(farm!.location).catch((err: unknown) => {
        if (retriesLeft > 0) {
          const delay = baseDelay * Math.pow(2, maxRetries - retriesLeft);
          return new Promise<WeatherData>((resolve) =>
            window.setTimeout(() => resolve(fetchWithRetry(retriesLeft - 1)), delay)
          );
        }
        throw err;
      });
    }

    fetchWithRetry(maxRetries)
      .then((data) => {
        if (!cancelled) {
          setWeather(data);
          setStatus("ready");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "We couldn't load the weather. Please try again."
          );
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [farm, attempt]);

  const retry = React.useCallback(() => setAttempt((a) => a + 1), []);

  return { status, weather, error, retry, hasFarm: !!farm };
}