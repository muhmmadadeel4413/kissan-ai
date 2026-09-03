import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Sun,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { useFarmWeather } from "../../hooks/useFarmWeather";
import { useI18n } from "../../context/PreferencesContext";
import type { WeatherForecastDay } from "../../lib/weather-service";
import { cn } from "../../lib/utils";

/**
 * 5-day forecast strip (Dashboard Phase 2 widget).
 *
 * Renders REAL forecast data from the farm-aware weather hook — never
 * fabricated. Conditions use an icon PLUS a text label (never colour-only),
 * and loading / unavailable states are explicit.
 */

const CONDITION_ICON: Record<string, LucideIcon> = {
  Clear: Sun,
  Clouds: CloudSun,
  Cloud: Cloud,
  Rain: CloudRain,
  Drizzle: CloudRain,
  Thunderstorm: CloudLightning,
  Snow: CloudSnow,
  Mist: CloudFog,
  Fog: CloudFog,
  Haze: CloudFog,
  Smoke: CloudFog,
  Dust: CloudFog,
  Sand: CloudFog,
  Ash: CloudFog,
  Squall: CloudLightning,
  Tornado: CloudLightning,
};

function DayIcon({ conditionCode, className }: { conditionCode?: string; className?: string }) {
  const Icon = (conditionCode && CONDITION_ICON[conditionCode]) || CloudSun;
  return <Icon className={className} aria-hidden="true" />;
}

function formatDay(iso: string): { weekday: string; date: string } {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return { weekday: iso, date: "" };
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    date: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
  };
}

export function ForecastStrip() {
  const { t } = useI18n();
  const { status, weather, error, retry } = useFarmWeather();

  if (status === "loading" || status === "idle") {
    return (
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-5" role="status">
          <span className="sr-only">{t("dashboard.forecastLoading")}</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (status === "error" || !weather) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CloudSun className="h-4 w-4" aria-hidden="true" />
            <span>{error ?? "Weather is currently unavailable."}</span>
          </div>
          <button
            type="button"
            onClick={retry}
            className="shrink-0 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
          >
            {t("common.retry")}
          </button>
        </CardContent>
      </Card>
    );
  }

  const days: WeatherForecastDay[] = weather.forecast?.slice(0, 5) ?? [];

  if (days.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-xs text-muted-foreground">
          {t("dashboard.forecastLoading")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-5">
        {days.map((day, i) => {
          const { weekday, date } = formatDay(day.date);
          const isToday = i === 0;
          return (
            <div
              key={day.date}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-2 text-center",
                isToday && "border-border bg-background/40"
              )}
            >
              <p className="text-xs font-semibold text-foreground">
                {isToday ? t("dashboard.todayShort") : weekday}
              </p>
              <DayIcon
                conditionCode={day.conditionCode}
                className={cn(
                  "h-8 w-8",
                  day.rainProbability >= 50 ? "text-primary" : "text-muted-foreground"
                )}
              />
              <p className="text-xs font-semibold text-foreground">
                {Math.round(day.temperatureMax)}°{" "}
                <span className="font-normal text-muted-foreground">
                  {Math.round(day.temperatureMin)}°
                </span>
              </p>
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Droplets className="h-3 w-3" aria-hidden="true" />
                {Math.round(day.rainProbability)}%
              </p>
              <p className="sr-only">{day.condition}</p>
              <p className="text-[10px] text-muted-foreground" aria-hidden="true">
                {date}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Small current-conditions row used by the dashboard weather summary. */
export function CurrentConditionsStrip() {
  const { t } = useI18n();
  const { status, weather } = useFarmWeather();

  if (status !== "ready" || !weather) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Sun className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
        <span className="font-semibold text-foreground">
          {Math.round(weather.current.temperature)}°C
        </span>
        {t("dashboard.currentConditions")}
      </span>
      <span className="flex items-center gap-1.5">
        <Wind className="h-3.5 w-3.5" aria-hidden="true" />
        {Math.round(weather.current.windSpeed)} km/h
      </span>
      <span className="flex items-center gap-1.5">
        <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
        {Math.round(weather.current.rainProbability)}%
      </span>
    </div>
  );
}
