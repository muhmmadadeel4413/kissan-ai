import { useFarm } from "../../context/FarmContext";
import { useI18n } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";

/**
 * Lightweight user identity badge — shows avatar initial + farmer name.
 *
 * Uses real data from FarmContext; renders nothing meaningful when no farm
 * is loaded. Designed for page headers, not as a replacement for the global
 * profile dropdown.
 */
export function UserIdentity({ className }: { className?: string }) {
  const { farm } = useFarm();
  const { t } = useI18n();

  const name = farm ? farm.farmerName.trim() : "";
  const initial = name.charAt(0).toUpperCase() || "?";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary ring-1 ring-inset ring-primary/15">
        {initial}
      </span>
      <span className="max-w-[10rem] truncate text-sm font-medium text-foreground">
        {name || t("common.guest")}
      </span>
    </div>
  );
}
