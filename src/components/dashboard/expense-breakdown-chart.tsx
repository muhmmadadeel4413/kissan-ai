import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Wallet } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { useFarm } from "../../context/FarmContext";
import { useI18n } from "../../context/PreferencesContext";
import { supabase } from "../../lib/supabase";
import type { Expense, ExpenseCategory } from "../../types";
import { cn } from "../../lib/utils";

/**
 * Expense Breakdown widget (Dashboard Phase 2).
 *
 * Summarises the current month's REAL expense records (from the `expenses`
 * table) as a headline total plus a sorted horizontal bar breakdown by
 * category. Text labels always accompany amounts — never colour-only — and an
 * empty month produces an honest, actionable empty state.
 */

const CATEGORY_LABEL_KEY: Record<ExpenseCategory, string> = {
  seeds: "expenses.cat.seeds",
  fertilizer: "expenses.cat.fertilizer",
  pesticide: "expenses.cat.pesticide",
  labor: "expenses.cat.labor",
  irrigation: "expenses.cat.irrigation",
  equipment: "expenses.cat.equipment",
  fuel: "expenses.cat.fuel",
  transport: "expenses.cat.transport",
  other: "expenses.cat.other",
};

const CATEGORY_BAR: Record<ExpenseCategory, string> = {
  seeds: "bg-primary",
  fertilizer: "bg-success",
  pesticide: "bg-danger",
  labor: "bg-warning",
  irrigation: "bg-accent",
  equipment: "bg-primary/60",
  fuel: "bg-success/60",
  transport: "bg-warning/60",
  other: "bg-muted-foreground/50",
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(amount: number): string {
  return `Rs ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function ExpenseBreakdownChart() {
  const { t } = useI18n();
  const { farm } = useFarm();
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    if (!farm) {
      setExpenses([]);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    supabase
      .from("expenses")
      .select("id, farm_id, category, amount, description, expense_date, created_at")
      .eq("farm_id", farm.id)
      .order("expense_date", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("expense-breakdown-chart:", error.message);
          setExpenses([]);
          setStatus("error");
          return;
        }
        const rows = (data ?? []) as Array<{
          id: string;
          farm_id: string;
          category: ExpenseCategory;
          amount: number;
          description: string | null;
          expense_date: string;
          created_at: string;
        }>;
        setExpenses(
          rows.map((r) => ({
            id: r.id,
            farmId: r.farm_id,
            category: r.category,
            amount: r.amount,
            description: r.description ?? undefined,
            expenseDate: r.expense_date,
            createdAt: r.created_at,
          }))
        );
        setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [farm, reloadKey]);

  const month = monthKey(new Date());
  const monthExpenses = expenses.filter((e) => monthKey(new Date(e.expenseDate)) === month);

  const totals = React.useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of monthExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total, count: 0 }))
      .sort((a, b) => b.total - a.total);
  }, [monthExpenses]);

  const grandTotal = totals.reduce((sum, x) => sum + x.total, 0);
  const maxTotal = totals[0]?.total ?? 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("dashboard.expenseBreakdown")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("dashboard.expenseBreakdownSub")}
        </p>
      </CardHeader>

      {status === "loading" ? (
        <CardContent className="space-y-3 py-2" role="status">
          <span className="sr-only">{t("dashboard.expensesLoading")}</span>
          <Skeleton className="h-10 w-40" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-2.5 w-full" />
            </div>
          ))}
        </CardContent>
      ) : status === "error" ? (
        <CardContent className="py-2">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t("dashboard.expensesLoading")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We couldn't load your expense summary.
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
      ) : totals.length === 0 ? (
        <CardContent className="py-2">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t("dashboard.expensesEmpty")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("dashboard.expensesEmptyHint")}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link to="/expenses">{t("dashboard.openExpenses")}</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      ) : (
        <CardContent className="space-y-4 py-2">
          {/* Summary metric first, then the detail */}
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t("dashboard.expensesTotal")}
            </p>
            <p className="font-heading text-3xl font-bold tracking-tight text-foreground">
              {formatMoney(grandTotal)}
            </p>
          </div>

          <ul className="space-y-3" aria-label={t("dashboard.expenseBreakdown")}>
            {totals.slice(0, 6).map(({ category, total }) => (
              <li key={category} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-foreground">
                    {t(CATEGORY_LABEL_KEY[category] ?? "expenses.cat.other")}
                  </span>
                  <span className="text-muted-foreground">{formatMoney(total)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="img">
                  <div
                    className={cn("h-full rounded-full", CATEGORY_BAR[category])}
                    style={{ width: `${Math.max(4, (total / maxTotal) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/expenses">
              {t("dashboard.viewAllExpenses")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
