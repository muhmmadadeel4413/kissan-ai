import {
  CloudSun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  CloudSnow,
  Sun,
  CloudFog,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { useFarmWeather } from "../../hooks/useFarmWeather";
import { usePreferences } from "../../context/PreferencesContext";
import { LoadingState } from "../layout/loading-state";
import type { WeatherData } from "../../lib/weather-service";

/* ------------------------------------------------------------------ */
/* 5-day forecast strip                                                 */
/* ------------------------------------------------------------------ */

/**
 * Compact 5-day weather forecast strip for the dashboard. Extracts daily
 * forecast data from the weather service (if available) and renders a
 * horizontal strip of day cards with icon, min/max temps, and rain chance.
 *
 * Falls back to a single "current conditions" card when the weather API
 * doesn't provide a multi-day forecast.
 */
export function ForecastStrip() {
  const { t } = usePreferences();
  const { status, weather } = useFarmWeather();

  if (status === "loading" || status === "idle") {
    return <LoadingState rows={1} title={t("dashboard.forecastLoading")} />;
  }

  if (status === "error" || !weather) {
    return null; // Graceful degradation
  }

  // The weather API may return daily forecasts in different shapes.
  // Try to extract a daily_forecast array if present.
  const dailyForecast = extractDailyForecast(weather);

  if (dailyForecast.length === 0) {
    // Fallback: show current conditions as a single card
    const current = weather.current;
    return (
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <CloudSun className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-2xl font-bold text-foreground">
              {current.temperature != null ? `${Math.round(current.temperature)}°C` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {current.condition ?? t("dashboard.currentConditions")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {dailyForecast.slice(0, 5).map((day, i) => (
        <div
          key={i}
          className="flex min-w-[90px] flex-1 flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {i === 0 ? t("dashboard.todayShort") : formatDayLabel(day.date)}
          </p>
          <WeatherIcon condition={day.condition} className="h-6 w-6 text-primary" />
          <p className="text-sm font-bold text-foreground">
            {day.tempMax != null ? `${Math.round(day.tempMax)}°` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {day.tempMin != null ? `${Math.round(day.tempMin)}°` : ""}
          </p>
          {day.rainChance != null && day.rainChance > 0 ? (
            <p className="text-[10px] text-blue-500">{day.rainChance}%</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

interface DayForecast {
  date: string;
  condition: string;
  tempMax: number | null;
  tempMin: number | null;
  rainChance: number | null;
}

function extractDailyForecast(weather: WeatherData): DayForecast[] {
  const daily = weather.forecast;
  if (!Array.isArray(daily)) return [];

  return daily.slice(0, 5).map((d) => ({
    date: d.date ?? "",
    condition: d.condition ?? "",
    tempMax: d.temperatureMax ?? null,
    tempMin: d.temperatureMin ?? null,
    rainChance: d.rainProbability ?? null,
  }));
}

function formatDayLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function WeatherIcon({
  condition,
  className,
}: {
  condition: string;
  className?: string;
}) {
  const lower = (condition ?? "").toLowerCase();
  if (lower.includes("thunder") || lower.includes("storm")) {
    return <CloudLightning className={className} />;
  }
  if (lower.includes("snow")) {
    return <CloudSnow className={className} />;
  }
  if (lower.includes("rain") || lower.includes("shower")) {
    return <CloudRain className={className} />;
  }
  if (lower.includes("drizzle")) {
    return <CloudDrizzle className={className} />;
  }
  if (lower.includes("fog") || lower.includes("mist") || lower.includes("haze")) {
    return <CloudFog className={className} />;
  }
  if (lower.includes("cloud") || lower.includes("overcast")) {
    return <Cloud className={className} />;
  }
  if (lower.includes("clear") || lower.includes("sunny")) {
    return <Sun className={className} />;
  }
  return <CloudSun className={className} />;
}
