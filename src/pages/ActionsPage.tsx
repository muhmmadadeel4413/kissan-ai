import { Info, ListChecks } from "lucide-react";
import { PageHeader } from "../components/layout/page-header";
import { TodayActionsCard } from "../components/actions/today-actions-card";
import { useFarm } from "../context/FarmContext";

/**
 * Today's Actions page (Prompt 10).
 *
 * Shows the full "What Should I Do Today?" Decision Engine feed — the same
 * persisted actions shown on the Dashboard. Completion and refresh live here
 * too. No fake or hardcoded action cards are ever rendered.
 */
export default function ActionsPage() {
  const { farm } = useFarm();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today's Actions"
        subtitle={
          farm
            ? `What should you do on your ${farm.currentCrop} farm today?`
            : "What should I do today?"
        }
      />

      {/* Real Decision Engine feed (shared with the Dashboard) */}
      <TodayActionsCard />

      <div className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          Up to 4 top-priority actions are generated from your real farm data —
          always with a clear reason and the best time to act. Actions stay
          saved until you mark them done, and you can refresh them any time.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          Completed actions are kept for your records. Refresh generates a
          fresh set from your latest farm, weather, crop-health, and risk
          information.
        </p>
      </div>
    </div>
  );
}