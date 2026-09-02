import { supabase } from "./supabase";

/* ------------------------------------------------------------------ */
/* Global Search Service                                                */
/* ------------------------------------------------------------------ */

/**
 * Searches across diagnoses, expenses, farm events, and risk alerts for the
 * given query string. Returns a unified list of search results with type,
 * title, subtitle, and optional href.
 *
 * Each sub-query uses `ilike` with `%query%` for substring matching.
 * Gracefully degrades when a table doesn't exist yet.
 */

export interface SearchResult {
  /** Kind of result (used for icon + grouping). */
  kind: "diagnosis" | "expense" | "event" | "risk";
  /** Display title. */
  title: string;
  /** Secondary text (date, amount, severity, etc.). */
  subtitle: string;
  /** Optional navigation target. */
  href?: string;
}

/** Run all search sub-queries in parallel and merge results. */
export async function globalSearch(
  farmId: string,
  query: string,
): Promise<SearchResult[]> {
  const q = `%${query.trim()}%`;
  if (query.trim().length === 0) return [];

  const [diagnoses, expenses, events, risks] = await Promise.allSettled([
    // Diagnoses — search by diagnosis text or crop
    supabase
      .from("diagnoses")
      .select("id, diagnosis, crop, confidence, created_at")
      .eq("farm_id", farmId)
      .or(`diagnosis.ilike.${q},crop.ilike.${q}`)
      .order("created_at", { ascending: false })
      .limit(5),
    // Expenses — search by description or category
    supabase
      .from("expenses")
      .select("id, category, amount, description, expense_date")
      .eq("farm_id", farmId)
      .or(`description.ilike.${q},category.ilike.${q}`)
      .order("expense_date", { ascending: false })
      .limit(5),
    // Farm events — search by title
    supabase
      .from("farm_events")
      .select("id, title, event_type, scheduled_date")
      .eq("farm_id", farmId)
      .ilike("title", q)
      .order("scheduled_date", { ascending: false })
      .limit(5),
    // Risk alerts — search by title
    supabase
      .from("risk_alerts")
      .select("id, title, level, risk_type")
      .eq("farm_id", farmId)
      .ilike("title", q)
      .limit(5),
  ]);

  const results: SearchResult[] = [];

  if (diagnoses.status === "fulfilled" && diagnoses.value.data) {
    for (const d of diagnoses.value.data) {
      results.push({
        kind: "diagnosis",
        title: d.diagnosis,
        subtitle: `${d.crop} · ${d.confidence}% confidence`,
        href: "/diagnosis-history",
      });
    }
  }

  if (expenses.status === "fulfilled" && expenses.value.data) {
    for (const e of expenses.value.data) {
      results.push({
        kind: "expense",
        title: e.description || e.category,
        subtitle: `Rs ${Number(e.amount).toLocaleString()} · ${e.expense_date}`,
        href: "/expenses",
      });
    }
  }

  if (events.status === "fulfilled" && events.value.data) {
    for (const ev of events.value.data) {
      results.push({
        kind: "event",
        title: ev.title,
        subtitle: `${ev.event_type} · ${ev.scheduled_date}`,
        href: "/crop-calendar",
      });
    }
  }

  if (risks.status === "fulfilled" && risks.value.data) {
    for (const r of risks.value.data) {
      results.push({
        kind: "risk",
        title: r.title,
        subtitle: `${r.level} ${r.risk_type}`,
        href: "/risks",
      });
    }
  }

  return results;
}
