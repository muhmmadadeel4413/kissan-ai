import { Link } from "react-router-dom";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  MapPin,
  Sprout,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader, SectionHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { ErrorState } from "../components/layout/error-state";
import { useFarm } from "../context/FarmContext";
import { useI18n } from "../context/PreferencesContext";
import { useFarmWeather } from "../hooks/useFarmWeather";
import {
  buildWeatherInsights,
  type InsightLevel,
  type WeatherInsight,
} from "../lib/weather-insights";
import type {
  CurrentWeather,
  WeatherForecastDay,
  WeatherLocation,
} from "../lib/weather-service";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Condition icon mapping (OpenWeatherMap condition codes)             */
/* ------------------------------------------------------------------ */

function ConditionIcon({ code, className }: { code: string; className?: string }) {
  switch (code) {
    case "Clear":
      return <Sun className={className} aria-hidden="true" />;
    case "Clouds":
      return <Cloud className={className} aria-hidden="true" />;
    case "Rain":
      return <CloudRain className={className} aria-hidden="true" />;
    case "Drizzle":
      return <CloudDrizzle className={className} aria-hidden="true" />;
    case "Thunderstorm":
      return <CloudLightning className={className} aria-hidden="true" />;
    case "Snow":
      return <CloudSnow className={className} aria-hidden="true" />;
    case "Mist":
    case "Fog":
    case "Haze":
      return <CloudFog className={className} aria-hidden="true" />;
    default:
      return <CloudSun className={className} aria-hidden="true" />;
  }
}

/* ------------------------------------------------------------------ */
/* Today's Weather — hero card                                         */
/* ------------------------------------------------------------------ */

function TodayWeather({
  current,
  location,
}: {
  current: CurrentWeather;
  location: WeatherLocation;
}) {
  const { t } = useI18n();
  const updated = new Date(current.capturedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const stats = [
    {
      icon: <Thermometer className="h-5 w-5" aria-hidden="true" />,
      label: t("weather.feelsLike"),
      value: `${Math.round(current.feelsLike)}°C`,
    },
    {
      icon: <Droplets className="h-5 w-5" aria-hidden="true" />,
      label: t("weather.humidity"),
      value: `${current.humidity}%`,
    },
    {
      icon: <Wind className="h-5 w-5" aria-hidden="true" />,
      label: t("weather.wind"),
      value: `${current.windSpeed} km/h`,
    },
    {
      icon: <Umbrella className="h-5 w-5" aria-hidden="true" />,
      label: t("weather.rainChance"),
      value: `${current.rainProbability}%`,
    },
  ];

  return (
    <Card className="overflow-hidden">
      {/* Hero band */}
      <div className="bg-gradient-to-br from-primary-soft via-secondary/70 to-card p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-5">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-card text-primary shadow-lift ring-1 ring-primary/10 sm:h-24 sm:w-24">
              <ConditionIcon
                code={current.conditionCode}
                className="h-12 w-12 sm:h-14 sm:w-14"
              />
            </span>
            <div>
              <p className="font-heading text-6xl font-extrabold leading-none tracking-tight text-foreground sm:text-7xl">
                {Math.round(current.temperature)}
                <span className="text-3xl font-bold text-primary sm:text-4xl">°C</span>
              </p>
              <p className="mt-2 text-base font-semibold capitalize text-foreground">
                {current.condition}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {location.name}
                  {location.country ? `, ${location.country}` : ""} · {t("weather.updatedAt", { time: updated })}
                </span>
              </p>
            </div>
          </div>
          <Badge
            variant="success"
            className="w-fit shrink-0 bg-card text-success ring-success/20"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            {t("weather.liveConditions")}
          </Badge>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-px border-t border-border bg-border lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 bg-card p-4 sm:px-5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              {stat.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <p className="font-heading text-lg font-bold leading-tight text-foreground">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Farming Impact — green recommendation card                          */
/* ------------------------------------------------------------------ */

function InsightBadge({ level }: { level: InsightLevel }) {
  const { t } = useI18n();
  const config: Record<InsightLevel, { labelKey: string; variant: "success" | "warning" | "danger" }> = {
    high: { labelKey: "weather.actionRecommended", variant: "danger" },
    medium: { labelKey: "weather.keepEyeOn", variant: "warning" },
    low: { labelKey: "weather.goodConditions", variant: "success" },
  };
  const { labelKey, variant } = config[level];
  return <Badge variant={variant}>{t(labelKey)}</Badge>;
}

function FarmingImpact({ insights }: { insights: WeatherInsight[] }) {
  const { t } = useI18n();
  if (insights.length === 0) {
    return (
      <EmptyState
        icon={<CloudSun className="h-6 w-6" />}
        title={t("weather.noWeatherNotes")}
        description={t("weather.conditionsBalanced")}
      />
    );
  }

  // Surface the most important insight as the headline recommendation.
  const priority: Record<InsightLevel, number> = { high: 0, medium: 1, low: 2 };
  const primary = [...insights].sort(
    (a, b) => priority[a.level] - priority[b.level]
  )[0];
  const rest = insights.filter((insight) => insight !== primary);

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-success/20 bg-success-soft/40 shadow-lift">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-success text-success-foreground shadow-soft">
              <Sprout className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <InsightBadge level={primary.level} />
              </div>
              <p className="mt-2 font-heading text-base font-bold text-foreground">
                {primary.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {primary.message}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {rest.length > 0 ? (
        <div className="space-y-2">
          {rest.map((insight, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-3">
                <InsightBadge level={insight.level} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{insight.message}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5 Day Forecast                                                      */
/* ------------------------------------------------------------------ */

function ForecastDayCard({ day, index }: { day: WeatherForecastDay; index: number }) {
  const { t } = useI18n();
  const date = new Date(day.date + "T00:00:00");
  const isToday = index === 0;
  const label = isToday
    ? t("weather.today")
    : index === 1
      ? t("weather.tomorrow")
      : date.toLocaleDateString(undefined, { weekday: "short" });

  return (
    <Card
      className={cn(
        "p-4 text-center transition-colors duration-200",
        isToday && "border-primary/30 bg-primary-soft/40 shadow-lift"
      )}
    >
      <p className="text-sm font-bold text-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground">
        {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
      </p>
      <div className="my-3 flex justify-center text-primary">
        <ConditionIcon code={day.conditionCode ?? ""} className="h-9 w-9" />
      </div>
      <p className="font-heading text-lg font-bold text-foreground">
        {Math.round(day.temperatureMax)}°
        <span className="ml-1 text-sm font-medium text-muted-foreground">
          {Math.round(day.temperatureMin)}°
        </span>
      </p>
      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Droplets className="h-3 w-3 text-primary" aria-hidden="true" />
        {t("weather.rainPercent", { n: day.rainProbability })}
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function WeatherPage() {
  const { farm } = useFarm();
  const { t } = useI18n();
  const { status, weather, error, retry } = useFarmWeather();

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<Sprout className="h-6 w-6" />}
          title={t("dashboard.setupTitle")}
          description={t("weather.setupForWeather")}
          action={
            <Button asChild size="lg">
              <Link to="/farm-setup">{t("dashboard.createFarm")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const insights = weather ? buildWeatherInsights(weather) : [];
  const loading = status === "loading" || status === "idle";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("weather.title")}
        subtitle={t("weather.liveConditionsFor", { location: farm.location })}
      />

      {status === "error" ? (
        <ErrorState
          title={t("weather.unavailableTitle")}
          message={error ?? t("weather.unavailableDefault")}
          onRetry={retry}
        />
      ) : null}

      {/* Today's Weather */}
      <section className="space-y-3">
        <SectionHeader title={t("weather.todayWeather")} subtitle={t("weather.todayWeatherSub")} />
        {loading ? (
          <Card className="overflow-hidden">
            <div className="space-y-5 p-6">
              <div className="flex items-center gap-5">
                <Skeleton className="h-20 w-20 shrink-0 rounded-3xl" />
                <div className="space-y-2">
                  <Skeleton className="h-12 w-36" />
                  <Skeleton className="h-4 w-44" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            </div>
          </Card>
        ) : weather ? (
          <TodayWeather current={weather.current} location={weather.location} />
        ) : null}
      </section>

      {/* Farming Impact */}
      <section className="space-y-3">
        <SectionHeader
          title={t("weather.farmingImpact")}
          subtitle={t("weather.farmingImpactSub")}
        />
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : weather ? (
          <FarmingImpact insights={insights} />
        ) : null}
      </section>

      {/* 5 Day Forecast */}
      <section className="space-y-3">
        <SectionHeader
          title={t("weather.fiveDayForecast")}
          subtitle={t("weather.weekAhead")}
        />
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : weather && weather.forecast.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {weather.forecast.map((day, i) => (
              <ForecastDayCard key={day.date} day={day} index={i} />
            ))}
          </div>
        ) : null}
      </section>

      {status === "error" ? (
        <Card className="bg-muted/50">
          <CardContent className="py-4 text-xs text-muted-foreground">
            {t("weather.providerError")}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
