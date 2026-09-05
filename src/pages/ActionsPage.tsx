import { Info, ListChecks } from "lucide-react";
import { PageHeader } from "../components/layout/page-header";
import { TodayActionsCard } from "../components/actions/today-actions-card";
import { useFarm } from "../context/FarmContext";
import { useI18n } from "../context/PreferencesContext";

/**
 * Today's Actions page (Prompt 10).
 *
 * Shows the full "What Should I Do Today?" Decision Engine feed — the same
 * persisted actions shown on the Dashboard. Completion and refresh live here
 * too. No fake or hardcoded action cards are ever rendered.
 */
export default function ActionsPage() {
  const { farm } = useFarm();
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("actions.pageTitle")}
        subtitle={
          farm
            ? t("actions.subtitleWithCrop", { crop: farm.currentCrop })
            : t("actions.subtitleDefault")
        }
      />

      {/* Real Decision Engine feed (shared with the Dashboard) */}
      <TodayActionsCard />

      <div className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          {t("actions.infoText")}
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          {t("actions.completedInfoText")}
        </p>
      </div>
    </div>
  );
}