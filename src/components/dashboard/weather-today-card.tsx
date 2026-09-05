import { CloudRain, CloudSun, Droplets, RefreshCw, Wind } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { useI18n } from "../../context/PreferencesContext";
import type { WeatherData } from "../../lib/weather-service";
import type { WeatherStatus } from "../../hooks/useFarmWeather";

/**
 * Weather Today stat card — live conditions from the existing weather
 * pipeline (Edge Function → cached service → useFarmWeather). The reference
 * values (29°C etc.) are visual examples; the real provider data is shown.
 */
export function WeatherTodayCard({
  weather,
  status,
  onRetry,
}: {
  weather: WeatherData | null;
  status: WeatherStatus;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {t("dashboard.weatherToday")}
          </p>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning shadow-soft ring-1 ring-inset ring-warning/15">
            <CloudSun className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        {status === "loading" ? (
          <div className="flex-1 space-y-2" role="status" aria-label={t("dashboard.loadingWeatherAria")}>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3.5 w-32" />
            <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          </div>
        ) : status === "error" || !weather ? (
          <div className="flex flex-1 flex-col items-start gap-2">
            <p className="text-sm font-semibold text-foreground">
              {t("dashboard.weatherUnavailable")}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("dashboard.weatherLoadError")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-auto"
              onClick={onRetry}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("common.tryAgain")}
            </Button>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <p className="font-heading text-3xl font-bold tracking-tight text-foreground">
                {Math.round(weather.current.temperature)}°C
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {t("dashboard.feelsLike")} {Math.round(weather.current.feelsLike)}°C ·{" "}
                {weather.current.condition}
              </p>
            </div>

            <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3">
              <Metric
                icon={<Droplets className="h-3.5 w-3.5" aria-hidden="true" />}
                label={t("dashboard.humidity")}
                value={`${Math.round(weather.current.humidity)}%`}
              />
              <Metric
                icon={<Wind className="h-3.5 w-3.5" aria-hidden="true" />}
                label={t("dashboard.wind")}
                value={`${Math.round(weather.current.windSpeed)} km/h`}
              />
              <Metric
                icon={<CloudRain className="h-3.5 w-3.5" aria-hidden="true" />}
                label={t("dashboard.rain")}
                value={`${Math.round(weather.current.rainProbability)}%`}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span className="truncate text-xs font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}
