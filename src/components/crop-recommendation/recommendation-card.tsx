import * as React from "react";
import { Droplets, Leaf, CloudSun, AlertTriangle, Sprout } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { usePreferences } from "../../context/PreferencesContext";
import type { CropRecommendation, CropSuitability } from "../../types";

/**
 * Map suitability → badge variant. Not colour-only: we pair the icon + the
 * labelled text ("Highly Suitable" / "Moderately Suitable" / "Less Suitable")
 * so meaning is never conveyed by colour alone.
 */
const SUITABILITY_META: Record<
  CropSuitability,
  { badge: "success" | "warning" | "danger"; dot: string; labelKey: string }
> = {
  high: { badge: "success", dot: "bg-success", labelKey: "cropRec.suit.high" },
  moderate: { badge: "warning", dot: "bg-warning", labelKey: "cropRec.suit.moderate" },
  low: { badge: "danger", dot: "bg-danger", labelKey: "cropRec.suit.low" },
};

/**
 * One recommended crop rendered as a clean, mobile-first card. Shows crop
 * name, estimated suitability with confidence, why it may suit the farm, and
 * the supporting soil / water / weather considerations.
 */
export function RecommendationCard({
  recommendation,
}: {
  recommendation: CropRecommendation;
}) {
  const { t } = usePreferences();
  const meta = SUITABILITY_META[recommendation.suitability] ?? SUITABILITY_META.moderate;

  const detailRows: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value?: string;
  }> = [
    {
      icon: Droplets,
      label: t("cropRec.waterRequirement"),
      value: recommendation.waterRequirement,
    },
    { icon: Leaf, label: t("cropRec.soilFit"), value: recommendation.soilFit },
    { icon: CloudSun, label: t("cropRec.weatherFit"), value: recommendation.weatherFit },
  ];

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Sprout className="h-5 w-5 text-primary" aria-hidden="true" />
              {recommendation.crop}
            </h3>
            <Badge variant={meta.badge}>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`}
                aria-hidden="true"
              />
              {t(meta.labelKey)}
            </Badge>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold text-foreground">
              {recommendation.confidence}
              <span className="text-sm font-medium text-muted-foreground">%</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t("cropRec.confidence", { n: recommendation.confidence })}
            </p>
          </div>
        </div>

        {/* Confidence bar (visual complement — the number above conveys it too) */}
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${t(meta.labelKey)} — ${recommendation.confidence}% confidence`}
        >
          <div
            className={`h-full rounded-full ${meta.dot}`}
            style={{ width: `${recommendation.confidence}%` }}
          />
        </div>

        {/* Why this crop */}
        {recommendation.whySuitable ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("cropRec.whyTitle")}
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              {recommendation.whySuitable}
            </p>
          </div>
        ) : null}

        {/* Supporting context rows */}
        {detailRows.some((r) => r.value) ? (
          <dl className="space-y-2">
            {detailRows.map(
              (row) =>
                row.value ? (
                  <div key={row.label} className="flex items-start gap-2">
                    <row.icon
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 text-sm">
                      <dt className="inline font-semibold text-foreground">
                        {row.label}:{" "}
                      </dt>
                      <dd className="inline text-muted-foreground">{row.value}</dd>
                    </div>
                  </div>
                ) : null
            )}
          </dl>
        ) : null}

        {recommendation.keyConsiderations.length > 0 ? (
          <div className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
              {t("cropRec.keyConsiderations")}
            </p>
            <ul className="space-y-1">
              {recommendation.keyConsiderations.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Compact ranked row for the "Top Recommended Crops" list. Shows rank number,
 * crop name, confidence score, and a progress bar — driven entirely by the
 * real recommendation data, never hardcoded.
 */
export function CropRankRow({
  rank,
  recommendation,
}: {
  rank: number;
  recommendation: CropRecommendation;
}) {
  const { t } = usePreferences();
  const meta = SUITABILITY_META[recommendation.suitability] ?? SUITABILITY_META.moderate;

  return (
    <li>
      <div className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-muted/40">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary"
          aria-hidden="true"
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-semibold text-foreground">
              {recommendation.crop}
            </p>
            <p className="shrink-0 text-sm font-bold text-primary">
              {recommendation.confidence}
              <span className="text-xs font-medium text-muted-foreground">%</span>
            </p>
          </div>
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={recommendation.confidence}
            aria-label={`${recommendation.crop} — ${t(meta.labelKey)}`}
          >
            <div
              className={`h-full rounded-full ${meta.dot}`}
              style={{ width: `${recommendation.confidence}%` }}
            />
          </div>
        </div>
      </div>
    </li>
  );
}