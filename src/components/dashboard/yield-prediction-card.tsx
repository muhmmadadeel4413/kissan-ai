import { Link } from "react-router-dom";
import { ChevronRight, TrendingUp } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { useI18n } from "../../context/PreferencesContext";
import type { Farm } from "../../types";

/**
 * AI Yield Prediction — honest, real-data card.
 *
 * The Yield page intentionally shows no fabricated estimate until crop,
 * weather and growth history actually power a prediction. This card mirrors
 * that honesty: it displays the real crop name from the farm profile and an
 * explicit "not available yet" state with a clear path to the Yield page.
 */
export function YieldPredictionCard({
  farm,
  compact = false,
}: {
  farm: Farm;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Card className="h-full">
      <CardContent className={compact ? "flex h-full flex-col gap-2 p-4" : "flex h-full flex-col gap-3 p-5"}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {t("dashboard.aiYieldPrediction")}
          </p>
          <span
            className={
              "flex shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-soft ring-1 ring-inset ring-primary/15" +
              (compact ? " h-9 w-9" : " h-11 w-11")
            }
          >
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        <div className="min-w-0">
          <p className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
            —
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {farm.currentCrop
              ? t("dashboard.estimatedYield", { crop: farm.currentCrop })
              : t("dashboard.estimatedYieldDefault")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">{t("dashboard.rangeDash")}</Badge>
          <Badge variant="neutral">{t("dashboard.confidenceDash")}</Badge>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("dashboard.yieldNeedsData")}
        </p>

        <Link
          to="/yield"
          className="mt-auto inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-deep transition-colors cursor-pointer"
        >
          {t("dashboard.viewYield")}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
