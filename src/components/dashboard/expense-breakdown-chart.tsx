import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Link } from "react-router-dom";
import { Wallet, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { EmptyState } from "../layout/empty-state";
import { LoadingState } from "../layout/loading-state";
import { useFarm } from "../../context/FarmContext";
import { usePreferences } from "../../context/PreferencesContext";
import {
  fetchExpenses,
  computeCategoryTotals,
  computeGrandTotal,
} from "../../lib/expense-service";
import type { ExpenseCategoryTotal } from "../../types";

/* ------------------------------------------------------------------ */
/* Color palette for chart slices                                       */
/* ------------------------------------------------------------------ */

const COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#64748b", // slate
  "#ec4899", // pink
];

/* ------------------------------------------------------------------ */
/* Expense Breakdown Chart                                              */
/* ------------------------------------------------------------------ */

/**
 * Dashboard widget showing a pie chart of expense category totals. Pulls
 * real data from the `expenses` table via the expense service. Degrades
 * gracefully when no expenses exist.
 */
export function ExpenseBreakdownChart() {
  const { t } = usePreferences();
  const { farm } = useFarm();
  const [totals, setTotals] = React.useState<ExpenseCategoryTotal[]>([]);
  const [grandTotal, setGrandTotal] = React.useState(0);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    if (!farm) return;
    let cancelled = false;
    setStatus("loading");

    // Fetch current month expenses
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    fetchExpenses(farm.id, { startDate, endDate })
      .then((rows) => {
        if (!cancelled) {
          const catTotals = computeCategoryTotals(rows);
          setTotals(catTotals);
          setGrandTotal(computeGrandTotal(rows));
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTotals([]);
          setGrandTotal(0);
          setStatus("error");
        }
      });

    return () => { cancelled = true; };
  }, [farm?.id]);

  if (status === "loading") {
    return <LoadingState rows={3} title={t("dashboard.expensesLoading")} />;
  }

  if (status === "error" || totals.length === 0) {
    return (
      <EmptyState
        icon={<Wallet className="h-5 w-5" />}
        title={t("dashboard.expensesEmpty")}
        description={t("dashboard.expensesEmptyHint")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/expenses">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              {t("dashboard.openExpenses")}
            </Link>
          </Button>
        }
      />
    );
  }

  const chartData = totals.map((t, i) => ({
    name: t.category,
    value: t.total,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-4">
      {/* Total */}
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {t("dashboard.expensesTotal")}
        </p>
        <p className="font-heading text-2xl font-bold text-foreground">
          {formatCurrency(grandTotal)}
        </p>
      </div>

      {/* Pie chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{
                borderRadius: "0.75rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                fontSize: "0.75rem",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {chartData.slice(0, 5).map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>

      <Button asChild variant="ghost" size="sm" className="w-full">
        <Link to="/expenses">
          {t("dashboard.viewAllExpenses")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return `Rs ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
