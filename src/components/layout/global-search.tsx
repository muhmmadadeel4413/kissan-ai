import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CornerDownLeft,
  ListChecks,
  MessageCircle,
  ScanLine,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useFarm } from "../../context/FarmContext";
import { useI18n } from "../../context/PreferencesContext";
import { useRecentActivity } from "../../hooks/useRecentActivity";
import type { ActivityItem } from "../../lib/activity-service";
import { cn } from "../../lib/utils";
import { primaryNav } from "./nav-items";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";

/** Icons mapped to each activity kind (kept in sync with activity-service). */
const ACTIVITY_ICON: Record<ActivityItem["kind"], LucideIcon> = {
  diagnosis: ScanLine,
  action: ListChecks,
  risk: AlertTriangle,
  chat: MessageCircle,
};

interface SearchResult {
  id: string;
  label: string;
  hint: string;
  href: string | null;
  icon: LucideIcon;
  tone?: ActivityItem["metaTone"];
}

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/** Desktop sidebar search box that opens the global search dialog. */
export function SearchTrigger({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent px-3 py-2.5 text-sm text-sidebar-muted transition-colors duration-150 hover:bg-[#334530] hover:text-sidebar-foreground cursor-pointer"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-start">{t("search.open")}</span>
      <kbd className="hidden rounded-md border border-sidebar-border bg-sidebar px-1.5 py-0.5 font-sans text-[10px] font-medium text-sidebar-muted sm:inline-block">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

/**
 * Command-palette style search. Searches across navigation destinations and
 * the farm's recent activity, with full keyboard support (↑/↓ to move, Enter
 * to open, Esc to close via the dialog).
 */
export function GlobalSearchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { farm } = useFarm();
  const activity = useRecentActivity(farm?.id);
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounce query input by 250ms to avoid filtering on every keystroke.
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  // Reset + focus the input each time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const results = React.useMemo<SearchResult[]>(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const nav: SearchResult[] = primaryNav.map((item) => ({
      id: `nav:${item.to}`,
      label: t(item.labelKey),
      hint: item.to,
      href: item.to,
      icon: item.icon,
    }));
    const act: SearchResult[] = activity.items
      .filter((i) => i.href)
      .map((i) => ({
        id: i.key,
        label: i.title,
        hint: i.detail,
        href: i.href,
        icon: ACTIVITY_ICON[i.kind],
        tone: i.metaTone,
      }));
    const all = [...nav, ...act];
    if (!q) return all.slice(0, 12);
    return all
      .filter((r) => `${r.label} ${r.hint}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [debouncedQuery, t, activity.items]);

  // Keep the highlighted row valid when the list changes.
  React.useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery, results.length]);

  function openResult(result: SearchResult) {
    if (!result.href) return;
    onClose();
    navigate(result.href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0
      );
    } else if (e.key === "Enter") {
      const current = results[activeIndex];
      if (current) openResult(current);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">{t("search.open")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("search.hint")}
        </DialogDescription>

        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Search
              className="h-5 w-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded
              aria-autocomplete="list"
              aria-controls="global-search-results"
              aria-activedescendant={
                results[activeIndex]
                  ? `search-result-${activeIndex}`
                  : undefined
              }
              aria-label={t("search.open")}
              placeholder={t("search.placeholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-10 w-full bg-transparent pr-12 text-base text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        <ul
          id="global-search-results"
          role="listbox"
          aria-label={t("search.open")}
          aria-live="polite"
          aria-atomic="true"
          className="max-h-80 overflow-y-auto p-2"
        >
          {results.length === 0 ? (
            <li className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                {t("search.noResults")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("search.hint")}
              </p>
            </li>
          ) : (
            results.map((result, i) => {
              const active = i === activeIndex;
              const Icon = result.icon;
              return (
                <li
                  key={result.id}
                  id={`search-result-${i}`}
                  role="option"
                  aria-selected={active}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => openResult(result)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors duration-150 cursor-pointer",
                      active && "bg-primary-soft"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {result.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {result.hint}
                      </span>
                    </span>
                    {result.tone === "danger" ? (
                      <span className="flex h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                    ) : null}
                    <CornerDownLeft
                      className={cn(
                        "h-4 w-4 shrink-0 transition-opacity",
                        active ? "opacity-100" : "opacity-0"
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-sans">↑↓</kbd>
            {t("search.navigate")}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-sans">↵</kbd>
            {t("search.open")}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-sans">esc</kbd>
            {t("common.cancel")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
