import { CalendarClock, Sprout } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Badge, type BadgeProps } from "../ui/badge";
import type { CropGrowthInfo, CropGrowthStage } from "../../types";

/** Map a growth stage to a semantic badge color for at-a-glance reading. */
function stageVariant(stage: CropGrowthStage): BadgeProps["variant"] {
  switch (stage) {
    case "germination":
    case "vegetative":
      return "default";
    case "flowering":
    case "fruiting":
      return "warning";
    case "maturity":
    case "harvest":
      return "success";
    default:
      return "neutral";
  }
}

/**
 * Displays deterministic crop-age + growth-stage information derived from the
 * saved farm profile. Never invents values: unknown / not-started / unavailable
 * states are rendered explicitly.
 */
export function GrowthStageCard({
  growth,
  compact = false,
}: {
  growth: CropGrowthInfo;
  compact?: boolean;
}) {
  const unavailable =
    growth.growthStage === "unknown" || growth.growthStage === "not_started";
  const ageKnown = growth.cropAgeDays !== null;

  return (
    <Card>
      <CardContent className={compact ? "space-y-3 py-4" : "space-y-4 py-5"}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={
                "flex items-center justify-center rounded-full bg-primary-soft text-primary" +
                (compact ? " h-9 w-9" : " h-10 w-10")
              }
            >
              <Sprout className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Crop age</p>
              <p className="text-xs text-muted-foreground">Days since planting</p>
            </div>
          </div>
          {ageKnown ? (
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {growth.cropAgeDays}
              <span className="ml-1 text-sm font-medium text-muted-foreground">days</span>
            </p>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              Growth stage unavailable
            </span>
          )}
        </div>

        <div
          className={
            "flex items-center justify-between gap-4 border-t border-border" +
            (compact ? " pt-3" : " pt-4")
          }
        >
          <div className="flex items-center gap-3">
            <span
              className={
                "flex items-center justify-center rounded-full bg-muted text-muted-foreground" +
                (compact ? " h-9 w-9" : " h-10 w-10")
              }
            >
              <CalendarClock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Growth stage</p>
              <p className="text-xs text-muted-foreground">Estimated from planting date</p>
            </div>
          </div>
          <Badge variant={stageVariant(growth.growthStage)}>
            {growth.stageLabel}
          </Badge>
        </div>

        {unavailable && growth.reason ? (
          <p className="text-xs text-muted-foreground">{growth.reason}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}