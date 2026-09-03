import * as React from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { useFarm } from "../../context/FarmContext";
import { useI18n } from "../../context/PreferencesContext";
import { supabase } from "../../lib/supabase";
import type { FarmEvent, FarmEventType } from "../../types";

/**
 * Upcoming Tasks widget (Dashboard Phase 2).
 *
 * Renders the next scheduled farm events from the REAL `farm_events` table
 * (the Crop Calendar). Loading / empty / error states are honest — nothing is
 * fabricated — and the empty state links to the calendar so the farmer knows
 * exactly what to do next.
 */

const EVENT_TYPE_LABEL: Record<FarmEventType, string> = {
  irrigation: "Irrigation",
  fertilizer: "Fertilizer",
  pesticide: "Pesticide",
  pest_monitoring: "Pest Monitoring",
  harvest: "Harvest",
  inspection: "Inspection",
  other: "Other",
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function UpcomingTasksCard() {
  const { t } = useI18n();
  const { farm } = useFarm();
  const [events, setEvents] = React.useState<FarmEvent[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    if (!farm) {
      setEvents([]);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    supabase
      .from("farm_events")
      .select("id, farm_id, event_type, title, description, scheduled_date, status, completed_at, created_at")
      .eq("farm_id", farm.id)
      .gte("scheduled_date", todayKey())
      .order("scheduled_date", { ascending: true })
      .limit(5)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("upcoming-tasks-card:", error.message);
          setEvents([]);
          setStatus("error");
          return;
        }
        const rows = (data ?? []) as Array<{
          id: string;
          farm_id: string;
          event_type: FarmEventType;
          title: string;
          description: string | null;
          scheduled_date: string;
          status: "scheduled" | "completed" | "skipped";
          completed_at: string | null;
          created_at: string;
        }>;
        setEvents(
          rows
            .filter((r) => r.status === "scheduled")
            .map((r) => ({
              id: r.id,
              farmId: r.farm_id,
              eventType: r.event_type,
              title: r.title,
              description: r.description ?? undefined,
              scheduledDate: r.scheduled_date,
              status: r.status,
              completedAt: r.completed_at ?? undefined,
              createdAt: r.created_at,
            }))
        );
        setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [farm, reloadKey]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("dashboard.upcomingTasks")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("dashboard.upcomingTasksSub")}
        </p>
      </CardHeader>

      {status === "loading" ? (
        <CardContent className="space-y-3 py-2" role="status">
          <span className="sr-only">{t("dashboard.tasksLoading")}</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </CardContent>
      ) : status === "error" ? (
        <CardContent className="py-2">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {t("dashboard.tasksLoading")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We couldn't load your upcoming tasks.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                {t("common.retry")}
              </Button>
            </div>
          </div>
        </CardContent>
      ) : events.length === 0 ? (
        <CardContent className="py-2">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t("dashboard.tasksEmpty")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("dashboard.tasksEmptyHint")}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link to="/crop-calendar">{t("dashboard.openCalendar")}</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      ) : (
        <CardContent className="space-y-2 py-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"
            >
              <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-primary-soft text-primary">
                <span className="text-xs font-bold leading-none">
                  {new Date(event.scheduledDate + "T00:00:00").getDate()}
                </span>
                <span className="text-[9px] uppercase leading-none">
                  {new Date(event.scheduledDate + "T00:00:00").toLocaleDateString(undefined, {
                    month: "short",
                  })}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{event.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
          ))}
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/crop-calendar">
              {t("dashboard.viewAllTasks")}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
