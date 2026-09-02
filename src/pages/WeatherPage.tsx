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
  Loader2,
  Sprout,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader, SectionHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { ErrorState } from "../components/layout/error-state";
import { useFarm } from "../context/FarmContext";
import { useFarmWeather } from "../hooks/useFarmWeather";
import { buildWeatherInsights } from "../lib/weather-insights";
import type { CurrentWeather, WeatherForecastDay } from "../lib/weather-service";

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
/* Current conditions tile                                             */
/* ------------------------------------------------------------------ */

function StatTile({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  unit?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1.5 font-heading text-2xl font-bold text-foreground">
        {value !== undefined ? (
          <>
            {value}
            {unit ? (
              <span className="ml-0.5 text-sm font-medium text-muted-foreground">{unit}</span>
            ) : null}
          </>
        ) : (
          "—"
        )}
      </p>
    </Card>
  );
}

function CurrentConditions({ current }: { current: CurrentWeather }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Thermometer className="h-4 w-4" />} label="Temperature" value={current.temperature} unit="°C" />
        <StatTile icon={<Droplets className="h-4 w-4" />} label="Humidity" value={current.humidity} unit="%" />
        <StatTile icon={<CloudRain className="h-4 w-4" />} label="Rain probability" value={current.rainProbability} unit="%" />
        <StatTile icon={<Wind className="h-4 w-4" />} label="Wind speed" value={current.windSpeed} unit="km/h" />
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <ConditionIcon code={current.conditionCode} className="h-6 w-6" />
          </span>
          <div>
            <p className="text-lg font-semibold text-foreground">{current.condition}</p>
            <p className="text-xs text-muted-foreground">
              Feels like {current.feelsLike}°C · Updated{" "}
              {new Date(current.capturedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Forecast card                                                       */
/* ------------------------------------------------------------------ */

function ForecastCard({ day }: { day: WeatherForecastDay }) {
  const date = new Date(day.date + "T00:00:00");
  return (
    <Card className="p-4 text-center">
      <p className="text-xs font-semibold text-foreground">
        {date.toLocaleDateString(undefined, { weekday: "short" })}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
      </p>
      <div className="my-2 flex justify-center text-accent">
        <ConditionIcon code={day.conditionCode ?? ""} className="h-8 w-8" />
      </div>
      <p className="text-sm font-bold text-foreground">
        {day.temperatureMax}°
        <span className="ml-1 text-xs font-medium text-muted-foreground">
          {day.temperatureMin}°
        </span>
      </p>
      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Droplets className="h-3 w-3" aria-hidden="true" />
        {day.rainProbability}% rain
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function WeatherPage() {
  const { farm } = useFarm();
  const { status, weather, error, retry } = useFarmWeather();

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<Sprout className="h-6 w-6" />}
          title="Set up your farm to unlock Kissan AI"
          description="Add your farmer, farm, and crop details once — live weather will then be tailored to your farm's location."
          action={
            <Button asChild size="lg">
              <Link to="/farm-setup">Create Farm</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const insights = weather ? buildWeatherInsights(weather) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weather Intelligence"
        subtitle={
          farm
            ? `Live conditions for ${farm.location}`
            : "Live conditions for your farm"
        }
      />

      {status === "error" ? (
        <ErrorState
          title="Weather is unavailable right now"
          message={error ?? "We couldn't load the weather. Please try again."}
          onRetry={retry}
        />
      ) : null}

      {/* Current conditions */}
      <section className="space-y-3">
        <SectionHeader title="Current Conditions" subtitle="What's happening right now" />
        {status === "loading" || status === "idle" ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : weather ? (
          <CurrentConditions current={weather.current} />
        ) : null}
      </section>

      {/* Forecast */}
      <section className="space-y-3">
        <SectionHeader title="Forecast" subtitle="Next few days" />
        {status === "loading" || status === "idle" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : weather && weather.forecast.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {weather.forecast.map((day) => (
              <ForecastCard key={day.date} day={day} />
            ))}
          </div>
        ) : null}
      </section>

      {/* Agricultural insight */}
      <section className="space-y-3">
        <SectionHeader
          title="Agricultural Insight"
          subtitle="What this weather means for your farm"
        />
        {status === "loading" || status === "idle" ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              Building your weather insight…
            </CardContent>
          </Card>
        ) : weather ? (
          insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <Badge
                      variant={
                        insight.level === "high"
                          ? "danger"
                          : insight.level === "medium"
                            ? "warning"
                            : "success"
                      }
                      className="mt-0.5 shrink-0"
                    >
                      {insight.level}
                    </Badge>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{insight.message}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CloudSun className="h-6 w-6" />}
              title="No weather notes right now"
              description="Conditions look balanced — no urgent farm actions based on the current weather."
            />
          )
        ) : null}
      </section>

      {status === "error" ? (
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Why is weather unavailable?</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Live weather needs the weather provider to be configured on the server. You can
            try again, or check your farm location is spelled correctly on the Farm Profile.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}