import * as React from "react";
import { Link } from "react-router-dom";
import {
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
import { RecommendationCard } from "../components/crop-recommendation/recommendation-card";
import { buildFarmContext } from "../lib/farm-context";
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

  const farmContext = buildFarmContext(farm);

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

  const weatherUnavailable =
    weather.status === "error" ||
    weather.status === "idle" ||
    (weather.status === "ready" && !weather.weather);

  return (
    <div className="space-y-6">
      <PageHeader title={t("cropRec.title")} subtitle={t("cropRec.subtitle")} />

      {/* Farm Context — real saved data used for recommendations */}
      <section className="space-y-3">
        <SectionHeader title={t("cropRec.myFarm")} subtitle={t("cropRec.myFarmSub")} />
        <FarmContextCard farm={farm} />
      </section>

      {/* Weather note — honest degradation, never a fake value */}
      {weatherUnavailable ? (
        <InfoNote text={t("cropRec.weatherUnavailable")} tone="neutral" />
      ) : null}

      {/* Action — Get Crop Recommendations */}
      <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary-soft/40 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("cropRec.getRecommendations")}
              </p>
              <p className="text-xs text-muted-foreground">
                {farmContext.crop.name || t("cropRec.currentCrop")}
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={runRecommendations}
            disabled={runStatus === "loading"}
            className="shrink-0"
          >
            {runStatus === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("cropRec.gettingRecommendations")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {t("cropRec.getRecommendations")}
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
            <p className="text-base font-semibold text-foreground">{t("cropRec.analyzing")}</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {t("cropRec.analyzeDesc")}
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
                  {t("cropRec.missingTitle")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t("cropRec.missingDesc")}</p>
                {missingInfo.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {missingInfo.map((m) => (
                      <li
                        key={m}
                        className="flex items-center gap-2 text-sm font-medium text-foreground"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
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
                {t("cropRec.updateProfile")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* AI error — friendly retry, never raw errors */}
      {runStatus === "error" ? (
        <ErrorState
          title={t("cropRec.errorTitle")}
          message={runError ?? t("cropRec.errorDesc")}
          onRetry={runRecommendations}
        />
      ) : null}

      {/* Successful result */}
      {runStatus === "success" && result ? (
        <ResultReport record={result} weatherUnavailable={weatherUnavailable} onRegenerate={runRecommendations} />
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