import { Link } from "react-router-dom";
import {
  ArrowRight,
  CloudRain,
  CloudSun,
  Droplets,
  RefreshCw,
  Wind,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { useFarmWeather } from "../../hooks/useFarmWeather";

/**
 * Compact real-weather summary for the Dashboard.
 *
 * Reuses the farm-aware `useFarmWeather` hook so the summary and the full
 * Weather page always show identical values. Renders a skeleton while loading,
 * an actionable error with retry on failure, and real provider values on
 * success — never fake weather.
 */
export function WeatherSummaryCard() {
  const { status, weather, error, retry } = useFarmWeather();

  // Loading (or no farm yet) — skeleton, no blank space.
  if (status === "loading" || status === "idle") {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
              <CloudSun className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-9 w-24" />
        </CardContent>
      </Card>
    );
  }

  // Error — understandable + retry.
  if (status === "error") {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft text-danger">
              <CloudSun className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Weather unavailable</p>
              <p className="text-xs text-muted-foreground">
                {error ?? "We couldn't load the weather right now."}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!weather) return null;

  const { current } = weather;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <CloudSun className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {current.temperature}°C · {current.condition}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
                {current.humidity}% humidity
              </span>
              <span className="inline-flex items-center gap-1">
                <CloudRain className="h-3.5 w-3.5" aria-hidden="true" />
                {current.rainProbability}% rain
              </span>
              <span className="inline-flex items-center gap-1">
                <Wind className="h-3.5 w-3.5" aria-hidden="true" />
                {current.windSpeed} km/h
              </span>
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/weather">
            Full forecast
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}