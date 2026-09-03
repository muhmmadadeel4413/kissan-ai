import * as React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  CloudSun,
  History,
  Loader2,
  ShieldAlert,
  Sparkles,
  Sprout,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PageHeader, SectionHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { LoadingState } from "../components/layout/loading-state";
import { ErrorState } from "../components/layout/error-state";
import { FarmContextCard } from "../components/crop-recommendation/farm-context-card";
import {
  CropRankRow,
  RecommendationCard,
} from "../components/crop-recommendation/recommendation-card";
import { useFarm } from "../context/FarmContext";
import { useFarmWeather } from "../hooks/useFarmWeather";
import { usePreferences } from "../context/PreferencesContext";
import {
  fetchCropRecommendations,
  requestCropRecommendations,
  type RecommendationWeatherInput,
} from "../lib/crop-recommendation-service";
import type { CropRecommendationRecord } from "../types";

/**
 * Smart Crop Recommendation (Prompt 13).
 *
 * Answers "Which crops may suit my farm?" by reusing the existing Farm Context
 * Engine (real saved farm + deterministic growth) and the existing Weather
 * Intelligence (live data when available). The AI reasoning runs server-side in
 * the `recommend-crops` Edge Function (Gemini, structured JSON, validated and
 * persisted via service role) and always reflects real data — never mocked.
 *
 * UI (redesign): reference-style two-column layout — "Your Conditions" card
 * (real farm data) + "Top Recommended Crops" card (real ranked results with a
 * functional "View Full Recommendations" action that scrolls to the full
 * report). All existing behaviour (run flow, states, history) is preserved.
 */
export default function CropRecommendationPage() {
  const { farm } = useFarm();
  const { t, language } = usePreferences();
  const weather = useFarmWeather();

  // Farm-dependent routes redirect to /farm-setup; keep a safety net here.
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
  const [result, setResult] = React.useState<CropRecommendationRecord | null>(null);
  const [missingInfo, setMissingInfo] = React.useState<string[]>([]);

  /* ---- History ------------------------------------------------------ */
  const [history, setHistory] = React.useState<CropRecommendationRecord[]>([]);
  const [historyStatus, setHistoryStatus] = React.useState<
    "loading" | "ready" | "error"
  >("loading");
  const [historyReload, setHistoryReload] = React.useState(0);
  const [openRecordId, setOpenRecordId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setHistoryStatus("loading");
    fetchCropRecommendations(farm.id)
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

  const runRecommendations = async () => {
    setRunStatus("loading");
    setRunError(null);
    setResult(null);
    setMissingInfo([]);

    // Forward a real weather snapshot only when it's live; never fabricate one.
    const weatherInput: RecommendationWeatherInput | null =
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
      const res = await requestCropRecommendations({
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
      console.error("crop-recommendation-page:", err);
      setRunError(err instanceof Error ? err.message : t("cropRec.errorDesc"));
      setRunStatus("error");
    }
  };

  // "View Full Recommendations" reveals the full report below the two columns.
  const scrollToFullResults = () => {
    document
      .getElementById("crop-rec-full-results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const weatherUnavailable =
    weather.status === "error" ||
    weather.status === "idle" ||
    (weather.status === "ready" && !weather.weather);

  return (
    <div className="space-y-6">
      <PageHeader title={t("cropRec.title")} subtitle={t("cropRec.subtitle")} />

      {/* Weather note — honest degradation, never a fake value */}
      {weatherUnavailable ? (
        <InfoNote text={t("cropRec.weatherUnavailable")} tone="neutral" />
      ) : null}

      {/* Reference-style two-column layout: conditions + ranked results */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <FarmContextCard farm={farm} />
        <TopRecommendationsCard
          runStatus={runStatus}
          result={result}
          missingInfo={missingInfo}
          runError={runError}
          onRun={runRecommendations}
          onViewFull={scrollToFullResults}
        />
      </div>

      {/* Full report — the target of "View Full Recommendations" */}
      {runStatus === "success" && result ? (
        <section id="crop-rec-full-results" className="scroll-mt-24 space-y-3">
          <ResultReport
            record={result}
            weatherUnavailable={weatherUnavailable}
            onRegenerate={runRecommendations}
          />
        </section>
      ) : null}

      {/* History — real saved records only */}
      <section className="space-y-3">
        <SectionHeader title={t("cropRec.historyTitle")} subtitle={t("cropRec.historySub")} />
        {historyStatus === "loading" ? (
          <LoadingState rows={2} title={t("common.loading")} />
        ) : historyStatus === "error" ? (
          <ErrorState
            title={t("cropRec.historyTitle")}
            message={t("common.error")}
            onRetry={() => setHistoryReload((k) => k + 1)}
          />
        ) : history.length === 0 ? (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title={t("cropRec.noHistory")}
            description={t("cropRec.noHistoryDesc")}
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
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

/**
 * Right column of the reference layout — "Top Recommended Crops".
 * Real ranked results when available; otherwise the honest idle, loading,
 * missing-information, error, or empty state for the existing run flow.
 */
function TopRecommendationsCard({
  runStatus,
  result,
  missingInfo,
  runError,
  onRun,
  onViewFull,
}: {
  runStatus: "idle" | "loading" | "success" | "error" | "insufficient";
  result: CropRecommendationRecord | null;
  missingInfo: string[];
  runError: string | null;
  onRun: () => void;
  onViewFull: () => void;
}) {
  const { t } = usePreferences();

  // Ranked by confidence, descending — real data, never hardcoded.
  const ranked = result
    ? [...result.recommendations].sort((a, b) => b.confidence - a.confidence)
    : [];

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col p-0">
        <div className="border-b border-border p-5">
          <h2 className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            {t("cropRec.topRecsTitle")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("cropRec.topRecsSub")}</p>
        </div>

        <div className="flex flex-1 flex-col p-5">
          {runStatus === "loading" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">{t("cropRec.analyzing")}</p>
              <div className="mt-1 w-full space-y-4 text-left" aria-hidden="true">
                {[{ w: "w-2/3" }, { w: "w-1/2" }, { w: "w-3/4" }].map((s, i) => (
                  <div key={i} className="space-y-2">
                    <div className={`h-3.5 animate-pulse rounded bg-muted ${s.w}`} />
                    <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          ) : runStatus === "insufficient" ? (
            <div className="flex flex-1 flex-col justify-center gap-4 py-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {t("cropRec.missingTitle")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("cropRec.missingDesc")}</p>
                  {missingInfo.length > 0 ? (
                    <ul className="mt-3 space-y-1">
                      {missingInfo.map((m) => (
                        <li
                          key={m}
                          className="flex items-center gap-2 text-xs font-medium text-foreground"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <Button asChild variant="outline" className="self-start">
                <Link to="/farm-profile">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  {t("cropRec.updateProfile")}
                </Link>
              </Button>
            </div>
          ) : runStatus === "error" ? (
            <div className="flex flex-1 items-center">
              <ErrorState
                title={t("cropRec.errorTitle")}
                message={runError ?? t("cropRec.errorDesc")}
                onRetry={onRun}
              />
            </div>
          ) : runStatus === "success" && result ? (
            ranked.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                <Sprout className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">
                  {t("cropRec.noRecommendations")}
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  {t("cropRec.noRecommendationsDesc")}
                </p>
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {ranked.map((rec, i) => (
                  <CropRankRow key={rec.crop} rank={i + 1} recommendation={rec} />
                ))}
              </ol>
            )
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("cropRec.generateTitle")}</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  {t("cropRec.generateDesc")}
                </p>
              </div>
              <Button size="lg" onClick={onRun} className="w-full sm:w-auto">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {t("cropRec.getRecommendations")}
              </Button>
            </div>
          )}
        </div>

        {/* Functional "View Full Recommendations" — scrolls to the real full report */}
        {runStatus === "success" && result && result.recommendations.length > 0 ? (
          <div className="border-t border-border p-4">
            <Button onClick={onViewFull} className="w-full">
              {t("cropRec.viewFull")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function HistoryRow({
  record,
  open,
  onToggle,
}: {
  record: CropRecommendationRecord;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = usePreferences();
  const top = record.recommendations[0] ?? null;
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
              <Sprout className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {top ? top.crop : t("cropRec.noHistory")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("cropRec.reportedOn", { date: formatDate(record.createdAt) })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {top ? (
              <Badge
                variant={
                  top.suitability === "high"
                    ? "success"
                    : top.suitability === "moderate"
                      ? "warning"
                      : "danger"
                }
              >
                {top.confidence}%
              </Badge>
            ) : null}
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </div>
        </button>

        {open ? (
          <div className="mt-4 border-t border-border pt-4">
            <ResultReport record={record} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ResultReport({
  record,
  weatherUnavailable = false,
  onRegenerate,
}: {
  record: CropRecommendationRecord;
  weatherUnavailable?: boolean;
  onRegenerate?: () => void;
}) {
  const { t } = usePreferences();

  const limitations = record.limitations.slice();
  if (weatherUnavailable) {
    limitations.push(t("cropRec.weatherUnavailable"));
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <SectionHeader
          title={t("cropRec.resultsTitle")}
          subtitle={t("cropRec.resultsSub")}
          action={
            onRegenerate ? (
              <Button variant="outline" size="sm" onClick={onRegenerate}>
                <Loader2 className="h-4 w-4" aria-hidden="true" />
                {t("cropRec.retry")}
              </Button>
            ) : undefined
          }
        />
        {record.recommendations.map((rec) => (
          <RecommendationCard key={rec.crop} recommendation={rec} />
        ))}
      </section>

      {record.summary ? (
        <Card>
          <CardContent className="space-y-1 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("cropRec.summaryTitle")}
            </p>
            <p className="text-sm leading-relaxed text-foreground">{record.summary}</p>
          </CardContent>
        </Card>
      ) : null}

      <InfoNote text={t("cropRec.advisoryNote")} tone="warning" />

      {limitations.length > 0 ? (
        <Card>
          <CardContent className="space-y-2 py-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              {t("cropRec.limitationsTitle")}
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
    </div>
  );
}
