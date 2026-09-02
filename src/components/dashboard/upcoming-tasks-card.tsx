import * as React from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Droplets,
  Sprout,
  Bug,
  Search,
  Wheat,
  ClipboardCheck,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { EmptyState } from "../layout/empty-state";
import { LoadingState } from "../layout/loading-state";
import { useFarm } from "../../context/FarmContext";
import { usePreferences } from "../../context/PreferencesContext";
import { fetchUpcomingEvents } from "../../lib/calendar-service";
import type { FarmEvent, FarmEventType } from "../../types";

/* ------------------------------------------------------------------ */
/* Event-type meta (shared with CropCalendarPage)                      */
/* ------------------------------------------------------------------ */

type BadgeVariant = "default" | "success" | "warning" | "danger" | "neutral" | "outline";

const TYPE_META: Record<
  FarmEventType,
  { icon: React.ComponentType<{ className?: string }>; variant: BadgeVariant }
> = {
  irrigation: { icon: Droplets, variant: "default" },
  fertilizer: { icon: Sprout, variant: "success" },
  pesticide: { icon: Bug, variant: "warning" },
  pest_monitoring: { icon: Search, variant: "neutral" },
  harvest: { icon: Wheat, variant: "success" },
  inspection: { icon: ClipboardCheck, variant: "default" },
  other: { icon: MoreHorizontal, variant: "neutral" },
};

/* ------------------------------------------------------------------ */
/* Upcoming Tasks Card                                                  */
/* ------------------------------------------------------------------ */

/**
 * Dashboard widget showing the next 5 scheduled farm events from the
 * calendar. Pulls real data from `farm_events` via the calendar service.
 * Degrades gracefully when no events exist or the table is not yet created.
 */
export function UpcomingTasksCard() {
  const { t } = usePreferences();
  const { farm } = useFarm();
  const [events, setEvents] = React.useState<FarmEvent[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    if (!farm) return;
    let cancelled = false;
    setStatus("loading");

    fetchUpcomingEvents(farm.id, 5)
      .then((rows) => {
        if (!cancelled) {
          setEvents(rows);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([]);
          setStatus("error");
        }
      });

    return () => { cancelled = true; };
  }, [farm?.id]);

  if (status === "loading") {
    return <LoadingState rows={2} title={t("dashboard.tasksLoading")} />;
  }

  if (status === "error") {
    // Graceful degradation — don't block the dashboard for a missing table
    return null;
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-5 w-5" />}
        title={t("dashboard.tasksEmpty")}
        description={t("dashboard.tasksEmptyHint")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/crop-calendar">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {t("dashboard.openCalendar")}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {events.map((ev) => {
        const meta = TYPE_META[ev.eventType];
        const Icon = meta.icon;
        return (
          <div
            key={ev.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {ev.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatEventDate(ev.scheduledDate)}
              </p>
            </div>
            <Badge variant={meta.variant}>
              {t(`calendar.type.${ev.eventType}`)}
            </Badge>
          </div>
        );
      })}
      <Button asChild variant="ghost" size="sm" className="w-full">
        <Link to="/crop-calendar">
          {t("dashboard.viewAllTasks")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}

function formatEventDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
