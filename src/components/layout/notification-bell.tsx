import * as React from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useFarm } from "../../context/FarmContext";
import { usePreferences } from "../../context/PreferencesContext";
import { fetchActiveRisks } from "../../lib/risk-service";

/**
 * Notification bell showing a badge when high-priority risk alerts exist.
 * Links to the risks page for full details.
 */
export function NotificationBell() {
  const { t } = usePreferences();
  const { farm } = useFarm();
  const [highCount, setHighCount] = React.useState(0);

  React.useEffect(() => {
    if (!farm) return;
    let cancelled = false;
    fetchActiveRisks(farm.id)
      .then((alerts) => {
        if (!cancelled) {
          setHighCount(alerts.filter((a) => a.level === "high").length);
        }
      })
      .catch(() => {
        // Graceful degradation — no badge on error
      });
    return () => {
      cancelled = true;
    };
  }, [farm?.id]);

  return (
    <Link
      to="/risks"
      className="relative flex h-10 w-10 items-center justify-center rounded-xl text-foreground hover:bg-muted transition-colors"
      aria-label={
        highCount > 0
          ? t("notifications.hasHigh", { n: highCount })
          : t("notifications.none")
      }
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {highCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 min-w-[18px] items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-background">
          {highCount}
        </span>
      ) : null}
    </Link>
  );
}
