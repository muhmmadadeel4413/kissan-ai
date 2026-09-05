import * as React from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Wallet, Pencil, Download } from "lucide-react";
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
import { exportExpensesCsv, downloadCsv } from "../lib/export-utils";
import { useFarm } from "../context/FarmContext";
import { useI18n } from "../context/PreferencesContext";
import { supabase } from "../lib/supabase";
import type { Expense, ExpenseCategory } from "../types";
import { cn } from "../lib/utils";

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

const CATEGORIES: ExpenseCategory[] = [
  "seeds",
  "fertilizer",
  "pesticide",
  "labor",
  "irrigation",
  "equipment",
  "fuel",
  "transport",
  "other",
];

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatMoney(amount: number): string {
  return `Rs ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

interface FormState {
  category: ExpenseCategory | "";
  amount: string;
  description: string;
  expenseDate: string;
}

const EMPTY_FORM: FormState = { category: "", amount: "", description: "", expenseDate: "" };

export default function ExpensesPage() {
  const { t } = useI18n();
  const { farm } = useFarm();

  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Expense | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Month filter (defaults to the current month).
  const [month, setMonth] = React.useState(toDateInputValue(new Date()).slice(0, 7));
  const [categoryFilter, setCategoryFilter] = React.useState<ExpenseCategory | "all">("all");

  const load = React.useCallback(async () => {
    if (!farm) return;
    setStatus("loading");
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, farm_id, category, amount, description, expense_date, created_at")
        .eq("farm_id", farm.id)
        .order("expense_date", { ascending: false });
      if (error) throw error;
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
    } catch (err) {
      console.error("expenses-page:", err);
      setLoadError(t("expenses.loadError"));
      setStatus("error");
    }
  }, [farm]);

  React.useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const filtered = React.useMemo(() => {
    return expenses.filter(
      (e) =>
        e.expenseDate.slice(0, 7) === month &&
        (categoryFilter === "all" || e.category === categoryFilter)
    );
  }, [expenses, month, categoryFilter]);

  const totalSpent = React.useMemo(
    () => filtered.reduce((sum, e) => sum + e.amount, 0),
    [filtered]
  );

  const breakdown = React.useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of filtered) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const topCategory = breakdown[0]?.[0] ?? null;
  const maxTotal = breakdown[0]?.[1] ?? 1;

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, expenseDate: toDateInputValue(new Date()) });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setForm({
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description ?? "",
      expenseDate: expense.expenseDate,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!farm) return;

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError(t("expenses.errAmount"));
      return;
    }
    if (!form.expenseDate) {
      setFormError(t("expenses.errDate"));
      return;
    }
    if (!form.category) {
      setFormError("Please select a category.");
      return;
    }

    setSaving(true);
    setFormError(null);
    const payload = {
      farm_id: farm.id,
      category: form.category,
      amount,
      description: form.description.trim() || null,
      expense_date: form.expenseDate,
    };
    try {
      const { error } = editing
        ? await supabase.from("expenses").update(payload).eq("id", editing.id)
        : await supabase.from("expenses").insert(payload);
      if (error) throw error;
      setDialogOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error("expenses-page save:", err);
      setFormError(t("expenses.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(expense: Expense) {
    if (!window.confirm(`Delete "${expense.description || t("expenses.title")}"?`)) return;
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
      if (error) throw error;
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error("expenses-page delete:", err);
    }
  }

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title={t("expenses.title")}
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
        title={t("expenses.title")}
        subtitle={t("expenses.subtitle")}
        action={
          <div className="flex items-center gap-2">
            {expenses.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const csv = exportExpensesCsv(expenses);
                  downloadCsv(csv, `kissan-expenses-${new Date().toISOString().slice(0, 10)}.csv`);
                }}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {t("common.exportCsv")}
              </Button>
            )}
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("expenses.addBtn")}
            </Button>
          </div>
        }
      />

      {/* Summary stats */}
      <section aria-label={t("expenses.summary")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label={t("expenses.totalSpent")}
            value={formatMoney(totalSpent)}
            icon={Wallet}
            iconClassName="bg-success-soft text-success"
          />
          <StatCard
            label={t("expenses.expensesCount")}
            value={filtered.length}
            icon={Wallet}
          />
          <StatCard
            label={t("expenses.topCategory")}
            value={topCategory ? t(CATEGORY_LABEL_KEY[topCategory]) : "—"}
            icon={Wallet}
          />
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="expense-month">{t("expenses.fromDate")}</Label>
          <Input
            id="expense-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expense-category">{t("expenses.category")}</Label>
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as ExpenseCategory | "all")}
          >
            <SelectTrigger id="expense-category" className="w-52">
              <SelectValue placeholder={t("expenses.allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("expenses.allCategories")}</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(CATEGORY_LABEL_KEY[c])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setMonth(toDateInputValue(new Date()).slice(0, 7));
            setCategoryFilter("all");
          }}
        >
          {t("expenses.resetFilters")}
        </Button>
      </section>

      {status === "loading" ? (
        <LoadingState rows={3} title={t("expenses.loadError")} />
      ) : status === "error" ? (
        <ErrorState
          title={t("expenses.loadError")}
          message={loadError ?? undefined}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Breakdown */}
          <section className="space-y-3 lg:col-span-1">
            <SectionHeader title={t("expenses.breakdownTitle")} subtitle={t("expenses.breakdownSub")} />
            {breakdown.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  {t("expenses.emptyDesc")}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="space-y-3 py-5">
                  {breakdown.map(([category, total]) => (
                    <div key={category} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-foreground">
                          {t(CATEGORY_LABEL_KEY[category])}
                        </span>
                        <span className="text-muted-foreground">{formatMoney(total)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(4, (total / maxTotal) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>

          {/* Expense list */}
          <section className="space-y-3 lg:col-span-2">
            <SectionHeader title={t("expenses.listTitle")} subtitle={t("expenses.listSub")} />
            {filtered.length === 0 ? (
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
              <div className="space-y-2.5">
                {filtered.map((expense) => (
                  <Card key={expense.id}>
                    <CardContent className="flex items-center gap-3 py-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                        <Wallet className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {t(CATEGORY_LABEL_KEY[expense.category])}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(expense.expenseDate + "T00:00:00").toLocaleDateString(
                              undefined,
                              { day: "numeric", month: "short", year: "numeric" }
                            )}
                          </span>
                        </div>
                        {expense.description ? (
                          <p className="mt-1 truncate text-sm font-medium text-foreground">
                            {expense.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {formatMoney(expense.amount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(expense)}
                          aria-label={t("expenses.editBtn")}
                          className={cn("cursor-pointer")}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void handleDelete(expense)}
                          aria-label={t("expenses.deleteBtn")}
                          className="cursor-pointer text-danger hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("expenses.editTitle") : t("expenses.addTitle")}</DialogTitle>
            <DialogDescription>{t("expenses.formSubtitle")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="expense-category-field">{t("expenses.category")} *</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as ExpenseCategory }))}
              >
                <SelectTrigger id="expense-category-field">
                  <SelectValue placeholder={t("expenses.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(CATEGORY_LABEL_KEY[c])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-amount-field">{t("expenses.amount")} *</Label>
              <Input
                id="expense-amount-field"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder={t("expenses.amountPlaceholder")}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-date-field">{t("expenses.date")} *</Label>
              <Input
                id="expense-date-field"
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-desc-field">{t("expenses.description")}</Label>
              <Textarea
                id="expense-desc-field"
                placeholder={t("expenses.descriptionPlaceholder")}
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
                  ? t("expenses.saving")
                  : editing
                    ? t("expenses.updateBtn")
                    : t("expenses.saveBtn")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
