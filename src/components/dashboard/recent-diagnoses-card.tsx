import { Link } from "react-router-dom";
import { ChevronRight, History, ScanLine, Stethoscope } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { useI18n } from "../../context/PreferencesContext";
import type { Diagnosis, Severity } from "../../types";
import { cn } from "../../lib/utils";

type Status = "loading" | "ready" | "error";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const SEVERITY_VARIANT: Record<Severity, "danger" | "warning" | "success"> = {
  high: "danger",
  medium: "warning",
  low: "success",
};

const SEVERITY_LABEL_KEY: Record<Severity, string> = {
  high: "dashboard.severityHigh",
  medium: "dashboard.severityMedium",
  low: "dashboard.severityLow",
};

function relativeTime(iso: string, t: Translate): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return t("dashboard.justNow");
  if (mins < 60) return t("dashboard.minAgo", { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("dashboard.hrAgo", { n: hours });
  const days = Math.round(hours / 24);
  if (days === 1) return t("dashboard.yesterday");
  if (days < 7) return t("dashboard.daysAgo", { n: days });
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Recent Diagnoses — the latest real Crop Doctor records (supabase rows),
 * each with its stored severity, confidence and capture time.
 */
export function RecentDiagnosesCard({
  diagnoses,
  status,
  onRetry,
}: {
  diagnoses: Diagnosis[];
  status: Status;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 p-5 pb-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {t("dashboard.recentDiagnoses")}
          </h2>
        </div>
        <Link
          to="/diagnosis-history"
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-deep transition-colors cursor-pointer"
        >
          {t("dashboard.viewAll")}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {status === "loading" ? (
        <CardContent className="space-y-2.5 pt-0" role="status" aria-label={t("dashboard.loadingDiagnosesAria")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      ) : status === "error" ? (
        <CardContent className="pt-0">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
              <ScanLine className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {t("dashboard.couldntLoadRecent")}
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
                {t("common.tryAgain")}
              </Button>
            </div>
          </div>
        </CardContent>
      ) : diagnoses.length === 0 ? (
        <CardContent className="flex flex-1 flex-col items-start gap-2 pt-0">
          <div className="flex w-full items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <History className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t("dashboard.noCropChecks")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("dashboard.diagnoseAndChecksAppear")}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link to="/crop-doctor">{t("dashboard.analyzeACrop")}</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      ) : (
        <CardContent className="space-y-2.5 pt-0">
          {diagnoses.slice(0, 3).map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  d.severity === "high"
                    ? "bg-danger-soft text-danger"
                    : d.severity === "medium"
                      ? "bg-warning-soft text-warning"
                      : "bg-success-soft text-success"
                )}
              >
                <Stethoscope className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {d.crop}
                  </p>
                  <Badge variant={SEVERITY_VARIANT[d.severity]}>
                    {t(SEVERITY_LABEL_KEY[d.severity])}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {d.diagnosis} · {d.confidence}% · {relativeTime(d.createdAt, t)}
                </p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
