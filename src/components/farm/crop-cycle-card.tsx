import { CalendarClock, MapPin, Sprout } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { getCropGrowthConfig } from "../../lib/growth-stage";
import { useI18n } from "../../context/PreferencesContext";
import type { CropGrowthInfo, Farm } from "../../types";
import { cn } from "../../lib/utils";

/**
 * Crop cycle card — UI redesign (real data only).
 *
 * Renders the farmer's CURRENT crop, variety, planting date and a horizontal
 * growth-stage timeline derived from the real deterministic growth engine:
 * stage boundaries, the stage the crop is in today, and the estimated harvest
 * date (planting date + the crop's real total cycle length). When any input is
 * missing the card says so — it never fabricates a crop, dates, or stages.
 */

const STAGE_DOT: Record<string, string> = {
  germination: "bg-accent",
  vegetative: "bg-primary",
  flowering: "bg-warning",
  fruiting: "bg-success",
  maturity: "bg-primary",
  harvest: "bg-success",
};

const MS_PER_DAY = 86_400_000;

function addDays(iso: string | undefined, days: number): string | null {
  if (!iso) return null;
  const t = Date.parse(iso + "T00:00:00Z");
  if (Number.isNaN(t)) return null;
  return new Date(t + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function formatShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CropCycleCard({
  farm,
  growth,
}: {
  farm: Farm;
  growth: CropGrowthInfo;
}) {
  const { t } = useI18n();
  const config = getCropGrowthConfig(farm.currentCrop);
  const planting = farm.plantingDate;
  const ageKnown = growth.cropAgeDays !== null;
  const hasTimeline = Boolean(planting && config);

  const currentIndex = hasTimeline
    ? config!.stages.findIndex((s) => s.stage === growth.growthStage)
    : -1;

  const harvestDate = hasTimeline
    ? addDays(planting!, config!.totalDays)
    : null;

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 py-5">
        {/* Crop header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
              <Sprout className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-lg font-bold tracking-tight text-foreground">
                {farm.currentCrop || t("farm.noCropSet")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {farm.currentCropVariety || t("farm.varietyNotRecorded")}
              </p>
            </div>
          </div>
          <Badge variant={hasTimeline ? "default" : "neutral"}>
            {growth.stageLabel}
          </Badge>
        </div>

        {/* Key dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/70 bg-background p-3">
            <div className="flex items-center gap-1.5 text-primary">
              <Sprout className="h-3.5 w-3.5" aria-hidden="true" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("farm.sowingDate")}
              </p>
            </div>
            <p className="mt-1 text-sm font-bold text-foreground">
              {formatShort(planting)}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background p-3">
            <div className="flex items-center gap-1.5 text-primary">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("farm.estHarvest")}
              </p>
            </div>
            <p className="mt-1 text-sm font-bold text-foreground">{formatShort(harvestDate)}</p>
          </div>
        </div>

        {/* Timeline */}
        {hasTimeline && config ? (
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t("farm.dayOfTotal", {
                  x: ageKnown && growth.cropAgeDays !== null ? growth.cropAgeDays : 0,
                  y: config.totalDays,
                })}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {t("farm.currentStage")}
              </span>
            </div>

            {/* Stage segments */}
            <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {config.stages.map((s) => (
                <div
                  key={s.stage}
                  className={cn(
                    "h-full transition-colors duration-300",
                    STAGE_DOT[s.stage] ?? "bg-muted-foreground/40"
                  )}
                  style={{
                    width: `${((s.endDay - s.startDay + 1) / config.totalDays) * 100}%`,
                    opacity: s.endDay <= (growth.cropAgeDays ?? 0) ? 1 : 0.35,
                  }}
                  title={`${s.label} (day ${s.startDay}–${s.endDay})`}
                />
              ))}
            </div>

            {/* Day ruler */}
            <div className="mt-1.5 flex w-full justify-between text-[10px] text-muted-foreground">
              <span>{t("farm.day0")}</span>
              <span>{t("farm.dayN", { n: Math.round(config.totalDays / 2) })}</span>
              <span>{t("farm.dayN", { n: config.totalDays })}</span>
            </div>

            {/* Stage labels */}
            <ol className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${config.stages.length}, minmax(0,1fr))` }}>
              {config.stages.map((s, i) => (
                <li
                  key={s.stage}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-center transition-colors duration-200",
                    i === currentIndex
                      ? "border-primary/30 bg-primary-soft text-primary"
                      : "border-border/60 bg-background text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "mx-auto mb-1 block h-1.5 w-1.5 rounded-full",
                      STAGE_DOT[s.stage] ?? "bg-muted-foreground/40"
                    )}
                    aria-hidden="true"
                  />
                  <span className="block text-[10px] font-semibold leading-tight">
                    {s.label.split(" / ")[0]}
                  </span>
                  <span className="block text-[9px] leading-tight">
                    D{s.startDay}–{s.endDay}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {!planting
              ? t("farm.addPlantingDate")
              : t("farm.growthStageConfigUnavailable")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
