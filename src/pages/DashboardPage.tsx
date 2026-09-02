import { Link } from "react-router-dom";
import * as React from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  CloudSun,
  Droplets,
  History,
  Leaf,
  ListChecks,
  MapPin,
  MessageCircle,
  Mic,
  Ruler,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Stethoscope,
  Tag,
  TrendingUp,
  User,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { SectionHeader } from "../components/layout/page-header";
import { StatCard } from "../components/layout/stat-card";
import { EmptyState } from "../components/layout/empty-state";
import { LoadingState } from "../components/layout/loading-state";
import { ErrorState } from "../components/layout/error-state";
import { GrowthStageCard } from "../components/farm/growth-stage-card";
import { WeatherSummaryCard } from "../components/weather/weather-summary-card";
import { TodayActionsCard } from "../components/actions/today-actions-card";
import { UpcomingTasksCard } from "../components/dashboard/upcoming-tasks-card";
import { ExpenseBreakdownChart } from "../components/dashboard/expense-breakdown-chart";
import { ForecastStrip } from "../components/dashboard/forecast-strip";
import { FarmHealthGauge } from "../components/dashboard/farm-health-gauge";
import type { HealthInput } from "../components/dashboard/farm-health-gauge";
import { CropDoctorUploadCard } from "../components/dashboard/crop-doctor-upload-card";
import { buildFarmContext } from "../lib/farm-context";
import { fetchActiveRisks } from "../lib/risk-service";
import { fetchDiagnoses } from "../lib/diagnosis-service";
import { useFarm } from "../context/FarmContext";
import { useRecentActivity } from "../hooks/useRecentActivity";
import { useFarmWeather } from "../hooks/useFarmWeather";
import type { ActivityItem, ActivityKind } from "../lib/activity-service";
import type { Diagnosis, Level, RiskAlert } from "../types";
import { cn } from "../lib/utils";

/**
 * Farm intelligence dashboard (Prompt 11).
 *
 * Every section renders REAL data from the existing Supabase-backed systems —
 * Farm Context (profile + deterministic growth stage), the Today's Actions
 * Decision Engine, Weather Intelligence, the Risk Engine, and the Crop Doctor's
 * stored diagnoses. Nothing here is fabricated: if a data source is missing,
 * empty, or failing, its section degrades independently to an honest loading /
 * empty / error state without blocking the rest of the page.
 */

const LEVEL_META: Record<
  Level,
  { label: string; variant: "danger" | "warning" | "success" }
> = {
  high: { label: "High", variant: "danger" },
  medium: { label: "Medium", variant: "warning" },
  low: { label: "Low", variant: "success" },
};

const ACTIVITY_ICONS: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  diagnosis: Stethoscope,
  action: ListChecks,
  risk: ShieldAlert,
  chat: MessageCircle,
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMinutes = Math.round((Date.now() - then) / 60_000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** One row in the Recent Activity timeline (real records only). */
function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = ACTIVITY_ICONS[item.kind];
  const body = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
          {item.metaLabel ? <Badge variant={item.metaTone}>{item.metaLabel}</Badge> : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatRelativeTime(item.timestamp)}
      </span>
      {item.href ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
    </>
  );

  const inner = (
    <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/40">
      {body}
    </Card>
  );

  if (item.href) {
    return (
      <Link to={item.href} className="block cursor-pointer">
        {inner}
      </Link>
    );
  }
  return inner;
}

export default function DashboardPage() {
  const { farm } = useFarm();

  // Farm-dependent routes are redirected to /farm-setup, but keep a safety
  // net here in case the redirect is bypassed.
  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<Sprout className="h-6 w-6" />}
          title="Set up your farm to unlock Kissan AI"
          description="Add your farmer, farm, and crop details once — every Kissan AI insight is then tailored to your farm."
          action={
            <Button asChild size="lg">
              <Link to="/farm-setup">Create Farm</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Single source of Farm Context — farm data from the active farm combined
  // with deterministic growth info (recomputed from the saved planting date).
  const farmContext = buildFarmContext(farm);

  /* ---- Risk Alerts (real persisted alerts from the Risk Engine) -------- */
  const [riskAlerts, setRiskAlerts] = React.useState<RiskAlert[]>([]);
  const [risksLoading, setRisksLoading] = React.useState(true);
  const [risksError, setRisksError] = React.useState<string | null>(null);
  const [risksReload, setRisksReload] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setRisksLoading(true);
    setRisksError(null);
    fetchActiveRisks(farm.id)
      .then((rows) => {
        if (!cancelled) setRiskAlerts(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRiskAlerts([]);
          setRisksError(
            err instanceof Error ? err.message : "Risk information unavailable. Please try again."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setRisksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [farm.id, risksReload]);

  const riskCounts = React.useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const r of riskAlerts) c[r.level] += 1;
    return c;
  }, [riskAlerts]);

  /* ---- Latest Diagnosis (real Supabase record from the Crop Doctor) ---- */
  const [latestDiagnosis, setLatestDiagnosis] = React.useState<Diagnosis | null>(null);
  const [diagnosisStatus, setDiagnosisStatus] = React.useState<
    "loading" | "ready" | "error"
  >("loading");
  const [diagnosisError, setDiagnosisError] = React.useState<string | null>(null);
  const [diagnosisReload, setDiagnosisReload] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setDiagnosisStatus("loading");
    setDiagnosisError(null);
    fetchDiagnoses(farm.id)
      .then((rows) => {
        if (cancelled) return;
        setLatestDiagnosis(rows[0] ?? null);
        setDiagnosisStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLatestDiagnosis(null);
        setDiagnosisError(
          err instanceof Error
            ? err.message
            : "We couldn't load your latest diagnosis. Please try again."
        );
        setDiagnosisStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [farm.id, diagnosisReload]);

  /* ---- Recent Activity (real records only) ----------------------------- */
  const activity = useRecentActivity(farm.id);
  const { status: weatherStatus } = useFarmWeather();

  /* ---- Health Input — computed from real data signals ------------------ */
  const healthInput: HealthInput = React.useMemo(
    () => ({
      riskCount: riskAlerts.length,
      highRisks: riskCounts.high,
      weatherAvailable: weatherStatus === "ready",
      hasDiagnosis: latestDiagnosis !== null,
      hasActions: activity.items.length > 0,
    }),
    [riskAlerts.length, riskCounts.high, weatherStatus, latestDiagnosis, activity.items.length]
  );

  const latest = latestDiagnosis;
  const latestMeta = latest ? (LEVEL_META[latest.severity] ?? LEVEL_META.medium) : null;

  const quickLinks: Array<{
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { to: "/crop-doctor", label: "Analyze Crop", icon: ScanLine },
    { to: "/assistant", label: "Ask Kissan AI", icon: MessageCircle },
    { to: "/voice", label: "Voice", icon: Mic },
    { to: "/weather", label: "Weather", icon: CloudSun },
    { to: "/risks", label: "Risks", icon: AlertTriangle },
    { to: "/irrigation", label: "Irrigation", icon: Droplets },
    { to: "/yield", label: "Yield", icon: TrendingUp },
    { to: "/actions", label: "Today's Actions", icon: ListChecks },
  ];

  return (
    <div className="space-y-8">
      {/* Premium welcome banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary to-primary-deep p-6 text-primary-foreground shadow-lift sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-leaf-grid opacity-20" aria-hidden="true" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary-foreground/80">
              {farm.currentCrop} · {farm.location}
            </p>
            <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back, {farm.farmerName.split(" ")[0]}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-primary-foreground/90">
              Your AI farming decision assistant is ready — here's what's happening
              on your farm today.
            </p>
          </div>
          <Button
            asChild
            variant="secondary"
            className="bg-white/95 text-primary hover:bg-white shadow-soft"
          >
            <Link to="/farm-setup">Edit Farm</Link>
          </Button>
        </div>
      </section>

      {/* KPI stat cards — every value from real farm data */}
      <section aria-label="Farm summary at a glance">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Crop age"
            value={
              farmContext.growth.cropAgeDays !== null ? (
                <>
                  {farmContext.growth.cropAgeDays}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">days</span>
                </>
              ) : (
                "—"
              )
            }
            hint={farmContext.growth.stageLabel}
            icon={Sprout}
            to="/yield"
          />
          <StatCard
            label="Active risk alerts"
            value={riskAlerts.length}
            hint={
              riskCounts.high > 0
                ? `${riskCounts.high} high priority · ${riskCounts.medium} medium`
                : riskAlerts.length === 0
                  ? "No active risks detected"
                  : `${riskCounts.medium} medium · ${riskCounts.low} low`
            }
            icon={ShieldAlert}
            iconClassName={
              riskCounts.high > 0
                ? "bg-danger-soft text-danger"
                : riskAlerts.length > 0
                  ? "bg-warning-soft text-warning"
                  : undefined
            }
            to="/risks"
          />
          <StatCard
            label="Latest crop check"
            value={latest ? latest.diagnosis.split(" ").slice(0, 2).join(" ") : "No check yet"}
            hint={latest ? `${latest.confidence}% confidence · ${latest.crop}` : "Run the AI Crop Doctor"}
            icon={ScanLine}
            to="/crop-doctor"
          />
          <StatCard
            label="Today's actions"
            value={activity.items.length > 0 ? activity.items.length : "—"}
            hint="Your decision plan"
            icon={ListChecks}
            to="/actions"
          />
        </div>
      </section>

      {/* Quick navigation to existing features */}
      <section className="space-y-3" aria-label="Quick access">
        <SectionHeader title="Quick Access" subtitle="Jump to a Kissan AI tool" />
        <div className="flex flex-wrap gap-2">
          {quickLinks.map(({ to, label, icon: Icon }) => (
            <Button asChild key={to} variant="outline" size="sm">
              <Link to={to}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            </Button>
          ))}
        </div>

        {/* Smart Crop Recommendation — dedicated Quick Access entry */}
        <Card className="transition-colors">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Leaf className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Smart Crop Recommendation</p>
                <p className="text-xs text-muted-foreground">
                  Find crops suited to your farm conditions.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link to="/crop-recommendation">Get Recommendations</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Farm Summary — real entered data from the Farm Context */}
      <section className="space-y-3">
        <SectionHeader title="My Farm" subtitle="The farm Kissan AI is working with" />
        <Card>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <User className="h-3.5 w-3.5" aria-hidden="true" /> Farmer
                </dt>
                <dd className="text-sm font-semibold text-foreground">{farm.farmerName}</dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Location
                </dt>
                <dd className="text-sm font-semibold text-foreground">{farm.location}</dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Ruler className="h-3.5 w-3.5" aria-hidden="true" /> Land area
                </dt>
                <dd className="text-sm font-semibold text-foreground">{farm.landArea}</dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Leaf className="h-3.5 w-3.5" aria-hidden="true" /> Soil
                </dt>
                <dd className="text-sm font-semibold text-foreground">{farm.soilType}</dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Droplets className="h-3.5 w-3.5" aria-hidden="true" /> Irrigation
                </dt>
                <dd className="text-sm font-semibold text-foreground">
                  {farm.irrigationMethod || "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sprout className="h-3.5 w-3.5" aria-hidden="true" /> Crop
                </dt>
                <dd className="text-sm font-semibold text-foreground">{farm.currentCrop}</dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" aria-hidden="true" /> Variety
                </dt>
                <dd className="text-sm font-semibold text-foreground">
                  {farm.currentCropVariety || "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Planting date
                </dt>
                <dd className="text-sm font-semibold text-foreground">
                  {farm.plantingDate
                    ? new Date(farm.plantingDate + "T00:00:00").toLocaleDateString()
                    : "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      {/* Growth stage — derived from saved crop + planting date + today */}
      <section className="space-y-3">
        <SectionHeader title="Growth Stage" subtitle="Crop age and current stage" />
        <GrowthStageCard growth={farmContext.growth} />
      </section>

      {/* ── Two-column intelligence grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* ── Left column ── */}
        <div className="space-y-8">
          {/* Today's Actions — real Decision Engine feed (no hardcoded cards) */}
          <section className="space-y-3">
            <SectionHeader title="Today's Actions" subtitle="Your decision plan, built from real farm data" />
            <TodayActionsCard />
          </section>

          {/* Weather — live conditions + 5-day forecast strip */}
          <section className="space-y-3">
            <SectionHeader title="Weather" subtitle="Conditions that affect your crop today" />
            <WeatherSummaryCard />
            <ForecastStrip />
          </section>

          {/* Crop Doctor — quick upload shortcut */}
          <CropDoctorUploadCard />

          {/* Crop Health — latest real diagnosis from the Crop Doctor */}
          <section className="space-y-3">
            <SectionHeader title="Crop Health" subtitle="Your most recent crop check" />
            {diagnosisStatus === "loading" ? (
              <LoadingState rows={2} title="Loading crop health…" />
            ) : diagnosisStatus === "error" ? (
              <ErrorState
                title="Unable to load diagnosis"
                message={diagnosisError ?? "Please try again."}
                onRetry={() => setDiagnosisReload((k) => k + 1)}
              />
            ) : !latest ? (
              <EmptyState
                icon={<Stethoscope className="h-6 w-6" />}
                title="No crop diagnosis yet"
                description="Analyze a crop photo with the AI Crop Doctor and the result will appear here with severity, confidence, and what to do next."
                action={
                  <Button asChild>
                    <Link to="/crop-doctor">
                      <ScanLine className="h-4 w-4" aria-hidden="true" />
                      Analyze a Crop
                    </Link>
                  </Button>
                }
              />
            ) : (
              <Card>
                <CardContent className="space-y-4 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{latest.diagnosis}</p>
                        <Badge variant={latestMeta?.variant ?? "warning"}>
                          {latestMeta?.label ?? "Medium"} severity
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {latest.crop} · {latest.confidence}% confidence · Diagnosed{" "}
                        {formatDate(latest.createdAt)}
                      </p>
                    </div>
                    {latest.imageUrl ? (
                      <img
                        src={latest.imageUrl}
                        alt={`Crop photo for ${latest.diagnosis}`}
                        loading="lazy"
                        className="h-16 w-16 shrink-0 rounded-xl object-cover bg-muted"
                      />
                    ) : null}
                  </div>

                  {latest.description ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {latest.description}
                    </p>
                  ) : null}

                  {latest.recommendedActions && latest.recommendedActions.length > 0 ? (
                    <div className="space-y-1.5 rounded-xl bg-primary-soft p-4">
                      <p className="text-xs font-semibold text-primary">What to do next</p>
                      <ol className="space-y-1.5">
                        {latest.recommendedActions.slice(0, 3).map((action, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs leading-relaxed text-foreground"
                          >
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                              {i + 1}
                            </span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link to="/crop-doctor">
                        <ScanLine className="h-4 w-4" aria-hidden="true" />
                        Analyze a Crop
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/diagnosis-history">Diagnosis history</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-8">
          <UpcomingTasksCard />

          {/* Risk Alerts — real persisted alerts from the Risk Engine */}
          <section className="space-y-3">
            <SectionHeader title="Risk Alerts" subtitle="Threats to watch for" />
            {risksLoading ? (
              <LoadingState rows={2} title="Loading risk alerts…" />
            ) : risksError ? (
              <ErrorState
                title="Risk information unavailable"
                message={risksError}
                onRetry={() => setRisksReload((k) => k + 1)}
              />
            ) : riskAlerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      No active risks detected
                    </p>
                    <p className="text-xs text-muted-foreground">
                      That doesn't guarantee your crop is completely safe — run an assessment to
                      check for threats.
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/risks">Assess risks</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <Card>
                  <CardContent className="space-y-4 py-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {riskCounts.high > 0
                            ? `${riskCounts.high} high-priority risk${riskCounts.high > 1 ? "s" : ""} to act on`
                            : `${riskAlerts.length} risk alert${riskAlerts.length > 1 ? "s" : ""} detected`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {riskCounts.high} high · {riskCounts.medium} medium · {riskCounts.low} low
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {riskAlerts.slice(0, 3).map((risk) => {
                        const meta = LEVEL_META[risk.level] ?? LEVEL_META.medium;
                        return (
                          <div
                            key={risk.id}
                            className="rounded-xl border border-border bg-background/40 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground">
                                    {risk.title}
                                  </p>
                                  <Badge variant={meta.variant}>
                                    <span
                                      className={cn(
                                        "mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                                        risk.level === "high" && "bg-danger",
                                        risk.level === "medium" && "bg-warning",
                                        risk.level === "low" && "bg-success"
                                      )}
                                      aria-hidden="true"
                                    />
                                    {meta.label} risk
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                  {risk.explanation}
                                </p>
                                {risk.recommendedActions.length > 0 ? (
                                  <p className="mt-2 text-xs leading-relaxed text-foreground/80">
                                    <span className="font-semibold text-foreground">Recommended: </span>
                                    {risk.recommendedActions[0]}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Button asChild variant="outline" size="sm">
                      <Link to="/risks">View all risks</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </section>

          <FarmHealthGauge input={healthInput} />

          <ExpenseBreakdownChart />

          {/* Yield Estimate — honest state; no fabricated number */}
          <section className="space-y-3">
            <SectionHeader title="Yield Estimate" subtitle="Prediction range and confidence" />
            <Card>
              <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <TrendingUp className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Yield estimate is not available yet.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Yield prediction needs crop, weather, and growth history. Collect more farm
                      data to unlock an estimate.
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link to="/yield">View Yield</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      {/* Recent Activity — real records only */}
      <section className="space-y-3">
        <SectionHeader title="Recent Activity" subtitle="What's been happening on your farm" />
        {activity.status === "loading" ? (
          <LoadingState rows={3} title="Loading recent activity…" />
        ) : activity.status === "error" ? (
          <ErrorState
            title="We couldn't load recent activity"
            message={activity.error ?? "Please try again."}
            onRetry={activity.retry}
          />
        ) : activity.items.length === 0 ? (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="No recent activity"
            description="Diagnoses, completed actions, risk alerts, and chats will show up here as they happen."
          />
        ) : (
          <div className="space-y-2.5">
            {activity.items.map((item) => (
              <ActivityRow key={item.key} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}