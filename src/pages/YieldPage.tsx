import * as React from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  ChevronDown,
  Info,
  Leaf,
  ShieldCheck,
  Sprout,
  TrendingUp,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { PageHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { useFarm } from "../context/FarmContext";
import { buildFarmContext } from "../lib/farm-context";
import { estimateYieldForFarm, buildYieldComparison } from "../lib/yield-service";
import { cn } from "../lib/utils";
import { LoadingState } from "../components/layout/loading-state";

// Lazy-load the chart component so recharts is split into its own chunk.
const YieldComparisonChart = React.lazy(
  () =>
    import("../components/yield/yield-comparison-chart").then((m) => ({
      default: m.YieldComparisonChart,
    }))
);

/**
 * AI Yield Prediction (UI redesign).
 *
 * All numbers on this page come from the deterministic yield estimator
 * (`estimateYieldForFarm`) which derives them ONLY from the farmer's real
 * saved profile — crop, planting date, irrigation, soil, land area. Nothing is
 * hardcoded and nothing is fabricated: if the profile is missing critical
 * inputs, the page says so honestly instead of showing a made-up figure.
 *
 * Layout follows the reference: compact two-column grid — Expected Yield
 * (left) | Yield Comparison chart (right) — with a functional "View Detailed
 * Analysis" disclosure that breaks down exactly which real inputs shaped the
 * estimate.
 */

function formatHarvestDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function MetricTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-3.5">
      <div className="flex items-center gap-1.5 text-primary">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-lg font-bold tracking-tight text-foreground">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export default function YieldPage() {
  const { farm } = useFarm();

  const estimate = React.useMemo(() => (farm ? estimateYieldForFarm(farm) : null), [farm]);
  const chartData = React.useMemo(
    () => (farm && estimate ? buildYieldComparison(farm, estimate) : []),
    [farm, estimate]
  );
  const context = React.useMemo(() => (farm ? buildFarmContext(farm) : null), [farm]);

  const [analysisOpen, setAnalysisOpen] = React.useState(false);

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="AI Yield Prediction"
          description="Set up your farm profile first — yield prediction is built from your real crop, planting date, soil, and irrigation data."
          action={
            <Button asChild size="lg">
              <Link to="/farm-setup">Set up my farm</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const canEstimate = Boolean(farm.currentCrop?.trim());
  const stageLabel = context?.growth.stageLabel ?? "Growth stage unavailable";
  const ageKnown = context?.growth.cropAgeDays !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Yield Prediction"
        subtitle={`Expected yield for your ${farm.currentCrop || "crop"} — an estimate built from your saved farm profile, not a guess.`}
      />

      {!canEstimate ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Sprout className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-bold text-foreground">Add your crop to see a prediction</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Yield prediction starts with the crop you&apos;re growing. Add it to your farm
                profile and we&apos;ll estimate the expected yield from your real farm data.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/farm-profile">Update farm profile</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left — Expected Yield */}
          <Card className="lg:col-span-2">
            <CardContent className="flex h-full flex-col gap-5 py-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
                    <TrendingUp className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-heading text-base font-bold text-foreground">Expected Yield</p>
                    <p className="text-xs text-muted-foreground">{farm.currentCrop}</p>
                  </div>
                </div>
                <Badge variant="success">Estimate</Badge>
              </div>

              {/* Big yield number */}
              <div className="rounded-2xl border border-primary/15 bg-primary-soft/40 p-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Predicted yield
                </p>
                <p className="mt-2 font-heading text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
                  {estimate?.estimatedYield.toFixed(1)}
                  <span className="ml-2 align-middle text-sm font-semibold text-muted-foreground">
                    {estimate?.unit}
                  </span>
                </p>
                <p
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 text-sm font-semibold",
                    (estimate?.deltaPercent ?? 0) >= 0 ? "text-success" : "text-danger"
                  )}
                >
                  {(estimate?.deltaPercent ?? 0) >= 0 ? "+" : ""}
                  {estimate?.deltaPercent}% vs reference season
                </p>
              </div>

              {/* Supporting metrics */}
              <div className="grid grid-cols-2 gap-3">
                <MetricTile
                  icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                  label="Confidence"
                  value={`${estimate?.confidence}%`}
                  sub="Data completeness"
                />
                <MetricTile
                  icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
                  label="Harvest in"
                  value={estimate?.daysToHarvest !== null ? `${estimate?.daysToHarvest} days` : "—"}
                  sub={
                    estimate?.harvestDate
                      ? `Est. ${formatHarvestDate(estimate.harvestDate)}`
                      : "Add planting date"
                  }
                />
              </div>

              {/* Range + crop age */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">
                  Range: {estimate?.lowerBound.toFixed(1)} – {estimate?.upperBound.toFixed(1)}{" "}
                  {estimate?.unit}
                </Badge>
                {ageKnown ? (
                  <Badge variant="neutral">
                    {context?.growth.cropAgeDays} days since planting
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {stageLabel} · Based on your saved crop, planting date, soil, and irrigation
                method.
              </p>

              {/* View Detailed Analysis — functional disclosure */}
              <div className="mt-auto">
                <Button
                  variant="outline"
                  className="w-full"
                  aria-expanded={analysisOpen}
                  onClick={() => setAnalysisOpen((o) => !o)}
                >
                  View Detailed Analysis
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      analysisOpen && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right — Yield Comparison */}
          <div className="lg:col-span-3">
            <React.Suspense
              fallback={
                <div className="flex h-72 items-center justify-center rounded-2xl border border-border bg-card">
                  <LoadingState rows={2} title="Loading chart…" />
                </div>
              }
            >
              <YieldComparisonChart data={chartData} />
            </React.Suspense>
          </div>
        </div>
      )}

      {/* Detailed analysis — breaks down the real inputs behind the number */}
      {canEstimate && estimate ? (
        <section
          id="yield-analysis"
          className={cn(
            "grid transition-all duration-300",
            analysisOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
          aria-hidden={!analysisOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-4 pt-1">
              <Card>
                <CardContent className="space-y-4 py-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Leaf className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <p className="font-heading text-sm font-bold text-foreground">
                      What shaped this prediction
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {estimate.factorsUsed.map((f) => (
                      <div
                        key={f.label}
                        className="rounded-xl border border-border/70 bg-background p-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {f.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{f.value}</p>
                      </div>
                    ))}
                    {estimate.missingInputs.length > 0 ? (
                      <div className="rounded-xl border border-dashed border-warning/50 bg-warning/5 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-warning">
                          Missing (widen the range)
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {estimate.missingInputs.join(", ")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    The estimate compares your farm&apos;s recorded conditions against a typical
                    regional baseline for {farm.currentCrop}. Confidence reflects how complete
                    your farm profile is — add your variety, soil type, irrigation method, and
                    planting date to tighten the range.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      ) : null}

      {/* Disclaimer — preserved */}
      <Alert variant="info">
        <Info className="h-5 w-5" aria-hidden="true" />
        <AlertDescription>
          Yield predictions are estimates based on available farm information and conditions.
          They are not guaranteed harvest results.
        </AlertDescription>
      </Alert>
    </div>
  );
}
