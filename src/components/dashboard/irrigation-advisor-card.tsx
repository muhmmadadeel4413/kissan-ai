import { Link } from "react-router-dom";
import { ChevronRight, Droplets, Leaf, Sprout } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { evaluateIrrigation } from "../../lib/irrigation-engine";
import { useI18n } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";
import type { Farm, CropGrowthInfo } from "../../types";

type BadgeVariant = "danger" | "warning" | "success" | "neutral";

const STATUS_META: Record<
  string,
  { labelKey: string; variant: BadgeVariant }
> = {
  insufficient: { labelKey: "dashboard.needsMoreData", variant: "neutral" },
  irrigate_now: { labelKey: "dashboard.waterNow", variant: "danger" },
  irrigation_soon: { labelKey: "dashboard.waterSoon", variant: "warning" },
  delay: { labelKey: "dashboard.delayWatering", variant: "success" },
  adequate: { labelKey: "dashboard.moistureOk", variant: "success" },
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
  const { t } = useI18n();
  const result = evaluateIrrigation({
    crop: farm.currentCrop || null,
    growthStage: growth.stageLabel || null,
    soilType: farm.soilType,
    irrigationMethod: farm.irrigationMethod,
  });

  const meta = STATUS_META[result.status];

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
            {t("dashboard.irrigationAdvisorCard")}
          </span>
          <Badge variant={meta?.variant ?? "neutral"}>
            {meta ? t(meta.labelKey) : result.status}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {farm.currentCrop || t("dashboard.yourCrop")} ·{" "}
          {growth.stageLabel || t("dashboard.stageUnknown")}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-sm leading-relaxed text-foreground">
          {result.reason}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Leaf className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {farm.soilType || t("dashboard.soilDash")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Sprout className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {farm.irrigationMethod || t("dashboard.noMethod")}
          </span>
          <Link
            to="/irrigation"
            className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-deep transition-colors cursor-pointer"
          >
            {t("dashboard.openAdvisor")}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
