import * as React from "react";
import { MapPin, Sprout, Droplets, Ruler, Leaf, TrendingUp } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { usePreferences } from "../../context/PreferencesContext";
import { buildFarmContext } from "../../lib/farm-context";
import type { Farm } from "../../types";

/**
 * "My Farm" summary for the Irrigation Advisor page.
 *
 * Renders the farmer's REAL saved data (from the active Farm Context) — never
 * hardcoded values. Icons pair each field with a label so it stays clear
 * without relying on colour or emoji alone. Mirrors the Smart Crop
 * Recommendation FarmContextCard pattern.
 */
export function IrrigationFarmContextCard({ farm }: { farm: Farm }) {
  const { t } = usePreferences();
  const context = buildFarmContext(farm);

  const items: Array<{
    key: string;
    labelKey: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: "location", labelKey: "irrigation.location", value: farm.location || "—", icon: MapPin },
    { key: "soil", labelKey: "irrigation.soil", value: farm.soilType || "—", icon: Leaf },
    {
      key: "irrigation",
      labelKey: "irrigation.method",
      value: farm.irrigationMethod || "—",
      icon: Droplets,
    },
    { key: "landArea", labelKey: "irrigation.landArea", value: farm.landArea || "—", icon: Ruler },
    { key: "crop", labelKey: "irrigation.crop", value: farm.currentCrop || "—", icon: Sprout },
    {
      key: "stage",
      labelKey: "irrigation.growthStage",
      value: context.growth.stageLabel || "—",
      icon: TrendingUp,
    },
  ];

  return (
    <Card>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-3">
          {items.map(({ key, labelKey, value, icon: Icon }) => (
            <div key={key} className="space-y-1">
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