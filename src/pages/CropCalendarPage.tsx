import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  SkipForward,
  Droplets,
  Sprout,
  Bug,
  Search,
  Wheat,
  ClipboardCheck,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { PageHeader, SectionHeader } from "../components/layout/page-header";
import { StatCard } from "../components/layout/stat-card";
import { EmptyState } from "../components/layout/empty-state";
import { LoadingState } from "../components/layout/loading-state";
import { ErrorState } from "../components/layout/error-state";
import { CalendarEventForm } from "../components/calendar/calendar-event-form";
import { useFarm } from "../context/FarmContext";
import { usePreferences } from "../context/PreferencesContext";
import {
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  completeEvent,
  skipEvent,
  groupEventsByDate,
} from "../lib/calendar-service";
import type { FarmEvent, FarmEventInput, FarmEventType } from "../types";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Event-type meta (icons + badge variants)                             */
/* ------------------------------------------------------------------ */

type BadgeVariant = "default" | "success" | "warning" | "danger" | "neutral" | "outline";

const EVENT_TYPE_META: Record<
  FarmEventType,
  { icon: React.ComponentType<{ className?: string }>; variant: BadgeVariant; dotColor: string }
> = {
  irrigation: { icon: Droplets, variant: "default", dotColor: "bg-blue-500" },
  fertilizer: { icon: Sprout, variant: "success", dotColor: "bg-green-500" },
  pesticide: { icon: Bug, variant: "warning", dotColor: "bg-amber-500" },
  pest_monitoring: { icon: Search, variant: "neutral", dotColor: "bg-purple-500" },
  harvest: { icon: Wheat, variant: "success", dotColor: "bg-emerald-600" },
  inspection: { icon: ClipboardCheck, variant: "default", dotColor: "bg-indigo-500" },
  other: { icon: MoreHorizontal, variant: "neutral", dotColor: "bg-gray-400" },
};

const ALL_EVENT_TYPES: FarmEventType[] = [
  "irrigation",
  "fertilizer",
  "pesticide",
  "pest_monitoring",
  "harvest",
  "inspection",
  "other",
];

/* ------------------------------------------------------------------ */
/* Calendar helpers                                                     */
/* ------------------------------------------------------------------ */

function toISODate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function todayISO(): string {
  const now = new Date();
  return toISODate(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Build a 6-week grid (42 cells) for the given month. Each cell is either a
 * date string (ISO) or null for padding days outside the month.
 */
function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];

  // Padding before month starts
  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }
  // Month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toISODate(year, month, d));
  }
  // Padding after to fill 42 cells (6 rows)
  while (cells.length < 42) {
    cells.push(null);
  }
  return cells;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function CropCalendarPage() {
  const { t } = usePreferences();
  const { farm } = useFarm();

  const today = todayISO();
  const now = new Date();
  const activeFarmId = farm?.id ?? null;

  // Calendar navigation state
  const [viewYear, setViewYear] = React.useState(now.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(now.getMonth());

  // Data state
  const [events, setEvents] = React.useState<FarmEvent[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  // UI state
  const [selectedDate, setSelectedDate] = React.useState<string | null>(today);
  const [typeFilter, setTypeFilter] = React.useState<string>("all");

  // Form state
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<FarmEvent | null>(null);
  const [formDefaultDate, setFormDefaultDate] = React.useState<string | undefined>();

  /* ---------- data loading ---------- */

  React.useEffect(() => {
    if (!activeFarmId) return;
    let cancelled = false;

    async function load() {
      if (!activeFarmId) return;
      const fid: string = activeFarmId;
      setStatus("loading");
      setError(null);
      try {
        // Fetch the full month range + a buffer for events that might span
        const grid = buildMonthGrid(viewYear, viewMonth);
        const firstDate = grid.find((d) => d !== null) as string;
        const lastDate = [...grid].reverse().find((d) => d !== null) as string;

        const opts: { startDate: string; endDate: string; eventType?: FarmEventType } = {
          startDate: firstDate,
          endDate: lastDate,
        };
        if (typeFilter !== "all") {
          opts.eventType = typeFilter as FarmEventType;
        }

        const data = await fetchEvents(fid, opts);
        if (!cancelled) {
          setEvents(data);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("calendar.loadError"));
          setStatus("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeFarmId, viewYear, viewMonth, typeFilter, reloadKey, t]);

  /* ---------- navigation ---------- */

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function goToToday() {
    const n = new Date();
    setViewYear(n.getFullYear());
    setViewMonth(n.getMonth());
    setSelectedDate(todayISO());
  }

  /* ---------- event actions ---------- */

  const eventsByDate = groupEventsByDate(events);
  const grid = buildMonthGrid(viewYear, viewMonth);

  function handleAddEvent(date?: string) {
    setEditingEvent(null);
    setFormDefaultDate(date ?? todayISO());
    setFormOpen(true);
  }

  function handleEditEvent(ev: FarmEvent) {
    setEditingEvent(ev);
    setFormDefaultDate(undefined);
    setFormOpen(true);
  }

  async function handleSave(input: FarmEventInput) {
    if (editingEvent) {
      await updateEvent(editingEvent.id, input);
    } else {
      await createEvent(input);
    }
    setReloadKey((k) => k + 1);
  }

  async function handleDelete(id: string) {
    await deleteEvent(id);
    setReloadKey((k) => k + 1);
  }

  async function handleComplete(id: string) {
    await completeEvent(id);
    setReloadKey((k) => k + 1);
  }

  async function handleSkip(id: string) {
    await skipEvent(id);
    setReloadKey((k) => k + 1);
  }

  /* ---------- stats ---------- */

  const monthEvents = events;
  const completedCount = monthEvents.filter((e) => e.status === "completed").length;
  const upcomingCount = monthEvents.filter(
    (e) => e.status === "scheduled" && e.scheduledDate >= today
  ).length;

  /* ---------- no farm guard ---------- */

  if (!activeFarmId) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("page.cropCalendar")} />
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title={t("farm.noFarmTitle")}
          description={t("farm.noFarmDescription")}
        />
      </div>
    );
  }

  /* ---------- loading / error states ---------- */

  if (status === "loading" && events.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("page.cropCalendar")} />
        <LoadingState />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title={t("page.cropCalendar")} />
        <ErrorState
          message={error ?? t("calendar.loadError")}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  /* ---------- selected date events ---------- */

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t("page.cropCalendar")}
        subtitle={t("calendar.subtitle")}
        action={
          <Button onClick={() => handleAddEvent(selectedDate ?? todayISO())} size="sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("calendar.addEvent")}
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={CalendarDays}
          label={t("calendar.statUpcoming")}
          value={upcomingCount}
          hint={t("calendar.statUpcomingHint")}
        />
        <StatCard
          icon={CheckCircle2}
          label={t("calendar.statCompleted")}
          value={completedCount}
          hint={t("calendar.statCompletedHint")}
        />
        <StatCard
          icon={MoreHorizontal}
          label={t("calendar.statTotal")}
          value={monthEvents.length}
          hint={t("calendar.statTotalHint")}
        />
      </div>

      {/* Calendar controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevMonth} aria-label={t("calendar.prevMonth")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center font-heading text-lg font-semibold text-foreground">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <Button variant="outline" size="icon" onClick={goToNextMonth} aria-label={t("calendar.nextMonth")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            {t("calendar.today")}
          </Button>
        </div>

        {/* Event type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("calendar.filterAll")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("calendar.filterAll")}</SelectItem>
            {ALL_EVENT_TYPES.map((et) => (
              <SelectItem key={et} value={et}>
                {t(`calendar.type.${et}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-4">
          {/* Day-of-week headers */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {DAY_LABELS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map((dateISO, idx) => {
              if (!dateISO) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }

              const dayNum = parseInt(dateISO.split("-")[2], 10);
              const dayEvents = eventsByDate[dateISO] ?? [];
              const isToday = dateISO === today;
              const isSelected = dateISO === selectedDate;

              return (
                <button
                  key={dateISO}
                  type="button"
                  onClick={() => setSelectedDate(dateISO)}
                  onDoubleClick={() => handleAddEvent(dateISO)}
                  className={cn(
                    "relative flex flex-col items-start rounded-lg px-1.5 py-1.5 text-sm transition-all duration-150",
                    "min-h-[3rem] sm:min-h-[4rem]",
                    "hover:bg-accent/50",
                    isToday && !isSelected && "ring-2 ring-primary/40",
                    isSelected && "bg-primary/10 ring-2 ring-primary",
                    !isToday && !isSelected && "text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday && "bg-primary text-primary-foreground"
                    )}
                  >
                    {dayNum}
                  </span>
                  {/* Event dots */}
                  {dayEvents.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            ev.status === "completed"
                              ? "bg-green-500"
                              : ev.status === "skipped"
                                ? "bg-gray-300"
                                : EVENT_TYPE_META[ev.eventType].dotColor
                          )}
                          title={ev.title}
                        />
                      ))}
                      {dayEvents.length > 3 ? (
                        <span className="text-[9px] text-muted-foreground">
                          +{dayEvents.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected date events */}
      {selectedDate ? (
        <div className="space-y-3">
          <SectionHeader
            title={formatDateLabel(selectedDate)}
            subtitle={
              selectedEvents.length > 0
                ? `${selectedEvents.length} ${t("calendar.eventsLabel")}`
                : undefined
            }
            action={
              <Button variant="outline" size="sm" onClick={() => handleAddEvent(selectedDate)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t("calendar.addEvent")}
              </Button>
            }
          />

          {selectedEvents.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title={t("calendar.noEvents")}
              description={t("calendar.noEventsHint")}
              action={
                <Button variant="outline" size="sm" onClick={() => handleAddEvent(selectedDate)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t("calendar.addEvent")}
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  onEdit={() => handleEditEvent(ev)}
                  onDelete={() => handleDelete(ev.id)}
                  onComplete={() => handleComplete(ev.id)}
                  onSkip={() => handleSkip(ev.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Event form dialog */}
      <CalendarEventForm
        open={formOpen}
        onOpenChange={setFormOpen}
        farmId={activeFarmId}
        event={editingEvent}
        defaultDate={formDefaultDate}
        onSave={handleSave}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Event card                                                           */
/* ------------------------------------------------------------------ */

function EventCard({
  event,
  onEdit,
  onDelete,
  onComplete,
  onSkip,
}: {
  event: FarmEvent;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const { t } = usePreferences();
  const meta = EVENT_TYPE_META[event.eventType];
  const Icon = meta.icon;
  const isScheduled = event.status === "scheduled";
  const isCompleted = event.status === "completed";
  const isSkipped = event.status === "skipped";

  return (
    <Card className={cn(isSkipped && "opacity-60")}>
      <CardContent className="flex items-center gap-4 p-4">
        {/* Icon */}
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
            isCompleted
              ? "bg-green-50 text-green-600 ring-green-200"
              : isSkipped
                ? "bg-gray-50 text-gray-400 ring-gray-200"
                : "bg-primary-soft text-primary ring-primary/10"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "truncate text-sm font-semibold text-foreground",
                isCompleted && "line-through"
              )}
            >
              {event.title}
            </p>
            <Badge variant={meta.variant}>
              {t(`calendar.type.${event.eventType}`)}
            </Badge>
            {isCompleted ? (
              <Badge variant="success">{t("calendar.statusCompleted")}</Badge>
            ) : isSkipped ? (
              <Badge variant="neutral">{t("calendar.statusSkipped")}</Badge>
            ) : null}
          </div>
          {event.description ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {event.description}
            </p>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {isScheduled ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onComplete}
                aria-label={t("calendar.markComplete")}
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onSkip}
                aria-label={t("calendar.markSkip")}
                className="text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t("common.edit")}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label={t("common.delete")}
            className="text-muted-foreground hover:text-danger hover:bg-danger-soft"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Utilities                                                            */
/* ------------------------------------------------------------------ */

function formatDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
