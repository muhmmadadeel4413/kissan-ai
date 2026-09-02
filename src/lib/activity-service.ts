import { supabase } from "./supabase";
import { fetchDiagnoses } from "./diagnosis-service";
import { fetchActiveRisks } from "./risk-service";
import { listConversations } from "./chat-service";
import type { Level, Severity } from "../types";

/**
 * Recent Activity aggregation (Prompt 11).
 *
 * Builds a single "what's been happening on your farm" timeline from REAL
 * persisted records only — diagnoses, action items, risk alerts, and chat
 * conversations. Sources are fetched independently with `Promise.allSettled`
 * so one failed service degrades gracefully (that source is skipped) instead
 * of taking down the whole dashboard section.
 *
 * No event is ever fabricated: if nothing exists, an empty result is returned
 * and the UI shows a proper "No recent activity" state.
 */

export type ActivityKind = "diagnosis" | "action" | "risk" | "chat";

export interface ActivityItem {
  /** Unique key for React lists. */
  key: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  /** ISO timestamp used for sorting + relative labels. */
  timestamp: string;
  /** Short text badge (e.g. "High") — severity is always text, never colour-only. */
  metaLabel: string | null;
  metaTone: "success" | "warning" | "danger" | "neutral";
  /** Existing route to open, or null for non-navigable entries. */
  href: string | null;
}

export interface RecentActivityResult {
  items: ActivityItem[];
  /** Only set when every source failed (so the UI can offer a retry). */
  error: string | null;
}

const TONE: Record<"high" | "medium" | "low", ActivityItem["metaTone"]> = {
  high: "danger",
  medium: "warning",
  low: "success",
};

const LEVEL_LABEL: Record<Level, string> = { high: "High", medium: "Medium", low: "Low" };
const SEVERITY_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };

/** Never surface raw DB/network errors to the UI. */
function friendlyError(err: unknown, fallback: string): never {
  console.error("activity-service:", err);
  throw new Error(fallback);
}

async function loadDiagnoses(farmId: string): Promise<ActivityItem[]> {
  const rows = await fetchDiagnoses(farmId);
  return rows.map((d) => ({
    key: `diagnosis:${d.id}`,
    kind: "diagnosis" as const,
    title: `Crop diagnosis: ${d.diagnosis}`,
    detail: `${d.crop} · ${d.confidence}% confidence`,
    timestamp: d.createdAt,
    metaLabel: SEVERITY_LABEL[d.severity] ?? "Medium",
    metaTone: TONE[d.severity],
    href: "/diagnosis-history",
  }));
}

async function loadActions(farmId: string): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from("action_items")
    .select("id, title, completed, completed_at, created_at, priority")
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) friendlyError(error, "We couldn't load your recent actions.");

  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    completed: boolean;
    completed_at: string | null;
    created_at: string;
    priority: "high" | "medium" | "low";
  }>;

  return rows.map((a) => {
    const done = a.completed && a.completed_at;
    return {
      key: `action:${a.id}`,
      kind: "action" as const,
      title: done ? `Action completed: ${a.title}` : `New action planned: ${a.title}`,
      detail: done ? "Marked done in Today's Actions" : "Added by the decision engine",
      timestamp: done ? (a.completed_at as string) : a.created_at,
      metaLabel: LEVEL_LABEL[a.priority] ?? "Low",
      metaTone: TONE[a.priority],
      href: "/actions",
    };
  });
}

async function loadRisks(farmId: string): Promise<ActivityItem[]> {
  const rows = await fetchActiveRisks(farmId);
  return rows.map((r) => ({
    key: `risk:${r.id}`,
    kind: "risk" as const,
    title: `Risk alert: ${r.title}`,
    detail: r.explanation,
    timestamp: r.createdAt,
    metaLabel: LEVEL_LABEL[r.level] ?? "Medium",
    metaTone: TONE[r.level],
    href: "/risks",
  }));
}

async function loadChats(farmId: string): Promise<ActivityItem[]> {
  const rows = await listConversations(farmId);
  return rows.map((c) => ({
    key: `chat:${c.id}`,
    kind: "chat" as const,
    title: `Chat: ${c.title}`,
    detail: "Conversation with Kissan AI",
    timestamp: c.updatedAt,
    metaLabel: null,
    metaTone: "neutral" as const,
    href: `/assistant?conversation=${c.id}`,
  }));
}

/**
 * Fetch the most recent real activity for a farm, newest first. Never throws
 * to the caller — a `RecentActivityResult` with an `error` message is returned
 * only when every source failed (allowing the UI to show a retry state).
 */
export async function fetchRecentActivity(
  farmId: string | null | undefined,
  limit = 8
): Promise<RecentActivityResult> {
  if (!farmId) return { items: [], error: null };

  const settled = await Promise.allSettled([
    loadDiagnoses(farmId),
    loadActions(farmId),
    loadRisks(farmId),
    loadChats(farmId),
  ]);

  const items: ActivityItem[] = [];
  let resolved = 0;
  for (const result of settled) {
    if (result.status === "fulfilled") {
      resolved += 1;
      items.push(...result.value);
    } else {
      console.error("activity-service:", result.reason);
    }
  }

  items.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  const error =
    resolved === 0 ? "We couldn't load your recent activity. Please try again." : null;
  return { items: items.slice(0, limit), error };
}