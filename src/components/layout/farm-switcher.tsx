import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, Plus, Sprout } from "lucide-react";
import { useFarm } from "../../context/FarmContext";
import { useI18n } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";

/**
 * Compact farm switcher dropdown for the global header.
 *
 * Shows the active farm name with a chevron; clicking opens a dropdown
 * listing all farms with a check-mark on the active one, plus a
 * "+ Create New Farm" action at the bottom.
 */
export function FarmSwitcher({ className }: { className?: string }) {
  const { farm, farms, switchFarm } = useFarm();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  // When there are no farms at all, don't render anything.
  if (farms.length === 0) return null;

  const activeName = farm?.farmName || farm?.currentCrop || t("app.nav.noFarm");

  return (
    <div className={cn("relative", className)} ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-primary/40 cursor-pointer"
      >
        <Sprout className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="max-w-[10rem] truncate">{activeName}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t("farmSwitcher.selectFarmAria")}
          className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-background p-1.5 shadow-pop animate-slide-in"
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("farmSwitcher.myFarms") || "My Farms"}
          </p>
          {farms.map((f) => {
            const isActive = f.id === farm?.id;
            const displayName = f.farmName || f.currentCrop || t("farmSwitcher.untitledFarm");
            const subtitle = [f.landArea, f.currentCrop, f.location].filter(Boolean).slice(0, 2).join(" • ");
            return (
              <button
                key={f.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={async () => {
                  await switchFarm(f.id);
                  close();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer",
                  isActive
                    ? "bg-primary-soft text-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Sprout className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{displayName}</span>
                  {subtitle ? (
                    <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
                  ) : null}
                </span>
                {isActive ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}

          <div className="my-1 h-px bg-border" />

          <button
            type="button"
            onClick={() => {
              close();
              navigate("/farm-setup?create=new");
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft cursor-pointer"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("farmSwitcher.createNew") || "Create New Farm"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
