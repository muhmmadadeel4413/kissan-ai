import * as React from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  CloudSun,
  Droplets,
  History,
  Loader2,
  ShieldAlert,
  Sprout,
  Clock,
  Layers,
  CalendarClock,
  Wind,
  Leaf,
  MapPin,
  Ruler,
  TrendingUp,
  ListChecks,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PageHeader, SectionHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { LoadingState } from "../components/layout/loading-state";
import { ErrorState } from "../components/layout/error-state";
import { IrrigationFarmContextCard } from "../components/irrigation/irrigation-farm-context-card";
import { SoilMoistureCard } from "../components/irrigation/soil-moisture-card";
import { useFarm } from "../context/FarmContext";
import { useFarmWeather } from "../hooks/useFarmWeather";
import { usePreferences } from "../context/PreferencesContext";
import { buildFarmContext } from "../lib/farm-context";
import {
  fetchIrrigationHistory,
  requestIrrigationAdvice,
  type IrrigationWeatherInput,
} from "../lib/irrigation-service";
import type {
  Farm,
  IrrigationRecommendation,
  IrrigationRecommendationRecord,
  IrrigationStatus,
  IrrigationUrgency,
} from "../types";

/**
 * Irrigation Advisor (Prompt 14) — UI redesign.
 *
 * Answers "when and how much should I irrigate?" by reusing the existing Farm
 * Context Engine (real saved farm + deterministic growth) and the existing
 * Weather Intelligence (live data when available). The reasoning runs
 * server-side in the `irrigation-advisor` Edge Function (deterministic
 * rain-aware rules + optional Gemini explanation, structured JSON, validated
 * and persisted) and always reflects real data — never mocked.
 *
 * This file is a UI-only redesign of the page. All calculations, services,
 * API calls, state management, loading/error/empty states, and the history
 * flow are preserved exactly as before — only the layout/visual hierarchy
 * changed to match the reference (Current Recommendation | Soil Moisture
 * two-card grid + Next Irrigation strip).
 */
export default function IrrigationPage() {
  const { farm } = useFarm();
  const { t, language } = usePreferences();
  const weather = useFarmWeather();

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<Sprout className="h-6 w-6" />}
          title={t("dashboard.setupTitle")}
          description={t("dashboard.setupDesc")}
          action={
            <Button asChild size="lg">
              <Link to="/farm-setup">{t("farmSetup.createBtn")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  /* ---- Run state ---------------------------------------------------- */
  const [runStatus, setRunStatus] = React.useState<
    "idle" | "loading" | "success" | "error" | "insufficient"
  >("idle");
  const [runError, setRunError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<IrrigationRecommendationRecord | null>(null);
  const [missingInfo, setMissingInfo] = React.useState<string[]>([]);

  /* ---- History ------------------------------------------------------ */
  const [history, setHistory] = React.useState<IrrigationRecommendationRecord[]>([]);
  const [historyStatus, setHistoryStatus] = React.useState<
    "loading" | "ready" | "error"
  >("loading");
  const [historyReload, setHistoryReload] = React.useState(0);
  const [openRecordId, setOpenRecordId] = React.useState<string | null>(null);
  const historyRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setHistoryStatus("loading");
    fetchIrrigationHistory(farm.id)
      .then((rows) => {
        if (!cancelled) {
          setHistory(rows);
          setHistoryStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistory([]);
          setHistoryStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [farm.id, historyReload]);

  const runAdvice = async () => {
    setRunStatus("loading");
    setRunError(null);
    setResult(null);
    setMissingInfo([]);

    // Forward a real weather snapshot only when it's live; never fabricate one.
    const weatherInput: IrrigationWeatherInput | null =
      weather.status === "ready" && weather.weather
        ? {
            temperature: weather.weather.current.temperature,
            humidity: weather.weather.current.humidity,
            rainProbability: weather.weather.current.rainProbability,
            windSpeed: weather.weather.current.windSpeed,
            condition: weather.weather.current.condition,
            forecast: weather.weather.forecast.map((f) => ({
              date: f.date,
              condition: f.condition,
              temperatureMax: f.temperatureMax,
              rainProbability: f.rainProbability,
            })),
          }
        : null;

    try {
      const res = await requestIrrigationAdvice({
        farmId: farm.id,
        weather: weatherInput,
        language,
      });
      if (res.insufficientData) {
        setMissingInfo(res.missingInformation);
        setRunStatus("insufficient");
      } else {
        setResult(res.record);
        setRunStatus("success");
        setHistoryReload((k) => k + 1);
      }
    } catch (err) {
      console.error("irrigation-page:", err);
      setRunError(
        err instanceof Error ? err.message : t("irrigation.errorDesc")
      );
      setRunStatus("error");
    }
  };

  const weatherUnavailable =
    weather.status === "error" ||
    weather.status === "idle" ||
    (weather.status === "ready" && !weather.weather);

  /** "View Irrigation Plan" → reuse the existing saved-history flow. */
  const viewIrrigationPlan = () => {
    if (history.length > 0) {
      setOpenRecordId(history[0].id);
    }
    historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("irrigation.title")} subtitle={t("irrigation.subtitle")} />

      {/* Farm Context — real saved data used for the recommendation */}
      <section className="space-y-3">
        <SectionHeader title={t("irrigation.myFarm")} subtitle={t("irrigation.myFarmSub")} />
        <IrrigationFarmContextCard farm={farm} />
      </section>

      {/* Weather note — honest degradation, never a fake value */}
      {weatherUnavailable ? (
        <InfoNote text={t("irrigation.weatherUnavailable")} tone="neutral" />
      ) : null}

      {/* Action — Get Irrigation Advice */}
      <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary-soft/40 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Droplets className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("irrigation.getAdvice")}
              </p>
              <p className="text-xs text-muted-foreground">
                {farm.currentCrop || t("irrigation.crop")}
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={runAdvice}
            disabled={runStatus === "loading"}
            className="shrink-0"
          >
            {runStatus === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("irrigation.gettingAdvice")}
              </>
            ) : (
              <>
                <Droplets className="h-4 w-4" aria-hidden="true" />
                {t("irrigation.getAdvice")}
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Loading — don't let the UI appear frozen */}
      {runStatus === "loading" ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="text-base font-semibold text-foreground">
              {t("irrigation.analyzing")}
            </p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {t("irrigation.analyzeDesc")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Missing information — honest, links to the farm profile */}
      {runStatus === "insufficient" ? (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">
                  {t("irrigation.missingTitle")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("irrigation.missingDesc")}
                </p>
                {missingInfo.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {missingInfo.map((m) => (
                      <li
                        key={m}
                        className="flex items-center gap-2 text-sm font-medium text-foreground"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                          aria-hidden="true"
                        />
                        {m}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <Button asChild variant="outline">
              <Link to="/farm-profile">
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                {t("irrigation.updateProfile")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* AI error — friendly retry, never raw errors */}
      {runStatus === "error" ? (
        <ErrorState
          title={t("irrigation.errorTitle")}
          message={runError ?? t("irrigation.errorDesc")}
          onRetry={runAdvice}
        />
      ) : null}

      {/* Successful result — redesigned two-card layout */}
      {runStatus === "success" && result ? (
        <>
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left / Main — Current Recommendation */}
            <div className="lg:col-span-2">
              <CurrentRecommendationCard
                recommendation={result.recommendation}
                farm={farm}
                weatherUnavailable={weatherUnavailable}
                onViewPlan={viewIrrigationPlan}
              />
            </div>

            {/* Right — Soil Moisture (real value when available, honest fallback otherwise) */}
            <SoilMoistureCard value={null} />
          </section>

          {/* Bottom — Next Irrigation */}
          <NextIrrigationStrip recommendation={result.recommendation} />
        </>
      ) : null}

      {/* History — real saved records only */}
      <section className="space-y-3" ref={historyRef}>
        <SectionHeader title={t("irrigation.historyTitle")} subtitle={t("irrigation.historySub")} />
        {historyStatus === "loading" ? (
          <LoadingState rows={2} title={t("common.loading")} />
        ) : historyStatus === "error" ? (
          <ErrorState
            title={t("irrigation.historyTitle")}
            message={t("common.error")}
            onRetry={() => setHistoryReload((k) => k + 1)}
          />
        ) : history.length === 0 ? (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title={t("irrigation.noHistory")}
            description={t("irrigation.noHistoryDesc")}
          />
        ) : (
          <div className="space-y-2.5">
            {history.map((record) => (
              <HistoryRow
                key={record.id}
                record={record}
                open={openRecordId === record.id}
                onToggle={() =>
                  setOpenRecordId((cur) => (cur === record.id ? null : record.id))
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons (aliased to keep the component concise)                       */
/* ------------------------------------------------------------------ */
const DropletIcon = Droplets;

/* ------------------------------------------------------------------ */
/* Shared note                                                        */
/* ------------------------------------------------------------------ */

function InfoNote({ text, tone }: { text: string; tone: "neutral" | "warning" }) {
  return (
    <div
      className={
        tone === "warning"
          ? "flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning"
          : "flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground"
      }
    >
      <CloudSun className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

const STATUS_META: Record<
  IrrigationStatus,
  {
    labelKey: string;
    variant: "success" | "warning" | "danger" | "neutral";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  irrigate_now: { labelKey: "irrigation.status.irrigateNow", variant: "danger", icon: Droplets },
  irrigation_soon: { labelKey: "irrigation.status.irrigationSoon", variant: "warning", icon: Clock },
  delay: { labelKey: "irrigation.status.delay", variant: "warning", icon: CloudSun },
  adequate: { labelKey: "irrigation.status.adequate", variant: "success", icon: ShieldAlert },
  insufficient: { labelKey: "irrigation.status.insufficient", variant: "neutral", icon: ClipboardList },
};

const URGENCY_META: Record<
  IrrigationUrgency,
  { labelKey: string; variant: "success" | "warning" | "danger" }
> = {
  low: { labelKey: "irrigation.urgency.low", variant: "success" },
  medium: { labelKey: "irrigation.urgency.medium", variant: "warning" },
  high: { labelKey: "irrigation.urgency.high", variant: "danger" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/* Current Recommendation (left card) — UI redesign                    */
/* ------------------------------------------------------------------ */

function CurrentRecommendationCard({
  recommendation,
  farm,
  weatherUnavailable,
  onViewPlan,
}: {
  recommendation: IrrigationRecommendation;
  farm: Farm;
  weatherUnavailable?: boolean;
  onViewPlan?: () => void;
}) {
  const { t } = usePreferences();
  const statusMeta = STATUS_META[recommendation.status] ?? STATUS_META.insufficient;
  const urgencyMeta = URGENCY_META[recommendation.urgency] ?? URGENCY_META.low;
  const context = buildFarmContext(farm);

  const farmChips = [
    { labelKey: "irrigation.crop", value: farm.currentCrop || "—", icon: Sprout },
    { labelKey: "irrigation.growthStage", value: context.growth.stageLabel || "—", icon: TrendingUp },
    { labelKey: "irrigation.soil", value: farm.soilType || "—", icon: Leaf },
    { labelKey: "irrigation.method", value: farm.irrigationMethod || "—", icon: DropletIcon },
    { labelKey: "irrigation.location", value: farm.location || "—", icon: MapPin },
    { labelKey: "irrigation.landArea", value: farm.landArea || "—", icon: Ruler },
  ];

  const waterNeed =
    recommendation.waterGuidance.relative || t("irrigation.waterCantEstimate");

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-5 py-6">
        {/* Title row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <DropletIcon className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-base font-bold text-foreground">
                {t("irrigation.currentRecommendation")}
              </p>
              <p className="text-xs text-muted-foreground">{t("irrigation.currentRecSub")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusMeta.variant === "neutral" ? "outline" : statusMeta.variant}>
              {t(statusMeta.labelKey)}
            </Badge>
            <Badge variant={urgencyMeta.variant}>{t(urgencyMeta.labelKey)}</Badge>
          </div>
        </div>

        {/* Irrigate within — real timing from the existing recommendation */}
        <div className="rounded-2xl border border-primary/15 bg-primary-soft/40 p-5">
          <div className="flex items-center gap-2 text-primary">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wide">
              {t("irrigation.irrigateWithin")}
            </p>
          </div>
          <p className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {recommendation.timing?.recommended_time || t("irrigation.waterCantEstimate")}
          </p>
          {recommendation.timing?.reason ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {recommendation.timing.reason}
            </p>
          ) : null}
        </div>

        {/* Estimated water need — real guidance, never a fabricated number */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background p-4">
            <div className="flex items-center gap-2 text-primary">
              <DropletIcon className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("irrigation.estimatedWaterNeed")}
              </p>
            </div>
            <p className="mt-2 text-base font-semibold leading-relaxed text-foreground">
              {waterNeed}
            </p>
          </div>

          {/* Reason — supporting explanation from the existing recommendation */}
          <div className="rounded-2xl border border-border/70 bg-background p-4">
            <div className="flex items-center gap-2 text-primary">
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("irrigation.reason")}
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {recommendation.recommendation || "—"}
            </p>
          </div>
        </div>

        {/* Farm / soil / weather context — real saved data */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("irrigation.myFarm")}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            {farmChips.map(({ labelKey, value, icon: Icon }) => (
              <div key={labelKey} className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t(labelKey)}
                </dt>
                <dd className="text-sm font-semibold text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Impact context */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ImpactRow
            icon={<Wind className="h-4 w-4" aria-hidden="true" />}
            label={t("irrigation.weatherImpact")}
            value={recommendation.weatherImpact}
          />
          <ImpactRow
            icon={<Leaf className="h-4 w-4" aria-hidden="true" />}
            label={t("irrigation.soilImpact")}
            value={recommendation.soilImpact}
          />
          <ImpactRow
            icon={<Layers className="h-4 w-4" aria-hidden="true" />}
            label={t("irrigation.cropStageImpact")}
            value={recommendation.cropStageImpact}
          />
          <ImpactRow
            icon={<CloudSun className="h-4 w-4" aria-hidden="true" />}
            label={t("irrigation.rainAdjustment")}
            value={recommendation.rainAdjustment}
          />
        </div>

        {/* Limitations — honest degradation, preserved from before */}
        {weatherUnavailable ? (
          <InfoNote text={t("irrigation.weatherUnavailable")} tone="neutral" />
        ) : null}

        {/* View Irrigation Plan — reuses the existing saved-history flow */}
        <div className="mt-auto pt-1">
          <Button size="lg" className="w-full sm:w-auto" onClick={onViewPlan}>
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            {t("irrigation.viewIrrigationPlan")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Next Irrigation (bottom strip) — UI redesign                        */
/* ------------------------------------------------------------------ */

function NextIrrigationStrip({
  recommendation,
}: {
  recommendation: IrrigationRecommendation;
}) {
  const { t } = usePreferences();

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-base font-bold text-foreground">
              {t("irrigation.nextIrrigation")}
            </p>
            <p className="text-xs text-muted-foreground">{t("irrigation.nextIrrigationSub")}</p>
            <p className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground">
              {recommendation.timing?.recommended_time || t("irrigation.waterCantEstimate")}
            </p>
            {recommendation.nextCheck ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("irrigation.nextCheck")}: {recommendation.nextCheck}
              </p>
            ) : null}
          </div>
        </div>
        {recommendation.timing?.reason ? (
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {recommendation.timing.reason}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ImpactRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background p-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="text-sm leading-relaxed text-foreground">{value || "—"}</dd>
      </div>
    </div>
  );
}

function HistoryRow({
  record,
  open,
  onToggle,
}: {
  record: IrrigationRecommendationRecord;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = usePreferences();
  const rec = record.recommendation;
  const meta = STATUS_META[rec.status] ?? STATUS_META.insufficient;
  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full flex-wrap items-center justify-between gap-3 text-left cursor-pointer"
          aria-expanded={open}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <DropletIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {t(meta.labelKey)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("irrigation.reportedOn", { date: formatDate(record.createdAt) })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={meta.variant === "neutral" ? "outline" : meta.variant}>
              {t("irrigation.urgency." + rec.urgency)}
            </Badge>
          </div>
        </button>

        {open ? (
          <div className="mt-4 border-t border-border pt-4">
            <ResultCard recommendation={rec} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* ResultCard — reused unchanged for expanded history rows              */
/* ------------------------------------------------------------------ */

function ResultCard({
  recommendation,
  weatherUnavailable = false,
}: {
  recommendation: IrrigationRecommendation;
  weatherUnavailable?: boolean;
}) {
  const { t } = usePreferences();
  const statusMeta = STATUS_META[recommendation.status] ?? STATUS_META.insufficient;
  const urgencyMeta = URGENCY_META[recommendation.urgency] ?? URGENCY_META.low;
  const StatusIcon = statusMeta.icon;

  const limitations = [
    ...(recommendation.limitations ?? []),
    ...(weatherUnavailable ? [t("irrigation.weatherUnavailable")] : []),
  ];

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <Card>
          <CardContent className="space-y-4 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <StatusIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <Badge variant={statusMeta.variant === "neutral" ? "outline" : statusMeta.variant}>
                {t(statusMeta.labelKey)}
              </Badge>
              <Badge variant={urgencyMeta.variant}>{t(urgencyMeta.labelKey)}</Badge>
            </div>

            <p className="text-sm font-medium leading-relaxed text-foreground">
              {recommendation.recommendation}
            </p>

            {/* Timing */}
            {recommendation.timing?.recommended_time ? (
              <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-foreground">
                    {t("irrigation.timing")}:{" "}
                  </span>
                  {recommendation.timing.recommended_time}
                  {recommendation.timing.reason ? ` — ${recommendation.timing.reason}` : ""}
                </div>
              </div>
            ) : null}

            {/* Water guidance */}
            <div className="flex items-start gap-2 rounded-xl bg-primary-soft/40 p-3 text-sm">
              <DropletIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold text-foreground">{t("irrigation.waterGuidance")}</p>
                <p className="mt-0.5 leading-relaxed text-foreground/90">
                  {recommendation.waterGuidance.relative || t("irrigation.waterCantEstimate")}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ImpactRow
                icon={<Wind className="h-4 w-4" aria-hidden="true" />}
                label={t("irrigation.weatherImpact")}
                value={recommendation.weatherImpact}
              />
              <ImpactRow
                icon={<Leaf className="h-4 w-4" aria-hidden="true" />}
                label={t("irrigation.soilImpact")}
                value={recommendation.soilImpact}
              />
              <ImpactRow
                icon={<Layers className="h-4 w-4" aria-hidden="true" />}
                label={t("irrigation.cropStageImpact")}
                value={recommendation.cropStageImpact}
              />
              <ImpactRow
                icon={<CloudSun className="h-4 w-4" aria-hidden="true" />}
                label={t("irrigation.rainAdjustment")}
                value={recommendation.rainAdjustment}
              />
            </dl>

            {recommendation.nextCheck ? (
              <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-foreground">
                  <span className="font-semibold">{t("irrigation.nextCheck")}: </span>
                  {recommendation.nextCheck}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {recommendation.importantNotes && recommendation.importantNotes.length > 0 ? (
          <Card>
            <CardContent className="space-y-2 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("irrigation.importantNotes")}
              </p>
              <ul className="space-y-1.5">
                {recommendation.importantNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    {note}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <InfoNote text={t("irrigation.advisoryNote")} tone="warning" />

        {limitations.length > 0 ? (
          <Card>
            <CardContent className="space-y-2 py-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                {t("irrigation.limitationsTitle")}
              </p>
              <ul className="space-y-1">
                {limitations.map((lim, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
                    {lim}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
