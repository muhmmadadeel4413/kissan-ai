import { Link } from "react-router-dom";
import { BellRing, ChevronRight, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import type { Level, RiskAlert } from "../../types";
import { cn } from "../../lib/utils";

type Status = "loading" | "ready" | "error";

const LEVEL_DOT: Record<Level, string> = {
  high: "bg-danger",
  medium: "bg-warning",
  low: "bg-success",
};

const LEVEL_LABEL: Record<Level, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Active Alerts stat card — real persisted alerts from the Risk Engine,
 * broken down by severity with colour + text labels (never colour-only).
 */
export function ActiveAlertsCard({
  alerts,
  counts,
  status,
  onRetry,
}: {
  alerts: RiskAlert[];
  counts: { high: number; medium: number; low: number };
  status: Status;
  onRetry: () => void;
}) {
  const total = alerts.length;
  const hasHigh = counts.high > 0;

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            Active Alerts
          </p>
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-soft ring-1 ring-inset",
              hasHigh
                ? "bg-danger-soft text-danger ring-danger/15"
                : total > 0
                  ? "bg-warning-soft text-warning ring-warning/15"
                  : "bg-success-soft text-success ring-success/15"
            )}
          >
            {total > 0 ? (
              <BellRing className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
        </div>

        {status === "loading" ? (
          <div className="flex-1 space-y-2" role="status" aria-label="Loading alerts">
            <Skeleton className="h-8 w-10" />
            <div className="mt-auto flex gap-4 border-t border-border pt-3">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-10" />
            </div>
          </div>
        ) : status === "error" ? (
          <div className="flex flex-1 flex-col items-start gap-2">
            <p className="text-sm font-semibold text-foreground">
              Alerts unavailable
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              We couldn't load your risk alerts right now.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-auto"
              onClick={onRetry}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <p className="font-heading text-2xl font-bold tracking-tight text-foreground">
                {total}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {total === 0 ? "No active risks detected" : "Risk alert" + (total === 1 ? "" : "s") + " to review"}
              </p>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
              {(["high", "medium", "low"] as Level[]).map((level) => (
                <span
                  key={level}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground"
                >
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", LEVEL_DOT[level])}
                    aria-hidden="true"
                  />
                  {counts[level]} {LEVEL_LABEL[level]}
                </span>
              ))}
              <Link
                to="/risks"
                className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-deep transition-colors cursor-pointer"
              >
                View all
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
