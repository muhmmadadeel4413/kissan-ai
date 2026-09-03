import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  BellOff,
  ListChecks,
  MessageCircle,
  ScanLine,
  type LucideIcon,
} from "lucide-react";
import { useFarm } from "../../context/FarmContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useRecentActivity } from "../../hooks/useRecentActivity";
import type { ActivityItem } from "../../lib/activity-service";
import { cn } from "../../lib/utils";

const ACTIVITY_ICON: Record<ActivityItem["kind"], LucideIcon> = {
  diagnosis: ScanLine,
  action: ListChecks,
  risk: AlertTriangle,
  chat: MessageCircle,
};

/** Severity tone → icon chip + label badge colours (text is never colour-only). */
const TONE_CLASS: Record<ActivityItem["metaTone"], string> = {
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-700 dark:text-red-400",
  neutral: "bg-muted text-muted-foreground",
};

/**
 * Mobile header notification bell. Shows a count badge for high-priority
 * alerts and opens a panel listing the farm's recent activity (real records
 * only). Closes on Escape, outside click, or after navigating.
 */
export function NotificationBell({ className }: { className?: string }) {
  const { t } = usePreferences();
  const navigate = useNavigate();
  const { farm } = useFarm();
  const { items, status } = useRecentActivity(farm?.id);
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const highCount = items.filter((i) => i.metaTone === "danger").length;
  const visible = items.slice(0, 6);

  // Dismiss on outside click + Escape while the panel is open.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Move focus into the panel when it opens.
  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  function go(href: string | null) {
    if (!href) return;
    setOpen(false);
    navigate(href);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("notifications.open")}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors duration-150 hover:bg-muted cursor-pointer"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {highCount > 0 ? (
          <span
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
            aria-label={`${highCount} ${t("notifications.high")}`}
          >
            {highCount > 9 ? "9+" : highCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t("notifications.title")}
          tabIndex={-1}
          className="absolute end-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-pop outline-none"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              {t("notifications.title")}
            </p>
            {highCount > 0 ? (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
                {highCount} {t("notifications.high")}
              </span>
            ) : null}
          </div>

          {status === "loading" ? (
            <div className="space-y-3 p-4" aria-hidden="true">
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <BellOff className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-foreground">
                {t("notifications.none")}
              </p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto p-2">
              {visible.map((item) => {
                const Icon = ACTIVITY_ICON[item.kind];
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => go(item.href)}
                      disabled={!item.href}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition-colors duration-150 cursor-pointer",
                        item.href ? "hover:bg-muted" : "cursor-default"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          TONE_CLASS[item.metaTone]
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {item.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.detail}
                        </span>
                      </span>
                      {item.metaLabel ? (
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            TONE_CLASS[item.metaTone]
                          )}
                        >
                          {item.metaLabel}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
