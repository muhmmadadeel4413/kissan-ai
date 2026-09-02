import { supabase } from "./supabase";
import type {
  ActionItem,
  ActionSource,
  ActionTiming,
  Priority,
  TodayActionsDecision,
} from "../types";

/**
 * "What Should I Do Today?" — Decision Engine client data layer (Prompt 10).
 *
 * The real decision happens server-side in the `today-actions` Edge Function
 * (which owns the Gemini API key, validates the farm, loads real diagnoses and
 * risks, and persists `action_items` via the service role).
 *
 * This module only:
 *   1. reads back persisted actions for a farm + day,
 *   2. asks the Edge Function to (re)generate today's actions,
 *   3. toggles completion state.
 *
 * No action is ever fabricated client-side, and no AI key ever reaches the
 * browser.
 */

/* ------------------------------------------------------------------ */
/* Row shape from the `action_items` table (snake_case)                */
/* ------------------------------------------------------------------ */

export interface ActionItemRow {
  id: string;
  farm_id: string;
  action_date: string;
  title: string;
  description: string;
  priority: Priority;
  category: ActionItem["category"];
  reason: string;
  timing: ActionTiming | null;
  source: ActionSource[] | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

function mapRow(row: ActionItemRow): ActionItem {
  return {
    id: row.id,
    farmId: row.farm_id,
    actionDate: row.action_date,
    title: row.title,
    description: row.description,
    priority: row.priority,
    category: row.category,
    reason: row.reason,
    timing: row.timing,
    source: row.source ?? [],
    completed: row.completed,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

/** Local date as YYYY-MM-DD (used for "today's" actions). */
export function todayActionDate(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Sort actions so the farmer sees the most important first. */
function orderByPriority(actions: ActionItem[]): ActionItem[] {
  const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  return [...actions].sort(
    (a, b) =>
      rank[a.priority] - rank[b.priority] ||
      +new Date(b.createdAt) - +new Date(a.createdAt)
  );
}

/** Never surface raw DB/network errors to the UI. */
function friendlyError(err: unknown, fallback: string): never {
  console.error("actions-service:", err);
  throw new Error(fallback);
}

/** Extract a human-friendly message from a Supabase Edge Function error. */
async function edgeErrorToMessage(err: unknown): Promise<string> {
  const e = err as {
    context?: { text?: () => Promise<string> };
    message?: string;
  };
  if (e?.context && typeof e.context.text === "function") {
    try {
      const text = await e.context.text();
      const parsed = JSON.parse(text) as { error?: string };
      return (
        parsed.error ||
        "We couldn't update today's actions right now. Please try again."
      );
    } catch {
      return "We couldn't update today's actions right now. Please try again.";
    }
  }
  return (
    e?.message ||
    "We couldn't update today's actions right now. Please try again."
  );
}

/* ------------------------------------------------------------------ */
/* Read persisted actions                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch the saved actions for a farm + action date (defaults to today).
 * Returns real persisted rows only — never synthetic fallbacks.
 */
export async function fetchTodayActions(
  farmId: string | null | undefined,
  actionDate = todayActionDate()
): Promise<ActionItem[]> {
  if (!farmId) return [];

  const { data, error } = await supabase
    .from("action_items")
    .select("*")
    .eq("farm_id", farmId)
    .eq("action_date", actionDate)
    .order("created_at", { ascending: true });

  if (error) {
    friendlyError(error, "We couldn't load today's actions. Please try again.");
  }

  return orderByPriority((data as ActionItemRow[] | null)?.map(mapRow) ?? []);
}

/* ------------------------------------------------------------------ */
/* Run the Decision Engine                                             */
/* ------------------------------------------------------------------ */

export interface GenerateTodayActionsInput {
  farmId: string;
  actionDate?: string;
  /** Real weather snapshot already fetched via the existing weather system. */
  weather?: {
    temperature?: number;
    humidity?: number;
    rainProbability?: number;
    windSpeed?: number;
    condition?: string;
    forecast?: Array<{
      date?: string;
      condition?: string;
      temperatureMax?: number;
      rainProbability?: number;
      windSpeed?: number;
    }>;
  } | null;
}

/**
 * Ask the Edge Function to (re)run the Decision Engine for the farm.
 * The function loads real diagnoses + active risks itself (service role),
 * calls Gemini, validates the output, and persists the actions. Returns the
 * freshly-persisted decision.
 */
export async function generateTodayActions(
  input: GenerateTodayActionsInput
): Promise<TodayActionsDecision> {
  const { data, error } = await supabase.functions.invoke("today-actions", {
    body: {
      farmId: input.farmId,
      actionDate: input.actionDate ?? todayActionDate(),
      weather: input.weather ?? null,
    },
  });

  if (error) {
    friendlyError(error, await edgeErrorToMessage(error));
  }

  const payload = data as {
    success?: boolean;
    insufficientData?: boolean;
    generatedAt?: string;
    actionDate?: string;
    actions?: ActionItemRow[];
    summary?: string;
    limitations?: string[];
    error?: string;
  };

  if (!payload?.success) {
    friendlyError(
      payload?.error,
      payload?.error ||
        "We couldn't update today's actions right now. Please try again."
    );
  }

  return {
    actions: orderByPriority(
      (payload.actions ?? []).map(mapRow)
    ),
    summary: payload.summary ?? "",
    limitations: payload.limitations ?? [],
    generatedAt: payload.generatedAt ?? new Date().toISOString(),
    actionDate: payload.actionDate ?? todayActionDate(),
    insufficientData: payload.insufficientData === true,
  };
}

/* ------------------------------------------------------------------ */
/* Completion                                                          */
/* ------------------------------------------------------------------ */

/**
 * Mark an action completed (or un-completed). Persists via anon RLS update
 * (scoped by row id). Returns the updated action.
 */
export async function setActionCompleted(
  actionId: string,
  completed: boolean
): Promise<ActionItem> {
  const patch: Record<string, unknown> = {
    completed,
    updated_at: new Date().toISOString(),
  };
  if (completed) patch.completed_at = new Date().toISOString();
  else patch.completed_at = null;

  const { data, error } = await supabase
    .from("action_items")
    .update(patch)
    .eq("id", actionId)
    .select()
    .single();

  if (error) {
    friendlyError(error, "We couldn't update this action. Please try again.");
  }

  return mapRow(data as ActionItemRow);
}