import { Droplets } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { useI18n } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";

/**
 * Soil Moisture card for the Irrigation Advisor page (UI redesign).
 *
 * STRICTLY data-driven — this component NEVER invents a moisture reading.
 * It accepts the REAL moisture value from the irrigation/soil data layer:
 *  - `value`  → percentage 0–100 (or null when no reading exists),
 *  - `status` → existing moisture-status label (low / moderate / high).
 * When no measurement exists it renders an honest "not measured yet"
 * fallback (mirroring the app's existing honest-degradation pattern),
 * instead of fabricating a number for the reference screenshot.
 *
 * Visual spec (per the redesign reference):
 *  - large centered circular gauge (diameter 208px on desktop, 176px mobile),
 *  - thick rounded progress arc + muted track,
 *  - big percentage typography with the status label directly beneath,
 *  - green accent arc when moisture is known.
 */

export type MoistureStatus = "low" | "moderate" | "high";

export interface SoilMoistureInput {
  /** Real moisture % (0–100). Pass null when the system has no reading. */
  value: number | null;
  /** Optional explicit status. Derived from the value when omitted. */
  status?: MoistureStatus | null;
}

/** Existing-style moisture bands (only meaningful for a REAL reading). */
function statusForValue(value: number): MoistureStatus {
  if (value < 40) return "low";
  if (value <= 65) return "moderate";
  return "high";
}

const STATUS_META: Record<
  MoistureStatus,
  { labelKey: string; ring: string; text: string; chip: string }
> = {
  low: {
    labelKey: "irrigation.moisture.low",
    ring: "text-warning",
    text: "text-warning",
    chip: "bg-warning-soft text-warning ring-warning/20",
  },
  moderate: {
    labelKey: "irrigation.moisture.moderate",
    ring: "text-primary",
    text: "text-primary",
    chip: "bg-primary-soft text-primary ring-primary/20",
  },
  high: {
    labelKey: "irrigation.moisture.high",
    ring: "text-success",
    text: "text-success",
    chip: "bg-success-soft text-success ring-success/15",
  },
};

export function SoilMoistureCard({ value, status }: SoilMoistureInput) {
  const { t } = useI18n();

  const measured = typeof value === "number" && Number.isFinite(value);
  const safeValue = measured ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  const band = status ?? (measured ? statusForValue(safeValue) : null);
  const meta = band ? STATUS_META[band] : null;

  // Gauge geometry — thick stroke, generous diameter to match the reference.
  const R = 92;
  const STROKE = 22;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const dashOffset = measured ? CIRCUMFERENCE * (1 - safeValue / 100) : CIRCUMFERENCE;

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col items-center justify-center gap-5 py-6">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Droplets className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-base font-bold text-foreground">
                {t("irrigation.soilMoisture")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("irrigation.soilMoistureSub")}
              </p>
            </div>
          </div>
          {meta ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                meta.chip
              )}
            >
              {t(meta.labelKey)}
            </span>
          ) : null}
        </div>

        {/* Gauge */}
        <div
          className="relative h-44 w-44 shrink-0 sm:h-52 sm:w-52"
          role="img"
          aria-label={
            measured
              ? `${safeValue}% soil moisture`
              : t("irrigation.moistureNotMeasured")
          }
        >
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-muted"
            />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              className={cn(
                "transition-all duration-700 ease-out",
                measured ? (meta?.ring ?? "text-primary") : "text-muted-foreground/30"
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            {measured ? (
              <>
                <span className="font-heading text-5xl font-extrabold tracking-tight text-foreground">
                  {safeValue}
                  <span className="text-2xl font-bold text-muted-foreground">%</span>
                </span>
                {meta ? (
                  <span className={cn("text-sm font-semibold", meta.text)}>
                    {t(meta.labelKey)}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <span className="font-heading text-4xl font-extrabold tracking-tight text-muted-foreground/70">
                  —%
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {t("irrigation.moistureNotMeasured")}
                </span>
              </>
            )}
          </div>
        </div>

        {measured ? (
          <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
            {t("irrigation.currentRecSub")}
          </p>
        ) : (
          <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
            {t("irrigation.moistureNotMeasuredDesc")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
