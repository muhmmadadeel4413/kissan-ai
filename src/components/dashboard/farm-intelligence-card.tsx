import { Link } from "react-router-dom";
import {
  Activity,
  ChevronRight,
  CloudSun,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import {
  computeHealthScore,
  type HealthInput,
} from "./farm-health-gauge";
import { useI18n } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";

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
    labelKey: "dashboard.intelligenceGood",
    ring: "text-success",
    chip: "bg-success-soft text-success ring-success/15",
    text: "text-success",
  },
  fair: {
    labelKey: "dashboard.intelligenceFair",
    ring: "text-warning",
    chip: "bg-warning-soft text-warning ring-warning/20",
    text: "text-warning",
  },
  poor: {
    labelKey: "dashboard.intelligenceAtRisk",
    ring: "text-danger",
    chip: "bg-danger-soft text-danger ring-danger/15",
    text: "text-danger",
  },
};

/**
 * AI Farm Intelligence — compact health score computed from REAL signals
 * (active risks, weather availability, diagnosis history, today's actions).
 * Missing signals lower the score; an empty profile shows an honest state.
 */
export function FarmIntelligenceCard({ input }: { input: HealthInput }) {
  const { t } = useI18n();
  const hasAnySignal =
    input.riskCount > 0 || input.weatherAvailable || input.hasDiagnosis || input.hasActions;

  if (!hasAnySignal) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-muted-foreground">
              {t("dashboard.aiFarmIntelligence")}
            </p>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-soft ring-1 ring-inset ring-primary/15">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <p className="font-heading text-2xl font-bold tracking-tight text-foreground">
            —
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("dashboard.addSignals")}
          </p>
          <Link
            to="/assistant"
            className="mt-auto inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-deep transition-colors cursor-pointer"
          >
            {t("dashboard.askKissanAi")}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>
    );
  }

  const score = computeHealthScore(input);
  const band = bandFor(score);
  const meta = BAND_META[band];

  const R = 44;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const dashOffset = CIRCUMFERENCE * (1 - score / 100);

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {t("dashboard.aiFarmIntelligence")}
          </p>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
              meta.chip
            )}
          >
            {t(meta.labelKey)}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="relative h-24 w-24 shrink-0"
            role="img"
            aria-label={`Farm health score ${score} out of 100`}
          >
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r={R}
                fill="none"
                strokeWidth="9"
                className="stroke-muted"
              />
              <circle
                cx="50"
                cy="50"
                r={R}
                fill="none"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                className={cn("transition-all duration-700 ease-out", meta.ring)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-heading text-2xl font-bold tracking-tight text-foreground">
                {score}
              </span>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-2 text-[11px]">
            <Signal
              icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}
              label={t("dashboard.risks")}
              value={
                input.riskCount > 0
                  ? `${input.riskCount} ${t("dashboard.active")}`
                  : t("dashboard.clear")
              }
              tone={input.riskCount > 0 ? "bad" : "good"}
            />
            <Signal
              icon={<CloudSun className="h-3.5 w-3.5" aria-hidden="true" />}
              label={t("dashboard.weatherSignal")}
              value={input.weatherAvailable ? t("dashboard.live") : t("dashboard.missing")}
              tone={input.weatherAvailable ? "good" : "bad"}
            />
            <Signal
              icon={<Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />}
              label={t("dashboard.cropCheck")}
              value={input.hasDiagnosis ? t("dashboard.available") : t("dashboard.missing")}
              tone={input.hasDiagnosis ? "good" : "bad"}
            />
          </ul>
        </div>

        <Link
          to="/assistant"
          className="mt-auto inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-deep transition-colors cursor-pointer"
        >
          <span className={cn("font-semibold", meta.text)}>{t(meta.labelKey)}</span>
          <span className="text-muted-foreground font-normal">
            {t("dashboard.askKissanAiWhy")}
          </span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

function Signal({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "good" | "bad";
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset",
          tone === "good"
            ? "bg-success-soft text-success ring-success/15"
            : "bg-danger-soft text-danger ring-danger/15"
        )}
      >
        {value}
      </span>
    </li>
  );
}
