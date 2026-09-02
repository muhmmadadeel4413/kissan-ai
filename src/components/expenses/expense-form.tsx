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
import type { Expense, ExpenseCategory, ExpenseInput } from "../../types";

/** All 9 expense categories (matches the DB CHECK constraint). */
const EXPENSE_CATEGORIES: ExpenseCategory[] = [
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Add / edit expense dialog. When `expense` is provided the form is
 * pre-filled for editing; otherwise it creates a new record.
 */
export function ExpenseForm({
  open,
  onOpenChange,
  farmId,
  expense,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  /** Existing expense to edit; null for create. */
  expense?: Expense | null;
  onSave: (input: ExpenseInput) => Promise<void>;
}) {
  const { t } = usePreferences();
  const isEdit = Boolean(expense);

  const [category, setCategory] = React.useState<ExpenseCategory>(
    expense?.category ?? "seeds"
  );
  const [amount, setAmount] = React.useState(
    expense?.amount != null ? String(expense.amount) : ""
  );
  const [description, setDescription] = React.useState(expense?.description ?? "");
  const [date, setDate] = React.useState(expense?.expenseDate ?? todayISO());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset form when the dialog opens with a different expense (or no expense).
  React.useEffect(() => {
    if (open) {
      setCategory(expense?.category ?? "seeds");
      setAmount(expense?.amount != null ? String(expense.amount) : "");
      setDescription(expense?.description ?? "");
      setDate(expense?.expenseDate ?? todayISO());
      setError(null);
    }
  }, [open, expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t("expenses.errAmount"));
      return;
    }
    if (!date) {
      setError(t("expenses.errDate"));
      return;
    }

    setSaving(true);
    try {
      await onSave({
        farmId,
        category,
        amount: parsedAmount,
        description: description.trim() || undefined,
        expenseDate: date,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("expenses.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("expenses.editTitle") : t("expenses.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("expenses.formSubtitle")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="exp-category">{t("expenses.category")}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger id="exp-category">
                <SelectValue placeholder={t("expenses.selectCategory")} />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`expenses.cat.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="exp-amount">{t("expenses.amount")}</Label>
            <Input
              id="exp-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder={t("expenses.amountPlaceholder")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="exp-date">{t("expenses.date")}</Label>
            <Input
              id="exp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Description (optional) */}
          <div className="space-y-2">
            <Label htmlFor="exp-desc">
              {t("expenses.description")}{" "}
              <span className="text-muted-foreground">({t("common.optional")})</span>
            </Label>
            <Textarea
              id="exp-desc"
              placeholder={t("expenses.descriptionPlaceholder")}
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
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("expenses.saving")}
                </>
              ) : (
                t(isEdit ? "expenses.updateBtn" : "expenses.saveBtn")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
