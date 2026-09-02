import * as React from "react";
import { ShieldCheck, ShieldAlert, CloudSun, Stethoscope } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { usePreferences } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";

/* ------------------------------------------------------------------ */
/* Farm Intelligence Health Gauge                                       */
/* ------------------------------------------------------------------ */

export interface HealthInput {
  /** Number of active risk alerts. */
  riskCount: number;
  /** Number of high-priority risks. */
  highRisks: number;
  /** Whether weather data is available. */
  weatherAvailable: boolean;
  /** Whether a crop diagnosis exists. */
  hasDiagnosis: boolean;
  /** Whether today's actions are available. */
  hasActions: boolean;
}

/**
 * Compute a 0–100 farm health score from available data signals.
 *
 * The score is deterministic and transparent — it never invents data:
 *   - Start at 100
 *   - Subtract for active risks (especially high-priority)
 *   - Add bonus for having weather data, diagnoses, and actions
 *
 * Returns null if the farm has no data at all (honest "insufficient" state).
 */
export function computeHealthScore(input: HealthInput): number | null {
  const hasAnyData =
    input.weatherAvailable || input.hasDiagnosis || input.hasActions || input.riskCount > 0;

  if (!hasAnyData) return null;

  let score = 100;

  // Deductions for risks
  score -= input.highRisks * 15;
  score -= (input.riskCount - input.highRisks) * 5;

  // Bonuses for data coverage
  if (input.weatherAvailable) score += 0; // baseline — no bonus, no penalty
  if (input.hasDiagnosis) score += 5;
  if (input.hasActions) score += 5;

  return Math.max(0, Math.min(100, score));
}

/* ------------------------------------------------------------------ */
/* Circular Gauge Component                                             */
/* ------------------------------------------------------------------ */

/**
 * Circular progress ring showing the farm intelligence health score.
 * Built with SVG — no external dependency needed.
 */
export function FarmHealthGauge({ input }: { input: HealthInput }) {
  const { t } = usePreferences();
  const score = computeHealthScore(input);

  if (score === null) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-foreground">
            {t("dashboard.healthInsufficient")}
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {t("dashboard.healthInsufficientHint")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 75 ? "text-success" : score >= 50 ? "text-warning" : "text-danger";
  const bgColor =
    score >= 75 ? "text-success/10" : score >= 50 ? "text-warning/10" : "text-danger/10";
  const label =
    score >= 75
      ? t("dashboard.healthGood")
      : score >= 50
        ? t("dashboard.healthFair")
        : t("dashboard.healthPoor");

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-5">
        {/* SVG ring */}
        <div className="relative">
          <svg width="140" height="140" viewBox="0 0 140 140">
            {/* Background ring */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              strokeWidth="10"
              className={cn("stroke-current", bgColor)}
            />
            {/* Progress ring */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn("stroke-current transition-all duration-700 ease-out", color)}
              transform="rotate(-90 70 70)"
            />
          </svg>
          {/* Score text in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-heading text-3xl font-bold", color)}>{score}%</span>
          </div>
        </div>

        {/* Label */}
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.healthSubtitle")}
          </p>
        </div>

        {/* Checklist */}
        <div className="w-full space-y-2">
          <CheckItem
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
            label={t("dashboard.healthRisks")}
            ok={input.riskCount === 0}
            detail={
              input.riskCount > 0
                ? `${input.riskCount} ${t("dashboard.healthActive")}`
                : t("dashboard.healthClear")
            }
          />
          <CheckItem
            icon={<CloudSun className="h-3.5 w-3.5" />}
            label={t("dashboard.healthWeather")}
            ok={input.weatherAvailable}
            detail={
              input.weatherAvailable
                ? t("dashboard.healthAvailable")
                : t("dashboard.healthUnavailable")
            }
          />
          <CheckItem
            icon={<Stethoscope className="h-3.5 w-3.5" />}
            label={t("dashboard.healthDiagnosis")}
            ok={input.hasDiagnosis}
            detail={
              input.hasDiagnosis
                ? t("dashboard.healthAvailable")
                : t("dashboard.healthMissing")
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CheckItem({
  icon,
  label,
  ok,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          ok ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="flex-1 font-medium text-foreground">{label}</span>
      <span className={cn("text-muted-foreground", ok && "text-success")}>
        {detail}
      </span>
    </div>
  );
}
