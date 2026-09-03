import * as React from "react";
import {
  Bug,
  ChevronRight,
  Clock,
  CloudRain,
  Droplets,
  Leaf,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { LoadingState } from "../components/layout/loading-state";
import { ErrorState } from "../components/layout/error-state";
import { useFarmRisks } from "../hooks/useFarmRisks";
import type { Level, RiskAlert, RiskType } from "../types";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Level filter definition — All / High / Medium / Low                 */
/* ------------------------------------------------------------------ */

type AlertFilter = "all" | Level;

const FILTERS: { key: AlertFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

const LEVEL_RANK: Record<Level, number> = { high: 0, medium: 1, low: 2 };

/* ------------------------------------------------------------------ */
/* Severity presentation — derived from the existing alert level.      */
/* ------------------------------------------------------------------ */

const SEVERITY_META: Record<
  Level,
  { label: string; chip: string; text: string; dot: string }
> = {
  high: {
    label: "High Risk",
    chip: "bg-danger-soft text-danger ring-danger/20",
    text: "text-danger",
    dot: "bg-danger",
  },
  medium: {
    label: "Medium Risk",
    chip: "bg-warning-soft text-warning ring-warning/20",
    text: "text-warning",
    dot: "bg-warning",
  },
  low: {
    label: "Low Risk",
    chip: "bg-success-soft text-success ring-success/15",
    text: "text-success",
    dot: "bg-success",
  },
};

/* ------------------------------------------------------------------ */
/* Risk type → label + icon                                            */
/* ------------------------------------------------------------------ */

const RISK_TYPE_META: Record<RiskType, { label: string; icon: React.ReactNode }> = {
  disease: { label: "Disease Risk", icon: <Leaf className="h-4 w-4" aria-hidden="true" /> },
  pest: { label: "Pest Risk", icon: <Bug className="h-4 w-4" aria-hidden="true" /> },
  weather: { label: "Weather Risk", icon: <CloudRain className="h-4 w-4" aria-hidden="true" /> },
  irrigation: { label: "Irrigation Risk", icon: <Droplets className="h-4 w-4" aria-hidden="true" /> },
  crop_stress: { label: "Crop Stress", icon: <Thermometer className="h-4 w-4" aria-hidden="true" /> },
};

function riskTypeMeta(type: RiskType): { label: string; icon: React.ReactNode } {
  return RISK_TYPE_META[type] ?? { label: "Risk", icon: <ShieldAlert className="h-4 w-4" aria-hidden="true" /> };
}

/* ------------------------------------------------------------------ */
/* Time indicators (existing behaviour, preserved)                     */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string | null): string {
  if (!iso) return "Not assessed yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Not assessed yet";
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
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
  const severity = SEVERITY_META[alert.level];
  const meta = riskTypeMeta(alert.riskType);

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-shadow duration-200 hover:shadow-lift sm:gap-4 sm:p-5">
      {/* Severity icon chip (colour-coded from the real alert level) */}
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
          severity.chip
        )}
        aria-hidden="true"
      >
        {meta.icon}
      </span>

      {/* Alert content */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide",
              severity.text
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", severity.dot)} aria-hidden="true" />
            {severity.label}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <time dateTime={alert.createdAt}>{relativeTime(alert.createdAt)}</time>
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
        title="Alerts"
        subtitle={
          farm
            ? `Risks that could affect your ${farm.currentCrop} crop right now — from your farm, weather, and crop-health data.`
            : "Stay on top of risks that could affect your farm"
        }
        action={
          <Button variant="outline" size="sm" onClick={refresh} disabled={assessing}>
            <RefreshCw className={cn("h-4 w-4", assessing && "animate-spin")} aria-hidden="true" />
            <span className="hidden sm:inline">{assessing ? "Assessing…" : "Refresh"}</span>
            <span className="sm:hidden">Refresh</span>
          </Button>
        }
      />

      {status === "loading" ? (
        <LoadingState rows={3} title="Loading your alerts…" />
      ) : status === "error" ? (
        <ErrorState
          title="Couldn't load your alerts"
          message={error ?? "We couldn't load your farm alerts right now. Please try again."}
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
          <div role="group" aria-label="Filter alerts by severity" className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label }) => {
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
                  {label}
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
                  {counts[level]} {SEVERITY_META[level].label}
                </span>
              ))}
            </div>
            <span>
              Last assessed: {formatDateTime(assessedAt)} ({relativeTime(assessedAt)})
            </span>
          </div>

          {/* No alerts at all */}
          {risks.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" />}
              title="No alerts right now"
              description="No significant risks were detected from the available farm and weather information. We don't invent alerts we can't back up — check back when conditions change."
            />
          ) : filtered.length === 0 ? (
            /* Selected filter has no results */
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" />}
              title={`No ${filter}-risk alerts right now`}
              description={`There are no ${filter}-risk alerts from your current farm data. Try another filter or view all alerts.`}
              action={
                <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                  View all alerts
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
