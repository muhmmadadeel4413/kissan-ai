import { Link } from "react-router-dom";
import { Ruler, Sprout } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { useI18n } from "../../context/PreferencesContext";
import type { Farm, CropGrowthInfo } from "../../types";

/**
 * Farm Overview stat card — real data from the active farm profile and the
 * deterministic growth-stage engine. The crop visual is a brand-tinted SVG
 * chip (no static images), and every value stays dynamic.
 */
export function FarmOverviewCard({
  farm,
  growth,
}: {
  farm: Farm;
  growth: CropGrowthInfo;
}) {
  const { t } = useI18n();
  const stageKnown =
    growth.growthStage !== "unknown" && growth.growthStage !== "not_started";
  const stageLabel = stageKnown ? growth.stageLabel : t("dashboard.stageUnknown");

  return (
    <Card className="h-full transition-shadow duration-200 hover:shadow-lift">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {t("dashboard.farmOverview")}
          </p>
          <Link
            to="/farm-profile"
            aria-label={`View farm profile for ${farm.currentCrop}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-deep text-primary-foreground shadow-soft ring-1 ring-inset ring-white/15 transition-transform duration-150 hover:scale-[1.04] cursor-pointer"
          >
            <Sprout className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>

        <div className="min-w-0">
          <p className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {farm.currentCrop}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("dashboard.currentCrop")}</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Ruler className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {farm.landArea}
          </span>
          <span
            className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary"
            title={growth.reason}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
              aria-hidden="true"
            />
            <span className="truncate">{stageLabel}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
