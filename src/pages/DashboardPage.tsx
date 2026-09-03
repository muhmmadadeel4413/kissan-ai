import { Link } from "react-router-dom";
import * as React from "react";
import { Sprout } from "lucide-react";
import { Button } from "../components/ui/button";
import { SectionHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { FarmOverviewCard } from "../components/dashboard/farm-overview-card";
import { WeatherTodayCard } from "../components/dashboard/weather-today-card";
import { CropHealthCard } from "../components/dashboard/crop-health-card";
import { ActiveAlertsCard } from "../components/dashboard/active-alerts-card";
import { TodayActionsCard } from "../components/actions/today-actions-card";
import { GrowthStageCard } from "../components/farm/growth-stage-card";
import { YieldPredictionCard } from "../components/dashboard/yield-prediction-card";
import { FarmIntelligenceCard } from "../components/dashboard/farm-intelligence-card";
import { RecentDiagnosesCard } from "../components/dashboard/recent-diagnoses-card";
import { IrrigationAdvisorCard } from "../components/dashboard/irrigation-advisor-card";
import { UpcomingTasksCard } from "../components/dashboard/upcoming-tasks-card";
import type { HealthInput } from "../components/dashboard/farm-health-gauge";
import { buildFarmContext } from "../lib/farm-context";
import { fetchActiveRisks } from "../lib/risk-service";
import { fetchDiagnoses } from "../lib/diagnosis-service";
import { useFarm } from "../context/FarmContext";
import { useFarmWeather } from "../hooks/useFarmWeather";
import { useRecentActivity } from "../hooks/useRecentActivity";
import type { Diagnosis, RiskAlert } from "../types";

function greetingFor(hour: number): string {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

/**
 * Kissan AI Dashboard — reference-driven redesign.
 *
 * Composition (from the reference image): a greeting header, one row of four
 * stat cards (Farm Overview, Weather Today, Crop Health, Active Alerts), a
 * second row (What Should I Do Today?, Crop Growth Stage, AI Yield
 * Prediction), and a third row (AI Farm Intelligence, Recent Diagnoses,
 * Irrigation Advisor, Upcoming Tasks). Every value comes from the existing
 * real data systems — farm profile, live weather, stored AI diagnoses,
 * persisted risk alerts, today's actions engine, crop calendar events and
 * the irrigation engine — with honest loading / empty / error states.
 */
export default function DashboardPage() {
  const { farm } = useFarm();

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

  const farmContext = buildFarmContext(farm);
  const firstName = farm.farmerName.trim().split(/\s+/)[0] || "Farmer";

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

  /* ---- Diagnoses (real Supabase records from the Crop Doctor) ---------- */
  const [diagnoses, setDiagnoses] = React.useState<Diagnosis[]>([]);
  const [diagnosisStatus, setDiagnosisStatus] = React.useState<
    "loading" | "ready" | "error"
  >("loading");
  const [diagnosisReload, setDiagnosisReload] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setDiagnosisStatus("loading");
    fetchDiagnoses(farm.id)
      .then((rows) => {
        if (cancelled) return;
        setDiagnoses(rows);
        setDiagnosisStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDiagnoses([]);
        setDiagnosisStatus("error");
        console.error("dashboard-diagnoses:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [farm.id, diagnosisReload]);

  const latestDiagnosis = diagnoses[0] ?? null;

  /* ---- Weather (live, via the existing Edge Function) ------------------ */
  const {
    weather,
    status: weatherStatus,
    retry: weatherRetry,
  } = useFarmWeather();

  /* ---- Recent activity — real records, used for the health signal ------ */
  const activity = useRecentActivity(farm.id);

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

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* Greeting header */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            {today} · {farm.location}
          </p>
          <h1 className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {greetingFor(new Date().getHours())}, {firstName}! 👋
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Your AI farming decision assistant is ready — here&apos;s what&apos;s
            happening on your farm today.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link to="/farm-setup">Edit Farm</Link>
        </Button>
      </section>

      {/* Row 1 — the four stat cards from the reference */}
      <section aria-label="Farm at a glance">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FarmOverviewCard farm={farm} growth={farmContext.growth} />
          <WeatherTodayCard
            weather={weather}
            status={weatherStatus}
            onRetry={weatherRetry}
          />
          <CropHealthCard
            diagnosis={latestDiagnosis}
            status={diagnosisStatus}
            onRetry={() => setDiagnosisReload((k) => k + 1)}
          />
          <ActiveAlertsCard
            alerts={riskAlerts}
            counts={riskCounts}
            status={risksLoading ? "loading" : risksError ? "error" : "ready"}
            onRetry={() => setRisksReload((k) => k + 1)}
          />
        </div>
      </section>

      {/* Row 2 — intelligence, diagnoses, irrigation, tasks.
          This four-card row now sits directly below the top stat cards. */}
      <section aria-label="Farm intelligence">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FarmIntelligenceCard input={healthInput} />
          <RecentDiagnosesCard
            diagnoses={diagnoses}
            status={diagnosisStatus}
            onRetry={() => setDiagnosisReload((k) => k + 1)}
          />
          <IrrigationAdvisorCard farm={farm} growth={farmContext.growth} />
          <UpcomingTasksCard />
        </div>
      </section>

      {/* Row 3 — today's plan, growth stage, yield.
          Each column is a flex column (header on top) and the card below it
          grows via flex-1 to fill the full row height, so the three compact
          cards always share one consistent height and align flush at the top
          and bottom at every breakpoint. The [&>div:last-child] selector
          targets the card's single root Card element directly after the
          header. The cards use their compact variant so the row stays short. */}
      <section aria-label="Today's plan and outlook">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="flex flex-col gap-3 [&>div:last-child]:flex-1">
            <SectionHeader
              title="What Should I Do Today?"
              subtitle="Your decision plan, built from real farm data"
            />
            <TodayActionsCard compact />
          </div>
          <div className="flex flex-col gap-3 [&>div:last-child]:flex-1">
            <SectionHeader
              title="Crop Growth Stage"
              subtitle="Crop age and current stage"
            />
            <GrowthStageCard growth={farmContext.growth} compact />
          </div>
          <div className="flex flex-col gap-3 [&>div:last-child]:flex-1 md:col-span-2 xl:col-span-1">
            <SectionHeader
              title="AI Yield Prediction"
              subtitle="Estimate range and confidence"
            />
            <YieldPredictionCard farm={farm} compact />
          </div>
        </div>
      </section>
    </div>
  );
}
