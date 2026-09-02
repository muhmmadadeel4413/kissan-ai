import * as React from "react";
import {
  Check,
  Circle,
  Clock,
  Info,
  ListChecks,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { useTodayActions } from "../../hooks/useTodayActions";
import type { ActionItem, ActionSource, ActionTiming } from "../../types";
import { cn } from "../../lib/utils";

/**
 * "What Should I Do Today?" — Decision Engine action feed (Prompt 10).
 *
 * Renders the persisted, validated actions for the farm on the Dashboard and
 * Actions page. Priority is always communicated with a text label PLUS color
 * (never color-only). Completion uses a real toggle button (aria-pressed) and
 * refresh has an accessible label. Empty / insufficient-data / error states
 * are honest — no fake actions are ever shown.
 */

const PRIORITY_META: Record<
  ActionItem["priority"],
  { label: string; variant: "danger" | "warning" | "success" }
> = {
  high: { label: "High", variant: "danger" },
  medium: { label: "Medium", variant: "warning" },
  low: { label: "Low", variant: "success" },
};

const TIMING_LABEL: Record<ActionTiming, string> = {
  today: "Today",
  this_morning: "This morning",
  this_afternoon: "This afternoon",
  this_evening: "This evening",
  before_rain: "Before rain",
  this_week: "This week",
  monitor: "Monitor",
};

const SOURCE_LABEL: Record<ActionSource, string> = {
  farm_context: "Farm profile",
  growth_stage: "Growth stage",
  weather: "Weather",
  diagnosis: "Crop check",
  risk: "Risk",
  yield: "Yield",
  history: "History",
};

export function TodayActionsCard() {
  const {
    actions,
    summary,
    status,
    generating,
    error,
    insufficientData,
    markDone,
    refresh,
    retry,
  } = useTodayActions();

  const completedCount = actions.filter((a) => a.completed).length;
  const pending = actions.filter((a) => !a.completed);

  /* ----- Loading: accessible skeleton, no blank space ------------------ */
  if (status === "loading") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
            What Should I Do Today?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3" role="status" aria-label="Loading today's actions">
          <span className="sr-only">Loading today's actions</span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="space-y-2 rounded-xl border border-border bg-background/40 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  /* ----- Insufficient data: honest "complete your profile" state ------- */
  if (insufficientData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
            What Should I Do Today?
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Info className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                More farm information is needed
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Complete your farm profile and add crop information to receive
                personalized actions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ----- Error with no actions to show --------------------------------- */
  if (status === "error" && actions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
            What Should I Do Today?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 py-2">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                We couldn't update today's actions right now
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {error ?? "Please try again."}
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={retry}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ----- Empty state: all caught up ------------------------------------ */
  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
            What Should I Do Today?
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <Check className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                You're all caught up
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                No urgent actions were identified from your current farm
                information. Continue monitoring your crop and check again as
                conditions change.
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={refresh}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh Today's Actions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ----- Ready: real persisted actions --------------------------------- */
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
            What Should I Do Today?
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={generating}
          >
            <RefreshCw
              className={cn("h-4 w-4", generating && "animate-spin")}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {generating ? "Updating…" : "Refresh"}
            </span>
            <span className="sm:hidden">Refresh</span>
          </Button>
        </div>
        {summary ? (
          <p className="text-xs text-muted-foreground">{summary}</p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3 py-2">
        {/* Refresh failed but previous actions remain visible */}
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <p>
              We couldn't update today's actions right now. Showing your last
              saved actions. Please try again.
            </p>
          </div>
        ) : null}

        {pending.map((action) => (
          <ActionRow key={action.id} action={action} onToggle={markDone} />
        ))}

        {completedCount > 0 ? (
          <div className="pt-1">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Completed ({completedCount})
            </p>
            <div className="space-y-2">
              {actions
                .filter((a) => a.completed)
                .map((action) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    onToggle={markDone}
                  />
                ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Single action row                                                   */
/* ------------------------------------------------------------------ */

function ActionRow({
  action,
  onToggle,
}: {
  action: ActionItem;
  onToggle: (id: string, completed: boolean) => Promise<unknown>;
}) {
  const [busy, setBusy] = React.useState(false);
  const meta = PRIORITY_META[action.priority];

  async function handleToggle() {
    if (busy) return;
    setBusy(true);
    try {
      await onToggle(action.id, !action.completed);
    } catch {
      // error surfaced by the hook; keep the row in its current state
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background/40 p-4 transition-opacity",
        action.completed && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                "text-sm font-semibold text-foreground",
                action.completed && "line-through"
              )}
            >
              {action.title}
            </p>
            <Badge variant={meta.variant}>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  action.priority === "high" && "bg-danger",
                  action.priority === "medium" && "bg-warning",
                  action.priority === "low" && "bg-success"
                )}
                aria-hidden="true"
              />
              <span className="ml-1.5">{meta.label}</span>
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {action.description}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-foreground/80">
            <span className="font-semibold text-foreground">Why: </span>
            {action.reason}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {action.timing ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-medium text-foreground">Timing:</span>{" "}
            {TIMING_LABEL[action.timing] ?? action.timing}
          </span>
        ) : null}

        {action.source.length > 0 ? (
          <span className="inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-medium text-foreground">Based on:</span>{" "}
            {action.source.map((s) => SOURCE_LABEL[s] ?? s).join(" + ")}
          </span>
        ) : null}

        <span className="ml-auto">
          <Button
            variant={action.completed ? "secondary" : "outline"}
            size="sm"
            onClick={() => void handleToggle()}
            disabled={busy}
            aria-pressed={action.completed}
            aria-label={
              action.completed
                ? `Mark "${action.title}" as not done`
                : `Mark "${action.title}" as done`
            }
          >
            {action.completed ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Circle className="h-4 w-4" aria-hidden="true" />
            )}
            {action.completed ? "Done" : "Mark done"}
          </Button>
        </span>
      </div>
    </div>
  );
}