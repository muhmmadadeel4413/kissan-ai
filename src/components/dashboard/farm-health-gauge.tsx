import { Activity, CloudSun, ShieldCheck, Stethoscope } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { useI18n } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";

/**
 * Farm Health Gauge (Dashboard Phase 2 widget).
 *
 * Computes an honest intelligence score from REAL data signals only — active
 * risks, high-priority risks, weather availability, latest diagnosis, and
 * today's actions. Missing signals lower the score (they're shown as "missing",
 * never silently hidden) and an empty data profile produces an explicit
 * "insufficient data" state instead of a made-up number.
 */

export interface HealthInput {
  riskCount: number;
  highRisks: number;
  weatherAvailable: boolean;
  hasDiagnosis: boolean;
  hasActions: boolean;
}

const PENALTY_HIGH_RISK = 25;
const PENALTY_RISK = 10;
const PENALTY_MISSING = 10;

export function computeHealthScore(input: HealthInput): number {
  const score =
    100 -
    input.highRisks * PENALTY_HIGH_RISK -
    Math.max(0, input.riskCount - input.highRisks) * PENALTY_RISK -
    (input.weatherAvailable ? 0 : PENALTY_MISSING) -
    (input.hasDiagnosis ? 0 : PENALTY_MISSING) -
    (input.hasActions ? 0 : PENALTY_MISSING);
  return Math.max(5, Math.min(100, score));
}

type HealthBand = "good" | "fair" | "poor";

function bandFor(score: number): HealthBand {
  if (score >= 75) return "good";
  if (score >= 45) return "fair";
  return "poor";
}

const BAND_META: Record<
  HealthBand,
  { labelKey: string; ring: string; chip: string; text: string }
> = {
  good: {
    labelKey: "dashboard.healthGood",
    ring: "text-success",
    chip: "bg-success-soft text-success ring-success/15",
    text: "text-success",
  },
  fair: {
    labelKey: "dashboard.healthFair",
    ring: "text-warning",
    chip: "bg-warning-soft text-warning ring-warning/20",
    text: "text-warning",
  },
  poor: {
    labelKey: "dashboard.healthPoor",
    ring: "text-danger",
    chip: "bg-danger-soft text-danger ring-danger/15",
    text: "text-danger",
  },
};

export function FarmHealthGauge({ input }: { input: HealthInput }) {
  const { t } = useI18n();

  // No signals at all → honest "insufficient data" state, no fake score.
  const hasAnySignal =
    input.riskCount > 0 || input.weatherAvailable || input.hasDiagnosis || input.hasActions;
  if (!hasAnySignal) {
    return (
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-base font-semibold text-foreground">
              {t("dashboard.farmHealth")}
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Activity className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {t("dashboard.healthInsufficient")}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {t("dashboard.healthInsufficientHint")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const score = computeHealthScore(input);
  const band = bandFor(score);
  const meta = BAND_META[band];

  // Circle circumference for an r=52 gauge: 2πr ≈ 326.7
  const R = 52;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const dashOffset = CIRCUMFERENCE * (1 - score / 100);

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-base font-semibold text-foreground">
              {t("dashboard.farmHealth")}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
              meta.chip
            )}
          >
            {t(meta.labelKey)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          {/* Score ring */}
          <div className="relative h-32 w-32 shrink-0" role="img" aria-label={`${score} / 100`}>
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                strokeWidth="10"
                className="stroke-muted"
              />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                className={cn("transition-all duration-700 ease-out", meta.ring)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-heading text-3xl font-bold tracking-tight text-foreground">
                {score}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>

          {/* Signal breakdown — text first, colour second */}
          <ul className="min-w-0 flex-1 space-y-2 text-xs">
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t("dashboard.healthRisks")}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset",
                  input.riskCount > 0
                    ? "bg-danger-soft text-danger ring-danger/15"
                    : "bg-success-soft text-success ring-success/15"
                )}
              >
                {input.riskCount > 0
                  ? `${input.riskCount} ${t("dashboard.healthActive")}`
                  : t("dashboard.healthClear")}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CloudSun className="h-3.5 w-3.5" aria-hidden="true" />
                {t("dashboard.healthWeather")}
              </span>
              <span className="text-foreground">
                {input.weatherAvailable
                  ? t("dashboard.healthAvailable")
                  : t("dashboard.healthUnavailable")}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
                {t("dashboard.healthDiagnosis")}
              </span>
              <span className="text-foreground">
                {input.hasDiagnosis
                  ? t("dashboard.healthAvailable")
                  : t("dashboard.healthMissing")}
              </span>
            </li>
          </ul>
        </div>

        <p className={cn("text-sm font-semibold", meta.text)}>
          {t(meta.labelKey)}
        </p>
        <p className="-mt-2 text-xs text-muted-foreground">
          {t("dashboard.healthSubtitle")}
        </p>
      </CardContent>
    </Card>
  );
}
