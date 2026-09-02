import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { usePreferences } from "../../context/PreferencesContext";
import type { FarmEvent, FarmEventInput, FarmEventType } from "../../types";

/** All 7 event types (matches the DB CHECK constraint). */
const EVENT_TYPES: FarmEventType[] = [
  "irrigation",
  "fertilizer",
  "pesticide",
  "pest_monitoring",
  "harvest",
  "inspection",
  "other",
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Add / edit farm-event dialog. When `event` is provided the form is
 * pre-filled for editing; otherwise it creates a new record.
 */
export function CalendarEventForm({
  open,
  onOpenChange,
  farmId,
  event,
  /** Pre-selected date from the calendar cell that was clicked. */
  defaultDate,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  /** Existing event to edit; null/undefined for create. */
  event?: FarmEvent | null;
  /** Default date pre-filled when creating a new event. */
  defaultDate?: string;
  onSave: (input: FarmEventInput) => Promise<void>;
}) {
  const { t } = usePreferences();
  const isEdit = Boolean(event);

  const [eventType, setEventType] = React.useState<FarmEventType>(
    event?.eventType ?? "irrigation"
  );
  const [title, setTitle] = React.useState(event?.title ?? "");
  const [description, setDescription] = React.useState(event?.description ?? "");
  const [date, setDate] = React.useState(
    event?.scheduledDate ?? defaultDate ?? todayISO()
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset form when the dialog opens with a different event (or no event).
  React.useEffect(() => {
    if (open) {
      setEventType(event?.eventType ?? "irrigation");
      setTitle(event?.title ?? "");
      setDescription(event?.description ?? "");
      setDate(event?.scheduledDate ?? defaultDate ?? todayISO());
      setError(null);
    }
  }, [open, event, defaultDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(t("calendar.errTitle"));
      return;
    }
    if (!date) {
      setError(t("calendar.errDate"));
      return;
    }

    setSaving(true);
    try {
      await onSave({
        farmId,
        eventType,
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledDate: date,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("calendar.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("calendar.editTitle") : t("calendar.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("calendar.formSubtitle")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event type */}
          <div className="space-y-2">
            <Label htmlFor="evt-type">{t("calendar.eventType")}</Label>
            <Select
              value={eventType}
              onValueChange={(v) => setEventType(v as FarmEventType)}
            >
              <SelectTrigger id="evt-type">
                <SelectValue placeholder={t("calendar.selectType")} />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((et) => (
                  <SelectItem key={et} value={et}>
                    {t(`calendar.type.${et}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="evt-title">{t("calendar.title")}</Label>
            <Input
              id="evt-title"
              type="text"
              placeholder={t("calendar.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="evt-date">{t("calendar.date")}</Label>
            <Input
              id="evt-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Description (optional) */}
          <div className="space-y-2">
            <Label htmlFor="evt-desc">
              {t("calendar.description")}{" "}
              <span className="text-muted-foreground">
                ({t("common.optional")})
              </span>
            </Label>
            <Textarea
              id="evt-desc"
              placeholder={t("calendar.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {error ? (
            <p className="text-sm font-medium text-danger">{error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  {t("calendar.saving")}
                </>
              ) : (
                t(isEdit ? "calendar.updateBtn" : "calendar.saveBtn")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
