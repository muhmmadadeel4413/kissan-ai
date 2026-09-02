import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  Stethoscope,
  Wallet,
  CalendarDays,
  ShieldAlert,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useFarm } from "../../context/FarmContext";
import { usePreferences } from "../../context/PreferencesContext";
import { globalSearch, type SearchResult } from "../../lib/search-service";

/* ------------------------------------------------------------------ */
/* Icons per result kind                                                */
/* ------------------------------------------------------------------ */

const KIND_META: Record<
  SearchResult["kind"],
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  diagnosis: { icon: Stethoscope, label: "Diagnosis" },
  expense: { icon: Wallet, label: "Expense" },
  event: { icon: CalendarDays, label: "Event" },
  risk: { icon: ShieldAlert, label: "Risk" },
};

/* ------------------------------------------------------------------ */
/* Global Search Dialog                                                 */
/* ------------------------------------------------------------------ */

/**
 * Full-screen search overlay. Opens via the search icon in the header / sidebar
 * or with Ctrl+K / ⌘K. Searches across diagnoses, expenses, farm events, and
 * risk alerts using the global search service.
 */
export function GlobalSearchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  const { farm } = useFarm();
  const navigate = useNavigate();

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounce search by 300ms
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSearched(false);
      return;
    }
    // Auto-focus input when dialog opens
    const id = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(id);
  }, [open]);

  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim() || !farm) {
      setResults([]);
      setSearched(false);
      return;
    }

    setSearching(true);
    timerRef.current = setTimeout(() => {
      globalSearch(farm.id, query)
        .then((r) => {
          setResults(r);
          setSearched(true);
        })
        .catch(() => {
          setResults([]);
          setSearched(true);
        })
        .finally(() => setSearching(false));
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, farm]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleResultClick(href: string) {
    onClose();
    navigate(href);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm cursor-default"
        onClick={onClose}
        aria-label={t("search.close")}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-pop animate-slide-in">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              aria-label={t("search.clear")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {searching ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("search.searching")}
            </div>
          ) : searched && results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("search.noResults")}
            </div>
          ) : results.length > 0 ? (
            <ul className="space-y-0.5">
              {results.map((r, i) => {
                const meta = KIND_META[r.kind];
                const Icon = meta.icon;
                return (
                  <li key={`${r.kind}-${i}`}>
                    <button
                      type="button"
                      onClick={() => r.href && handleResultClick(r.href)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted cursor-pointer"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {r.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.subtitle}
                        </p>
                      </div>
                      {r.href ? (
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              {t("search.hint")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Search trigger button                                                */
/* ------------------------------------------------------------------ */

/** Compact search trigger button used in the sidebar and mobile header. */
export function SearchTrigger({ onClick }: { onClick: () => void }) {
  const { t } = usePreferences();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
      aria-label={t("search.open")}
    >
      <Search className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">{t("search.open")}</span>
      <kbd className="hidden rounded border border-border bg-muted px-1 text-[10px] font-medium text-muted-foreground lg:inline">
        ⌘K
      </kbd>
    </button>
  );
}
