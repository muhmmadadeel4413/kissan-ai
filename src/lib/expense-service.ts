import { supabase } from "./supabase";
import { isNetworkError, networkErrorMessage } from "./supabase-errors";
import type { Expense, ExpenseCategory, ExpenseCategoryTotal, ExpenseInput } from "../types";

/**
 * Farm Expenses data layer.
 *
 * All operations are scoped to a single farm via `farm_id` + Row Level
 * Security (user_id = auth.uid()). No AI is involved — this is plain CRUD
 * on farmer-entered expense records.
 */

/* ------------------------------------------------------------------ */
/* Row shape + mapper                                                  */
/* ------------------------------------------------------------------ */

/** Raw row shape from the `expenses` table (snake_case). */
export interface ExpenseRow {
  id: string;
  farm_id: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  expense_date: string;
  created_at: string;
}

function mapRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    farmId: row.farm_id,
    category: row.category,
    amount: Number(row.amount),
    description: row.description ?? undefined,
    expenseDate: row.expense_date,
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ */
/* Error handling                                                      */
/* ------------------------------------------------------------------ */

/**
 * Never surface raw database messages to the user. Log for diagnostics and
 * throw a human, actionable message instead.
 */
function friendlyError(err: unknown, fallback: string): never {
  console.error("expense-service:", err);
  if (isNetworkError(err)) {
    throw new Error(networkErrorMessage());
  }
  throw new Error(fallback);
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

/** Filter options for fetching expenses. */
export interface FetchExpensesOptions {
  /** ISO date string (YYYY-MM-DD) — inclusive start. */
  startDate?: string;
  /** ISO date string (YYYY-MM-DD) — inclusive end. */
  endDate?: string;
  /** Restrict to one category. */
  category?: ExpenseCategory;
}

/**
 * Fetch expenses for a farm, ordered newest-first. Optionally filtered by
 * date range and/or category. RLS scopes results to the authenticated user.
 */
export async function fetchExpenses(
  farmId: string,
  opts?: FetchExpensesOptions
): Promise<Expense[]> {
  let query = supabase
    .from("expenses")
    .select("*")
    .eq("farm_id", farmId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (opts?.startDate) query = query.gte("expense_date", opts.startDate);
  if (opts?.endDate) query = query.lte("expense_date", opts.endDate);
  if (opts?.category) query = query.eq("category", opts.category);

  const { data, error } = await query;
  if (error) {
    friendlyError(error, "We couldn't load your expenses. Please try again.");
  }
  return (data as ExpenseRow[] | null)?.map(mapRow) ?? [];
}

/** Insert a new expense record and return the created expense. */
export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      farm_id: input.farmId,
      category: input.category,
      amount: input.amount,
      description: input.description ?? null,
      expense_date: input.expenseDate,
    })
    .select()
    .single();

  if (error) {
    friendlyError(error, "We couldn't save this expense. Please try again.");
  }
  return mapRow(data as ExpenseRow);
}

/** Update an existing expense and return the updated record. */
export async function updateExpense(
  id: string,
  patch: Partial<Omit<ExpenseInput, "farmId">>
): Promise<Expense> {
  const row: Record<string, unknown> = {};
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.description !== undefined) row.description = patch.description || null;
  if (patch.expenseDate !== undefined) row.expense_date = patch.expenseDate;

  const { data, error } = await supabase
    .from("expenses")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    friendlyError(error, "We couldn't update this expense. Please try again.");
  }
  return mapRow(data as ExpenseRow);
}

/** Delete an expense by its UUID. */
export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) {
    friendlyError(error, "We couldn't delete this expense. Please try again.");
  }
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Compute category totals client-side from a fetched expense list.
 * Avoids an extra round-trip for small datasets (typical farm expense
 * volumes are well within the Supabase row limit for a single query).
 */
export function computeCategoryTotals(expenses: Expense[]): ExpenseCategoryTotal[] {
  const map = new Map<ExpenseCategory, { total: number; count: number }>();

  for (const e of expenses) {
    const cur = map.get(e.category) ?? { total: 0, count: 0 };
    cur.total += e.amount;
    cur.count += 1;
    map.set(e.category, cur);
  }

  return [...map.entries()]
    .map(([category, { total, count }]) => ({ category, total, count }))
    .sort((a, b) => b.total - a.total);
}

/** Sum all amounts in an expense list. */
export function computeGrandTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}
