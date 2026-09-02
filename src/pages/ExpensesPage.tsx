import * as React from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Wallet,
  Sprout,
  TrendingDown,
  CalendarDays,
  ChevronDown,
  ChevronUp,
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
import { ExpenseForm } from "../components/expenses/expense-form";
import { useFarm } from "../context/FarmContext";
import { usePreferences } from "../context/PreferencesContext";
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  computeCategoryTotals,
  computeGrandTotal,
} from "../lib/expense-service";
import type { Expense, ExpenseCategory, ExpenseInput } from "../types";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Category meta (icons + color variants)                              */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<
  ExpenseCategory,
  { icon: React.ComponentType<{ className?: string }>; variant: "default" | "success" | "warning" | "danger" | "neutral" }
> = {
  seeds: { icon: Sprout, variant: "success" },
  fertilizer: { icon: TrendingDown, variant: "default" },
  pesticide: { icon: Sprout, variant: "warning" },
  labor: { icon: Wallet, variant: "neutral" },
  irrigation: { icon: Wallet, variant: "default" },
  equipment: { icon: Wallet, variant: "neutral" },
  fuel: { icon: Wallet, variant: "danger" },
  transport: { icon: Wallet, variant: "neutral" },
  other: { icon: Wallet, variant: "neutral" },
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Default date range: current month. */
function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ExpensesPage() {
  const { farm } = useFarm();
  const { t } = usePreferences();

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<Sprout className="h-6 w-6" />}
          title={t("dashboard.setupTitle")}
          description={t("dashboard.setupDesc")}
          action={
            <Button asChild size="lg">
              <Link to="/farm-setup">{t("farmSetup.createBtn")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const defaultRange = currentMonthRange();

  /* ---- State ---------------------------------------------------- */
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);

  // Filters
  const [startDate, setStartDate] = React.useState(defaultRange.start);
  const [endDate, setEndDate] = React.useState(defaultRange.end);
  const [filterCategory, setFilterCategory] = React.useState<"all" | ExpenseCategory>("all");

  // Form dialog
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState<Expense | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  /* ---- Fetch ---------------------------------------------------- */
  React.useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetchExpenses(farm.id, {
      startDate,
      endDate,
      category: filterCategory === "all" ? undefined : filterCategory,
    })
      .then((rows) => {
        if (!cancelled) {
          setExpenses(rows);
          setStatus("ready");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setExpenses([]);
          setError(err instanceof Error ? err.message : t("expenses.loadError"));
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [farm.id, startDate, endDate, filterCategory, reload]);

  /* ---- Handlers ------------------------------------------------- */
  const handleSave = async (input: ExpenseInput) => {
    if (editingExpense) {
      await updateExpense(editingExpense.id, {
        category: input.category,
        amount: input.amount,
        description: input.description,
        expenseDate: input.expenseDate,
      });
    } else {
      await createExpense(input);
    }
    setReload((k) => k + 1);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // Error already shown via friendlyError in service
    } finally {
      setDeletingId(null);
    }
  };

  const openAdd = () => {
    setEditingExpense(null);
    setFormOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormOpen(true);
  };

  /* ---- Derived data --------------------------------------------- */
  const totals = computeCategoryTotals(expenses);
  const grandTotal = computeGrandTotal(expenses);
  const topCategory = totals[0];

  /* ---- Render --------------------------------------------------- */
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("expenses.title")}
        subtitle={t("expenses.subtitle")}
        action={
          <Button size="lg" onClick={openAdd}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("expenses.addBtn")}
          </Button>
        }
      />

      {/* Date range + category filters */}
      <section className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="exp-start">
            {t("expenses.fromDate")}
          </label>
          <input
            id="exp-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground shadow-soft focus-visible:outline-2 focus-visible:outline-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="exp-end">
            {t("expenses.toDate")}
          </label>
          <input
            id="exp-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground shadow-soft focus-visible:outline-2 focus-visible:outline-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("expenses.category")}
          </label>
          <Select
            value={filterCategory}
            onValueChange={(v) => setFilterCategory(v as "all" | ExpenseCategory)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("expenses.allCategories")}</SelectItem>
              {Object.keys(CATEGORY_META).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {t(`expenses.cat.${cat}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const range = currentMonthRange();
            setStartDate(range.start);
            setEndDate(range.end);
            setFilterCategory("all");
          }}
        >
          {t("expenses.resetFilters")}
        </Button>
      </section>

      {/* Summary stat cards */}
      <section aria-label={t("expenses.summary")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label={t("expenses.totalSpent")}
            value={formatCurrency(grandTotal)}
            hint={`${expenses.length} ${t("expenses.expenseCount")}`}
            icon={Wallet}
          />
          <StatCard
            label={t("expenses.topCategory")}
            value={topCategory ? t(`expenses.cat.${topCategory.category}`) : "—"}
            hint={topCategory ? formatCurrency(topCategory.total) : ""}
            icon={CATEGORY_META[topCategory?.category ?? "other"].icon}
          />
          <StatCard
            label={t("expenses.categoriesUsed")}
            value={totals.length}
            hint={t("expenses.categoriesHint")}
            icon={CalendarDays}
          />
        </div>
      </section>

      {/* Category breakdown */}
      {totals.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader
            title={t("expenses.breakdownTitle")}
            subtitle={t("expenses.breakdownSub")}
          />
          <Card>
            <CardContent className="space-y-3 py-5">
              {totals.map((t2) => {
                const meta = CATEGORY_META[t2.category];
                const Icon = meta.icon;
                const pct = grandTotal > 0 ? (t2.total / grandTotal) * 100 : 0;
                return (
                  <div key={t2.category} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          meta.variant === "default" && "bg-primary-soft text-primary",
                          meta.variant === "success" && "bg-success/10 text-success",
                          meta.variant === "warning" && "bg-warning/10 text-warning",
                          meta.variant === "danger" && "bg-danger-soft text-danger",
                          meta.variant === "neutral" && "bg-muted text-muted-foreground",
                        )}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {t(`expenses.cat.${t2.category}`)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t2.count} {t2.count === 1 ? t("expenses.expenseCount") : t("expenses.expensesCount")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(t2.total)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pct.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          meta.variant === "default" && "bg-primary",
                          meta.variant === "success" && "bg-success",
                          meta.variant === "warning" && "bg-warning",
                          meta.variant === "danger" && "bg-danger",
                          meta.variant === "neutral" && "bg-muted-foreground/40",
                        )}
                        style={{ width: `${Math.min(100, pct)}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Expense list */}
      <section className="space-y-3">
        <SectionHeader
          title={t("expenses.listTitle")}
          subtitle={t("expenses.listSub")}
        />

        {status === "loading" ? (
          <LoadingState rows={3} title={t("common.loading")} />
        ) : status === "error" ? (
          <ErrorState
            title={t("expenses.loadError")}
            message={error ?? t("common.error")}
            onRetry={() => setReload((k) => k + 1)}
          />
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title={t("expenses.emptyTitle")}
            description={t("expenses.emptyDesc")}
            action={
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("expenses.addBtn")}
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {expenses.map((exp) => {
              const meta = CATEGORY_META[exp.category];
              const Icon = meta.icon;
              const isExpanded = expandedId === exp.id;
              const isDeleting = deletingId === exp.id;

              return (
                <Card key={exp.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                      className="flex w-full items-center gap-3 p-4 text-left cursor-pointer transition-colors hover:bg-muted/40"
                      aria-expanded={isExpanded}
                    >
                      <span className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        meta.variant === "default" && "bg-primary-soft text-primary",
                        meta.variant === "success" && "bg-success/10 text-success",
                        meta.variant === "warning" && "bg-warning/10 text-warning",
                        meta.variant === "danger" && "bg-danger-soft text-danger",
                        meta.variant === "neutral" && "bg-muted text-muted-foreground",
                      )}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {t(`expenses.cat.${exp.category}`)}
                          </p>
                          <Badge variant={meta.variant}>
                            {formatCurrency(exp.amount)}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {formatDate(exp.expenseDate)}
                          {exp.description ? ` · ${exp.description}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="flex items-center gap-2 border-t border-border bg-muted/20 px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(exp)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("expenses.editBtn")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(exp.id)}
                          disabled={isDeleting}
                          className="text-danger hover:bg-danger-soft"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {t("expenses.deleteBtn")}
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Add / Edit dialog */}
      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        farmId={farm.id}
        expense={editingExpense}
        onSave={handleSave}
      />
    </div>
  );
}
