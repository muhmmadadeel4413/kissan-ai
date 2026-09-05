import * as React from "react";
import {
  ChevronRight,
  Clock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { LoadingState } from "../components/layout/loading-state";
import { ErrorState } from "../components/layout/error-state";
import { useFarmRisks } from "../hooks/useFarmRisks";
import { useI18n } from "../context/PreferencesContext";
import type { Level, RiskAlert } from "../types";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Level filter definition — All / High / Medium / Low                 */
/* ------------------------------------------------------------------ */

type AlertFilter = "all" | Level;

const FILTERS: { key: AlertFilter; labelKey: string }[] = [
  { key: "all", labelKey: "risks.filterAll" },
  { key: "high", labelKey: "risks.filterHigh" },
  { key: "medium", labelKey: "risks.filterMedium" },
  { key: "low", labelKey: "risks.filterLow" },
];

const LEVEL_RANK: Record<Level, number> = { high: 0, medium: 1, low: 2 };

/* ------------------------------------------------------------------ */
/* Severity presentation — derived from the existing alert level.      */
/* ------------------------------------------------------------------ */

const SEVERITY_META: Record<
  Level,
  {
    labelKey: string;
    chip: string;
    text: string;
    dot: string;
    bar: string;
    tint: string;
    icon: React.ReactNode;
  }
> = {
  high: {
    labelKey: "risks.highRisk",
    chip: "bg-danger-soft text-danger ring-danger/20",
    text: "text-danger",
    dot: "bg-danger",
    bar: "bg-danger",
    tint: "bg-danger/[0.04]",
    icon: <ShieldAlert className="h-5 w-5" aria-hidden="true" />,
  },
  medium: {
    labelKey: "risks.mediumRisk",
    chip: "bg-warning-soft text-warning ring-warning/20",
    text: "text-warning",
    dot: "bg-warning",
    bar: "bg-warning",
    tint: "bg-warning/[0.05]",
    icon: <ShieldAlert className="h-5 w-5" aria-hidden="true" />,
  },
  low: {
    labelKey: "risks.lowRisk",
    chip: "bg-success-soft text-success ring-success/15",
    text: "text-success",
    dot: "bg-success",
    bar: "bg-success",
    tint: "bg-success/[0.05]",
    icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
  },
};

/* ------------------------------------------------------------------ */
/* Time indicators (existing behaviour, preserved)                     */
/* ------------------------------------------------------------------ */

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function relativeTime(iso: string | null, t: Translate): string {
  if (!iso) return t("risks.notAssessed");
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return t("risks.notAssessed");
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60_000));
  if (mins < 1) return t("risks.justNow");
  if (mins < 60) return t("risks.minAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("risks.hrAgo", { n: hours });
  const days = Math.floor(hours / 24);
  return days > 1 ? t("risks.daysAgo", { n: days }) : t("risks.dayAgo", { n: days });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/* Alert row — horizontal card matching the reference layout           */
/* ------------------------------------------------------------------ */

function AlertRow({ alert }: { alert: RiskAlert }) {
  const { t } = useI18n();
  const severity = SEVERITY_META[alert.level];

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-200 hover:shadow-lift sm:gap-4 sm:p-5",
        severity.tint
      )}
    >
      {/* Severity accent bar — left edge, colour-coded from the real level */}
      <span
        className={cn("absolute inset-y-0 left-0 w-1", severity.bar)}
        aria-hidden="true"
      />

      {/* Severity icon chip (colour-coded from the real alert level) */}
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
          severity.chip
        )}
        aria-hidden="true"
      >
        {severity.icon}
      </span>

      {/* Alert content */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider",
              severity.text
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", severity.dot)} aria-hidden="true" />
            {t(severity.labelKey)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <time dateTime={alert.createdAt}>{relativeTime(alert.createdAt, t)}</time>
          </span>
        </div>

        <p className="truncate text-sm font-semibold text-foreground sm:text-[15px]">
          {alert.title}
        </p>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {alert.explanation}
        </p>
      </div>

      {/* Action affordance — visual only, no fake interaction */}
      <ChevronRight
        className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page — Alerts (existing /risks route, redesigned UI)                */
/* ------------------------------------------------------------------ */

export default function RisksPage() {
  const { t } = useI18n();
  const {
    farm,
    risks,
    counts,
    limitations,
    status,
    assessing,
    error,
    assessedAt,
    refresh,
    retry,
  } = useFarmRisks();

  const [filter, setFilter] = React.useState<AlertFilter>("all");

  const filtered = React.useMemo(() => {
    const list = filter === "all" ? risks : risks.filter((r) => r.level === filter);
    return [...list].sort(
      (a, b) =>
        LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [risks, filter]);

  const filterCount = (key: AlertFilter) =>
    key === "all" ? risks.length : counts[key];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("risks.alerts")}
        subtitle={
          farm
            ? t("risks.subtitle", { crop: farm.currentCrop })
            : t("risks.subtitleNoFarm")
        }
        action={
          <Button variant="outline" size="sm" onClick={refresh} disabled={assessing}>
            <RefreshCw className={cn("h-4 w-4", assessing && "animate-spin")} aria-hidden="true" />
            <span className="hidden sm:inline">{assessing ? t("risks.assessing") : t("risks.refresh")}</span>
            <span className="sm:hidden">{t("risks.refresh")}</span>
          </Button>
        }
      />

      {status === "loading" ? (
        <LoadingState rows={3} title={t("risks.loadingAlerts")} />
      ) : status === "error" ? (
        <ErrorState
          title={t("risks.couldntLoad")}
          message={error ?? t("risks.loadError")}
          onRetry={retry}
        />
      ) : (
        <>
          {/* Limitations — honest about missing inputs, never guessed */}
          {limitations.length > 0 ? (
            <div className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <ul className="space-y-1">
                {limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Filter tabs — All / High / Medium / Low, driven by real data */}
          <div role="group" aria-label={t("risks.filterSeverityAria")} className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, labelKey }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-soft"
                      : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted"
                  )}
                >
                  {t(labelKey)}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs tabular-nums transition-colors duration-200",
                      active
                        ? "bg-primary-foreground/15 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {filterCount(key)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Compact status strip — severity counts + last assessed */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {(["high", "medium", "low"] as Level[]).map((level) => (
                <span key={level} className="inline-flex items-center gap-1.5 font-medium">
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_META[level].dot)}
                    aria-hidden="true"
                  />
                  {counts[level]} {t(SEVERITY_META[level].labelKey)}
                </span>
              ))}
            </div>
            <span>
              {t("risks.lastAssessed", {
                date: formatDateTime(assessedAt),
                relative: relativeTime(assessedAt, t),
              })}
            </span>
          </div>

          {/* No alerts at all */}
          {risks.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" />}
              title={t("risks.noAlerts")}
              description={t("risks.noAlertsDesc")}
            />
          ) : filtered.length === 0 ? (
            /* Selected filter has no results */
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" />}
              title={t("risks.noFilterAlerts", { level: filter })}
              description={t("risks.noFilterDesc", { level: filter })}
              action={
                <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                  {t("risks.viewAllAlerts")}
                </Button>
              }
            />
          ) : (
            /* Real alert feed — horizontal rows, highest severity first */
            <div className="space-y-3">
              {filtered.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
