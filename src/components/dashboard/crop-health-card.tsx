import { Link } from "react-router-dom";
import { ChevronRight, Leaf, ScanLine } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { useI18n } from "../../context/PreferencesContext";
import type { Diagnosis, Severity } from "../../types";
import { cn } from "../../lib/utils";

type Status = "loading" | "ready" | "error";

const SEVERITY_META: Record<
  Severity,
  { labelKey: string; text: string; chip: string }
> = {
  low: {
    labelKey: "dashboard.cropHealthGood",
    text: "text-success",
    chip: "bg-success-soft text-success ring-success/15",
  },
  medium: {
    labelKey: "dashboard.cropHealthFair",
    text: "text-warning",
    chip: "bg-warning-soft text-warning ring-warning/20",
  },
  high: {
    labelKey: "dashboard.cropHealthAtRisk",
    text: "text-danger",
    chip: "bg-danger-soft text-danger ring-danger/15",
  },
};

/**
 * Crop Health stat card — real latest diagnosis from the AI Crop Doctor.
 * The status label is derived from the stored severity, never invented.
 */
export function CropHealthCard({
  diagnosis,
  status,
  onRetry,
}: {
  diagnosis: Diagnosis | null;
  status: Status;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const meta = diagnosis ? (SEVERITY_META[diagnosis.severity] ?? SEVERITY_META.medium) : null;
  const headline = diagnosis ? diagnosis.diagnosis.split(" ").slice(0, 3).join(" ") : "No check yet";

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {t("dashboard.cropHealth")}
          </p>
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-soft ring-1 ring-inset",
              meta?.chip ?? "bg-primary-soft text-primary ring-primary/15"
            )}
          >
            <Leaf className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        {status === "loading" ? (
          <div className="flex-1 space-y-2" role="status" aria-label={t("dashboard.loadingCropHealthAria")}>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="mt-auto h-5 w-28" />
          </div>
        ) : status === "error" ? (
          <div className="flex flex-1 flex-col items-start gap-2">
            <p className="text-sm font-semibold text-foreground">
              {t("dashboard.healthUnavailable")}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("dashboard.healthLoadError")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-auto"
              onClick={onRetry}
            >
              {t("common.tryAgain")}
            </Button>
          </div>
        ) : !diagnosis ? (
          <div className="flex flex-1 flex-col items-start gap-2">
            <p className="font-heading text-2xl font-bold tracking-tight text-muted-foreground">
              —
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("dashboard.runCropDoctor")}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-auto">
              <Link to="/crop-doctor">
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                {t("dashboard.analyzeACrop")}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <p className={cn("font-heading text-2xl font-bold tracking-tight", meta?.text)}>
                {meta ? t(meta.labelKey) : null}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={headline}>
                {headline}
              </p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                {t("dashboard.confidencePercent", { n: diagnosis.confidence })}
              </span>
              <Link
                to="/crop-doctor"
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-deep transition-colors cursor-pointer"
              >
                {t("dashboard.view")}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
