import { Link } from "react-router-dom";
import { ChevronRight, Droplets, Leaf, Sprout } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { evaluateIrrigation } from "../../lib/irrigation-engine";
import { cn } from "../../lib/utils";
import type { Farm, CropGrowthInfo } from "../../types";

type BadgeVariant = "danger" | "warning" | "success" | "neutral";

const STATUS_META: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  insufficient: { label: "Needs more data", variant: "neutral" },
  irrigate_now: { label: "Water now", variant: "danger" },
  irrigation_soon: { label: "Water soon", variant: "warning" },
  delay: { label: "Delay watering", variant: "success" },
  adequate: { label: "Moisture OK", variant: "success" },
};

/**
 * Irrigation Advisor — built on the existing irrigation engine.
 *
 * Runs the real `evaluateIrrigation` logic against the farmer's saved crop,
 * growth stage, soil and irrigation method. The recommendation text, status
 * chip and urgency come straight from that engine — never fabricated.
 */
export function IrrigationAdvisorCard({
  farm,
  growth,
}: {
  farm: Farm;
  growth: CropGrowthInfo;
}) {
  const result = evaluateIrrigation({
    crop: farm.currentCrop || null,
    growthStage: growth.stageLabel || null,
    soilType: farm.soilType,
    irrigationMethod: farm.irrigationMethod,
  });

  const meta = STATUS_META[result.status] ?? {
    label: result.status,
    variant: "neutral" as BadgeVariant,
  };

  const insufficient = result.status === "insufficient";
  const urgent = !insufficient && result.urgency === "high";

  return (
    <Card
      className={cn(
        "flex h-full flex-col transition-shadow duration-200",
        urgent && "ring-1 ring-inset ring-danger/20"
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" aria-hidden="true" />
            Irrigation Advisor
          </span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {farm.currentCrop || "Your crop"} · {growth.stageLabel || "Stage unknown"}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-sm leading-relaxed text-foreground">
          {result.reason}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Leaf className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {farm.soilType || "Soil —"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Sprout className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {farm.irrigationMethod || "No method"}
          </span>
          <Link
            to="/irrigation"
            className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-deep transition-colors cursor-pointer"
          >
            Open Advisor
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
