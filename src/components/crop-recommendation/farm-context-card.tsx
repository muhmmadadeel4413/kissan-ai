import * as React from "react";
import { MapPin, Sprout, Droplets, Ruler, Leaf, Tag, CalendarDays, TrendingUp } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { useI18n } from "../../context/PreferencesContext";
import { buildFarmContext } from "../../lib/farm-context";
import type { Farm } from "../../types";

/**
 * "My Farm" summary for the Smart Crop Recommendation page.
 *
 * Renders the farmer's REAL saved data (from the active Farm Context) — never
 * hardcoded values. Icons pair each field with a label so it stays clear
 * without relying on colour or emoji alone.
 */
export function FarmContextCard({ farm }: { farm: Farm }) {
  const { t } = useI18n();
  const context = buildFarmContext(farm);

  const items: Array<{
    labelKey: string;
    value: React.ReactNode;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { labelKey: "cropRec.location", value: farm.location || "—", icon: MapPin },
    { labelKey: "cropRec.soil", value: farm.soilType || "—", icon: Leaf },
    { labelKey: "cropRec.irrigation", value: farm.irrigationMethod || "—", icon: Droplets },
    { labelKey: "cropRec.landArea", value: farm.landArea || "—", icon: Ruler },
    { labelKey: "cropRec.currentCrop", value: farm.currentCrop || "—", icon: Sprout },
    {
      labelKey: "cropRec.growthStage",
      value: context.growth.stageLabel || "—",
      icon: TrendingUp,
    },
  ];

  if (farm.currentCropVariety) {
    items.push({ labelKey: "cropRec.variety", value: farm.currentCropVariety, icon: Tag });
  }
  if (farm.plantingDate) {
    items.push({
      labelKey: "cropRec.plantingDate",
      value: new Date(farm.plantingDate + "T00:00:00").toLocaleDateString(),
      icon: CalendarDays,
    });
  }

  return (
    <Card>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map(({ labelKey, value, icon: Icon }) => (
            <div key={labelKey} className="space-y-1">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {t(labelKey)}
              </dt>
              <dd className="text-sm font-semibold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}