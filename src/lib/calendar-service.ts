/**
 * Calendar / Farm Events service.
 *
 * Provides CRUD for the `farm_events` table along with calendar-specific
 * queries (by date range, upcoming events, mark-complete/skip). All Supabase
 * rows use snake_case columns; this service maps to camelCase FarmEvent
 * instances via {@link mapRow}. Errors are wrapped through {@link friendlyError}
 * for graceful UI display.
 */

import { supabase } from "./supabase";
import type {
  FarmEvent,
  FarmEventInput,
  FarmEventStatus,
} from "../types";

/* ---------- error helpers ---------- */

function friendlyError(err: unknown, fallback: string): never {
  if (err instanceof Error && err.message) {
    throw new Error(err.message);
  }
  throw new Error(fallback);
}

/* ---------- internal row shape (snake_case from Postgres) ---------- */

interface FarmEventRow {
  id: string;
  farm_id: string;
  user_id: string;
  event_type: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

/* ---------- helpers ---------- */

function mapRow(row: FarmEventRow): FarmEvent {
  return {
    id: row.id,
    farmId: row.farm_id,
    eventType: row.event_type as FarmEvent["eventType"],
    title: row.title,
    description: row.description ?? undefined,
    scheduledDate: row.scheduled_date,
    status: row.status as FarmEvent["status"],
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
  };
}

export interface FetchEventsOptions {
  /** Inclusive ISO date (YYYY-MM-DD) lower bound. */
  startDate?: string;
  /** Inclusive ISO date (YYYY-MM-DD) upper bound. */
  endDate?: string;
  /** Filter by event type. */
  eventType?: FarmEvent["eventType"];
  /** Filter by status. */
  status?: FarmEventStatus;
}

/* ---------- CRUD ---------- */

/**
 * Fetch farm events for a farm, optionally filtered by date range, type, or
 * status. Results are ordered by scheduled_date ascending, then created_at
 * descending.
 */
export async function fetchEvents(
  farmId: string,
  opts: FetchEventsOptions = {},
): Promise<FarmEvent[]> {
  try {
    let query = supabase
      .from("farm_events")
      .select("*")
      .eq("farm_id", farmId);

    if (opts.startDate) {
      query = query.gte("scheduled_date", opts.startDate);
    }
    if (opts.endDate) {
      query = query.lte("scheduled_date", opts.endDate);
    }
    if (opts.eventType) {
      query = query.eq("event_type", opts.eventType);
    }
    if (opts.status) {
      query = query.eq("status", opts.status);
    }

    const { data, error } = await query
      .order("scheduled_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row as FarmEventRow));
  } catch (err) {
    friendlyError(err, "We couldn't load your calendar events. Please try again.");
  }
}

/**
 * Create a new farm event. Automatically attaches the current user's id from
 * the active Supabase session.
 */
export async function createEvent(input: FarmEventInput): Promise<FarmEvent> {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const userId = userData.user?.id;
    if (!userId) {
      throw new Error("You must be signed in to create a calendar event.");
    }

    const { data, error } = await supabase
      .from("farm_events")
      .insert({
        farm_id: input.farmId,
        user_id: userId,
        event_type: input.eventType,
        title: input.title,
        description: input.description ?? null,
        scheduled_date: input.scheduledDate,
        status: "scheduled",
      })
      .select()
      .single();

    if (error) throw error;
    return mapRow(data as FarmEventRow);
  } catch (err) {
    friendlyError(err, "We couldn't save this event. Please try again.");
  }
}

/**
 * Update an existing farm event. Only the provided fields are written — any
 * omitted field is left unchanged.
 */
export async function updateEvent(
  id: string,
  patch: Partial<FarmEventInput>,
): Promise<FarmEvent> {
  try {
    const payload: Record<string, unknown> = {};
    if (patch.eventType !== undefined) payload.event_type = patch.eventType;
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.description !== undefined)
      payload.description = patch.description || null;
    if (patch.scheduledDate !== undefined)
      payload.scheduled_date = patch.scheduledDate;

    const { data, error } = await supabase
      .from("farm_events")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return mapRow(data as FarmEventRow);
  } catch (err) {
    friendlyError(err, "We couldn't update this event. Please try again.");
  }
}

/** Delete a farm event permanently. */
export async function deleteEvent(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("farm_events")
      .delete()
      .eq("id", id);
    if (error) throw error;
  } catch (err) {
    friendlyError(err, "We couldn't delete this event. Please try again.");
  }
}

/**
 * Mark a scheduled event as completed. Sets the status to "completed" and
 * records the completion timestamp.
 */
export async function completeEvent(id: string): Promise<FarmEvent> {
  try {
    const { data, error } = await supabase
      .from("farm_events")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return mapRow(data as FarmEventRow);
  } catch (err) {
    friendlyError(err, "We couldn't update this event. Please try again.");
  }
}

/** Mark a scheduled event as skipped. */
export async function skipEvent(id: string): Promise<FarmEvent> {
  try {
    const { data, error } = await supabase
      .from("farm_events")
      .update({ status: "skipped" })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return mapRow(data as FarmEventRow);
  } catch (err) {
    friendlyError(err, "We couldn't update this event. Please try again.");
  }
}

/* ---------- calendar helpers ---------- */

/**
 * Group events by their scheduled date (YYYY-MM-DD). Useful for rendering
 * calendar cells where each date maps to its events array.
 */
export function groupEventsByDate(
  events: FarmEvent[],
): Record<string, FarmEvent[]> {
  const map: Record<string, FarmEvent[]> = {};
  for (const ev of events) {
    if (!map[ev.scheduledDate]) {
      map[ev.scheduledDate] = [];
    }
    map[ev.scheduledDate].push(ev);
  }
  return map;
}

/**
 * Fetch the next N upcoming scheduled events from today onwards. Used by the
 * dashboard "Today's Actions" or upcoming events widget.
 */
export async function fetchUpcomingEvents(
  farmId: string,
  limit: number = 5,
): Promise<FarmEvent[]> {
  const today = new Date().toISOString().split("T")[0];
  const events = await fetchEvents(farmId, {
    startDate: today,
    status: "scheduled",
  });
  return events.slice(0, limit);
}
