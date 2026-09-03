import * as React from "react";
import {
  CalendarDays,
  Droplets,
  History,
  Leaf,
  MapPin,
  Sprout,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { usePreferences } from "../../context/PreferencesContext";
import { buildFarmContext } from "../../lib/farm-context";
import type { Farm } from "../../types";

/**
 * "Your Conditions" card for the Smart Crop Recommendation page.
 *
 * Renders the farmer's REAL saved data (from the active Farm Context) — never
 * hardcoded values. Icons pair each field with a label so it stays clear
 * without relying on colour or emoji alone. Compact label/value rows with
 * dividers match the reference layout.
 */
export function FarmContextCard({ farm }: { farm: Farm }) {
  const { t } = usePreferences();
  const context = buildFarmContext(farm);

  // Farm history is derived from real saved data only — farm age when present,
  // otherwise the planting date, otherwise an honest dash.
  const historyValue =
    farm.farmAgeYears != null && farm.farmAgeYears > 0
      ? t("cropRec.farmAgeYears", { n: farm.farmAgeYears })
      : farm.plantingDate
        ? new Date(farm.plantingDate + "T00:00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—";

  const rows: Array<{
    labelKey: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { labelKey: "cropRec.location", value: farm.location || "—", icon: MapPin },
    { labelKey: "cropRec.soilType", value: farm.soilType || "—", icon: Leaf },
    {
      labelKey: "cropRec.waterAvailability",
      value: farm.irrigationMethod || "—",
      icon: Droplets,
    },
    {
      labelKey: "cropRec.currentSeason",
      value: context.growth.stageLabel || "—",
      icon: CalendarDays,
    },
    { labelKey: "cropRec.farmHistory", value: historyValue, icon: History },
  ];

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col p-0">
        <div className="border-b border-border p-5">
          <h2 className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Sprout className="h-4 w-4" aria-hidden="true" />
            </span>
            {t("cropRec.conditionsTitle")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("cropRec.conditionsSub")}
          </p>
        </div>

        <dl className="flex-1 divide-y divide-border">
          {rows.map(({ labelKey, value, icon: Icon }) => (
            <div key={labelKey} className="flex items-center gap-3 px-5 py-3.5">
              <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <dt className="min-w-0 flex-1 truncate text-start text-sm text-muted-foreground">
                {t(labelKey)}
              </dt>
              <dd className="min-w-0 truncate text-end text-sm font-semibold text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
