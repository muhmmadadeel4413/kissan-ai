import { Moon, Sun } from "lucide-react";
import { LANGUAGE_OPTIONS, Language } from "../../lib/i18n";
import { usePreferences } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";

/**
 * Accessible, keyboard-operable preference controls.
 *
 * `LanguageToggle` is a labelled segmented control (radiogroup semantics) with
 * visible focus + selection states. `ThemeToggle` is a labelled switch-style
 * button with `aria-pressed` reflecting the active theme.
 */

export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage, t } = usePreferences();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        id="lang-label"
        className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {t("common.language")}
      </span>
      <div
        role="radiogroup"
        aria-labelledby="lang-label"
        className="flex items-center rounded-xl border border-border bg-background p-0.5"
      >
        {LANGUAGE_OPTIONS.map((opt) => {
          const selected = language === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setLanguage(opt.value as Language)}
              className={cn(
                "flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, t } = usePreferences();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label={dark ? t("common.light") : t("common.dark")}
      title={dark ? t("common.light") : t("common.dark")}
      className={cn(
        "flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted cursor-pointer",
        className
      )}
    >
      {dark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
      <span>{dark ? t("common.light") : t("common.dark")}</span>
    </button>
  );
}