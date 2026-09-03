import * as React from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  FlaskConical,
  ListChecks,
  ListTodo,
  Plus,
  Search,
  SkipForward,
  Sprout,
  Trash2,
  Wheat,
  X,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { PageHeader, SectionHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { LoadingState } from "../components/layout/loading-state";
import { ErrorState } from "../components/layout/error-state";
import { StatCard } from "../components/layout/stat-card";
import { CropCycleCard } from "../components/farm/crop-cycle-card";
import { useFarm } from "../context/FarmContext";
import { useI18n } from "../context/PreferencesContext";
import { supabase } from "../lib/supabase";
import { buildFarmContext } from "../lib/farm-context";
import type { FarmEvent, FarmEventStatus, FarmEventType } from "../types";
import { cn } from "../lib/utils";

const TYPE_LABEL_KEY: Record<FarmEventType, string> = {
  irrigation: "calendar.type.irrigation",
  fertilizer: "calendar.type.fertilizer",
  pesticide: "calendar.type.pesticide",
  pest_monitoring: "calendar.type.pest_monitoring",
  harvest: "calendar.type.harvest",
  inspection: "calendar.type.inspection",
  other: "calendar.type.other",
};

const TYPE_ICON: Record<FarmEventType, React.ComponentType<{ className?: string }>> = {
  irrigation: Droplets,
  fertilizer: FlaskConical,
  pesticide: Sprout,
  pest_monitoring: Search,
  harvest: Wheat,
  inspection: ListTodo,
  other: CalendarDays,
};

const TYPES: FarmEventType[] = [
  "irrigation",
  "fertilizer",
  "pesticide",
  "pest_monitoring",
  "harvest",
  "inspection",
  "other",
];

const STATUS_BADGE: Record<FarmEventStatus, "default" | "success" | "neutral"> = {
  scheduled: "default",
  completed: "success",
  skipped: "neutral",
};

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

interface FormState {
  eventType: FarmEventType | "";
  title: string;
  description: string;
  scheduledDate: string;
}

const EMPTY_FORM: FormState = { eventType: "", title: "", description: "", scheduledDate: "" };

export default function CropCalendarPage() {
  const { t } = useI18n();
  const { farm } = useFarm();

  const [events, setEvents] = React.useState<FarmEvent[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FarmEvent | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [monthOffset, setMonthOffset] = React.useState(0);
  const [eventFilter, setEventFilter] = React.useState<"all" | "today" | "upcoming">("all");

  const farmContext = React.useMemo(() => (farm ? buildFarmContext(farm) : null), [farm]);

  const load = React.useCallback(async () => {
    if (!farm) return;
    setStatus("loading");
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("farm_events")
        .select(
          "id, farm_id, event_type, title, description, scheduled_date, status, completed_at, created_at"
        )
        .eq("farm_id", farm.id)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        id: string;
        farm_id: string;
        event_type: FarmEventType;
        title: string;
        description: string | null;
        scheduled_date: string;
        status: FarmEventStatus;
        completed_at: string | null;
        created_at: string;
      }>;
      setEvents(
        rows.map((r) => ({
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
    } catch (err) {
      console.error("calendar-page:", err);
      setLoadError("We couldn't load your calendar events. Please try again.");
      setStatus("error");
    }
  }, [farm]);

  React.useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const anchor = React.useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const visibleMonth = monthKey(anchor);

  const grouped = React.useMemo(() => {
    const map = new Map<string, FarmEvent[]>();
    for (const e of events) {
      const key = e.scheduledDate.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    }
    return map;
  }, [events]);

  const monthEvents = grouped.get(visibleMonth) ?? [];

  const todayIso = new Date().toISOString().slice(0, 10);
  const filteredMonthEvents = React.useMemo(() => {
    if (eventFilter === "all") return monthEvents;
    if (eventFilter === "today") {
      return monthEvents.filter(
        (e) => e.scheduledDate === todayIso && e.status === "scheduled"
      );
    }
    return monthEvents.filter(
      (e) => e.status === "scheduled" && e.scheduledDate >= todayIso
    );
  }, [monthEvents, eventFilter, todayIso]);

  const today = toDateInputValue(new Date());
  const upcomingCount = events.filter((e) => e.status === "scheduled").length;
  const completedThisMonth = events.filter(
    (e) => e.status === "completed" && e.scheduledDate.slice(0, 7) === visibleMonth
  ).length;
  const totalThisMonth = monthEvents.length;

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, scheduledDate: today });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(event: FarmEvent) {
    setEditing(event);
    setForm({
      eventType: event.eventType,
      title: event.title,
      description: event.description ?? "",
      scheduledDate: event.scheduledDate,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!farm) return;
    if (!form.title.trim()) {
      setFormError(t("calendar.errTitle"));
      return;
    }
    if (!form.scheduledDate) {
      setFormError(t("calendar.errDate"));
      return;
    }
    if (!form.eventType) {
      setFormError("Please select an event type.");
      return;
    }

    setSaving(true);
    setFormError(null);
    const payload = {
      farm_id: farm.id,
      event_type: form.eventType,
      title: form.title.trim(),
      description: form.description.trim() || null,
      scheduled_date: form.scheduledDate,
    };
    try {
      const { error } = editing
        ? await supabase.from("farm_events").update(payload).eq("id", editing.id)
        : await supabase.from("farm_events").insert(payload);
      if (error) throw error;
      setDialogOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error("calendar-page save:", err);
      setFormError(t("calendar.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function setEventStatus(event: FarmEvent, statusToSet: FarmEventStatus) {
    try {
      const { error } = await supabase
        .from("farm_events")
        .update({
          status: statusToSet,
          completed_at: statusToSet === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", event.id);
      if (error) throw error;
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error("calendar-page status:", err);
    }
  }

  async function handleDelete(event: FarmEvent) {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    try {
      const { error } = await supabase.from("farm_events").delete().eq("id", event.id);
      if (error) throw error;
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error("calendar-page delete:", err);
    }
  }

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title={t("page.cropCalendar")}
          description={t("farmProfile.noFarmDesc")}
          action={
            <Button asChild>
              <Link to="/farm-setup">{t("farmSetup.createTitle")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("page.cropCalendar")}
        subtitle={t("calendar.subtitle")}
        action={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("calendar.addEvent")}
          </Button>
        }
      />

      <section aria-label={t("calendar.filterAll")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label={t("calendar.statUpcoming")}
            value={upcomingCount}
            hint={t("calendar.statUpcomingHint")}
            icon={ListChecks}
            iconClassName="bg-primary-soft text-primary"
          />
          <StatCard
            label={t("calendar.statCompleted")}
            value={completedThisMonth}
            hint={t("calendar.statCompletedHint")}
            icon={Check}
            iconClassName="bg-success-soft text-success"
          />
          <StatCard
            label={t("calendar.statTotal")}
            value={totalThisMonth}
            hint={t("calendar.statTotalHint")}
            icon={CalendarDays}
          />
        </div>
      </section>

      {/* Crop cycle — real farm crop, growth stage and harvest timeline */}
      <section aria-label="Crop cycle">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CropCycleCard farm={farm} growth={farmContext?.growth ?? buildFarmContext(farm).growth} />
          <Card className="h-full">
            <CardContent className="flex h-full flex-col gap-3 py-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-heading text-base font-bold text-foreground">
                    Season at a glance
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {farmContext?.growth.stageLabel ?? "Growth stage unavailable"}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Crop age</dt>
                  <dd className="text-sm font-bold text-foreground">
                    {farmContext?.growth.cropAgeDays !== null
                      ? `${farmContext?.growth.cropAgeDays} days`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Land area</dt>
                  <dd className="text-sm font-bold text-foreground">
                    {farm.landArea || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Soil type</dt>
                  <dd className="text-sm font-bold text-foreground">{farm.soilType || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Irrigation</dt>
                  <dd className="text-sm font-bold text-foreground">
                    {farm.irrigationMethod || "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-auto text-xs leading-relaxed text-muted-foreground">
                Timeline stages are estimated from your saved planting date and crop. Log
                activities below to track work across the season.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Month navigation + filter */}
      <section className="space-y-3" aria-label="Calendar navigation">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthOffset((o) => o - 1)}
            aria-label={t("calendar.prevMonth")}
            className="cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {t("calendar.prevMonth")}
          </Button>
          <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">
            {anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <div className="flex items-center gap-2">
            {monthOffset !== 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMonthOffset(0)}
                className="cursor-pointer"
              >
                {t("calendar.today")}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonthOffset((o) => o + 1)}
              aria-label={t("calendar.nextMonth")}
              className="cursor-pointer"
            >
              {t("calendar.nextMonth")}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter events">
          {(
            [
              { key: "all", label: t("calendar.filterAll") },
              { key: "today", label: t("calendar.filterToday") },
              { key: "upcoming", label: t("calendar.filterUpcoming") },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setEventFilter(f.key)}
              aria-pressed={eventFilter === f.key}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors duration-150",
                eventFilter === f.key
                  ? "border-primary/30 bg-primary-soft text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {status === "loading" ? (
        <LoadingState rows={3} title={t("calendar.loadError")} />
      ) : status === "error" ? (
        <ErrorState
          title={t("calendar.loadError")}
          message={loadError ?? undefined}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : filteredMonthEvents.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title={t("calendar.noEvents")}
          description={t("calendar.noEventsHint")}
          action={
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("calendar.addEvent")}
            </Button>
          }
        />
      ) : (
        <section className="space-y-3">
          <SectionHeader
            title={`${filteredMonthEvents.length} ${t("calendar.eventsLabel")}`}
            subtitle={t("calendar.filterAll")}
          />
          <div className="space-y-2.5">
            {filteredMonthEvents.map((event) => {
              const TypeIcon = TYPE_ICON[event.eventType] ?? CalendarDays;
              return (
                <Card key={event.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 py-4">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl",
                        event.status === "completed"
                          ? "bg-success-soft text-success"
                          : "bg-primary-soft text-primary"
                      )}
                    >
                      <TypeIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "text-sm font-semibold text-foreground",
                            event.status === "completed" && "line-through opacity-70"
                          )}
                        >
                          {event.title}
                        </p>
                        <Badge variant={STATUS_BADGE[event.status]}>
                          {event.status === "completed"
                            ? t("calendar.statusCompleted")
                            : event.status === "skipped"
                              ? t("calendar.statusSkipped")
                              : t(TYPE_LABEL_KEY[event.eventType])}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(event.scheduledDate + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      {event.description ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {event.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {event.status !== "completed" ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void setEventStatus(event, "completed")}
                          aria-label={t("calendar.markComplete")}
                          className="cursor-pointer text-success"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                      {event.status === "scheduled" ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void setEventStatus(event, "skipped")}
                          aria-label={t("calendar.markSkip")}
                          className="cursor-pointer text-muted-foreground"
                        >
                          <SkipForward className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void setEventStatus(event, "scheduled")}
                          aria-label={t("calendar.markSkip")}
                          className="cursor-pointer text-muted-foreground"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(event)}
                        aria-label={t("calendar.editTitle")}
                        className="cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleDelete(event)}
                        aria-label={t("expenses.deleteBtn")}
                        className="cursor-pointer text-danger hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("calendar.editTitle") : t("calendar.addTitle")}</DialogTitle>
            <DialogDescription>{t("calendar.formSubtitle")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="event-type-field">{t("calendar.eventType")} *</Label>
              <Select
                value={form.eventType}
                onValueChange={(v) => setForm((f) => ({ ...f, eventType: v as FarmEventType }))}
              >
                <SelectTrigger id="event-type-field">
                  <SelectValue placeholder={t("calendar.selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(TYPE_LABEL_KEY[type])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-title-field">{t("calendar.title")} *</Label>
              <Input
                id="event-title-field"
                placeholder={t("calendar.titlePlaceholder")}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-date-field">{t("calendar.date")} *</Label>
              <Input
                id="event-date-field"
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-desc-field">{t("calendar.description")}</Label>
              <Textarea
                id="event-desc-field"
                placeholder={t("calendar.descriptionPlaceholder")}
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {formError ? (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? t("calendar.saving")
                  : editing
                    ? t("calendar.updateBtn")
                    : t("calendar.saveBtn")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
