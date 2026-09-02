import * as React from "react";
import {
  Bug,
  CloudRain,
  Droplets,
  Leaf,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { PageHeader, SectionHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { LoadingState } from "../components/layout/loading-state";
import { ErrorState } from "../components/layout/error-state";
import { useFarmRisks } from "../hooks/useFarmRisks";
import type { RiskAlert, RiskType } from "../types";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Shared level → emoji + badge variant (🟢 LOW / 🟡 MEDIUM / 🔴 HIGH) */
/* ------------------------------------------------------------------ */

export function levelBadge(level: "low" | "medium" | "high") {
  const map = {
    low: { variant: "success" as const, label: "LOW", dot: "bg-success" },
    medium: { variant: "warning" as const, label: "MEDIUM", dot: "bg-warning" },
    high: { variant: "danger" as const, label: "HIGH", dot: "bg-danger" },
  };
  return map[level];
}

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

function riskTypeLabel(type: RiskType): { label: string; icon: React.ReactNode } {
  return RISK_TYPE_META[type] ?? { label: "Risk", icon: <ShieldAlert className="h-4 w-4" aria-hidden="true" /> };
}

/* ------------------------------------------------------------------ */
/* Relative "last assessed" label                                      */
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
/* Risk card                                                           */
/* ------------------------------------------------------------------ */

function RiskCard({ risk }: { risk: RiskAlert }) {
  const badge = levelBadge(risk.level);
  const meta = riskTypeLabel(risk.riskType);

  return (
    <Card
      className={cn(
        "overflow-hidden",
        risk.level === "high" && "border-danger/40",
        risk.level === "medium" && "border-warning/40",
        risk.level === "low" && "border-border"
      )}
    >
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {meta.icon}
          </span>
          <div>
            <CardTitle className="text-sm">{risk.title}</CardTitle>
            <p className="text-xs font-medium text-muted-foreground">{meta.label}</p>
          </div>
        </div>
        <Badge variant={badge.variant}>
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", badge.dot)} aria-hidden="true" />
          <span className="ml-1">{badge.label}</span>
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {/* Why */}
        <p className="text-foreground/90">{risk.explanation}</p>

        {/* Evidence */}
        {risk.evidence.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Why this matters
            </p>
            <ul className="space-y-1.5">
              {risk.evidence.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-soft ring-2 ring-primary/30" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Recommended actions */}
        {risk.recommendedActions.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What to do
            </p>
            <ol className="list-decimal space-y-1.5 pl-4 text-foreground/90">
              {risk.recommendedActions.map((a, i) => (
                <li key={i} className="break-words">{a}</li>
              ))}
            </ol>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          This is an advisory assessment based on your saved farm, crop, weather,
          and diagnosis data — not a diagnosis.
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
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

  const [filter, setFilter] = React.useState<"all" | "high" | "medium" | "low">("all");

  const high = risks.filter((r) => r.level === "high");
  const medium = risks.filter((r) => r.level === "medium");
  const low = risks.filter((r) => r.level === "low");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farm Risk"
        subtitle={
          farm
            ? `Risks that could affect your ${farm.currentCrop} crop right now`
            : "Understand what could threaten your crop"
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
        <LoadingState rows={2} title="Assessing your farm risks…" />
      ) : status === "error" ? (
        <ErrorState
          title="Couldn't update your farm risk assessment"
          message={error ?? "We couldn't update your farm risk assessment right now. Please try again."}
          onRetry={retry}
        />
      ) : (
        <>
          {/* Overall status */}
          <Card>
            <CardContent className="space-y-3 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="text-sm font-semibold text-foreground">Overall status</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last assessed: {formatDateTime(assessedAt)} ({relativeTime(assessedAt)})
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <StatusPill label="High" count={counts.high} tone="high" />
                <StatusPill label="Medium" count={counts.medium} tone="medium" />
                <StatusPill label="Low" count={counts.low} tone="low" />
              </div>
            </CardContent>
          </Card>

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

          {/* Level filter toggle */}
          {risks.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(["all", "high", "medium", "low"] as const).map((level) => {
                const count =
                  level === "all" ? risks.length
                  : level === "high" ? high.length
                  : level === "medium" ? medium.length
                  : low.length;
                const active = filter === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFilter(level)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    )}
                  >
                    {level === "all" ? "All" : level.charAt(0).toUpperCase() + level.slice(1)}{" "}
                    <span className={cn("ml-1", active ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Empty state — no meaningful risks detected */}
          {risks.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" />}
              title="No significant risks detected"
              description={
                "No significant risks were detected from the available farm and weather information. We don't invent alerts we can't back up — check back when conditions change."
              }
            />
          ) : (
            <>
              {/* High */}
              {high.length > 0 && (filter === "all" || filter === "high") ? (
                <section className="space-y-3">
                  <SectionHeader title="High risks" subtitle="Take action soon" />
                  <div className="space-y-3">
                    {high.map((r) => (
                      <RiskCard key={r.id} risk={r} />
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Medium */}
              {medium.length > 0 && (filter === "all" || filter === "medium") ? (
                <section className="space-y-3">
                  <SectionHeader title="Medium risks" subtitle="Monitor closely" />
                  <div className="space-y-3">
                    {medium.map((r) => (
                      <RiskCard key={r.id} risk={r} />
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Low */}
              {low.length > 0 && (filter === "all" || filter === "low") ? (
                <section className="space-y-3">
                  <SectionHeader title="Low risks" subtitle="Worth a look" />
                  <div className="space-y-3">
                    {low.map((r) => (
                      <RiskCard key={r.id} risk={r} />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status pill                                                         */
/* ------------------------------------------------------------------ */

function StatusPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "high" | "medium" | "low";
}) {
  const dot =
    tone === "high" ? "bg-danger" : tone === "medium" ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dot)} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-heading text-lg font-bold leading-none text-foreground">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}