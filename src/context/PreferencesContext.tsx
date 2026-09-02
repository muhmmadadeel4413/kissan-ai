import * as React from "react";
import { Language, translate, DEFAULT_LANGUAGE } from "../lib/i18n";

/**
 * Global user preferences: UI language (English / Urdu) and color theme
 * (Light / Dark). Both are persisted in localStorage and are fully
 * independent — changing one never resets the other, so all four
 * combinations (EN/UR × Light/Dark) work.
 *
 * The provider keeps <html> in sync:
 *   - `dir="rtl"` + `lang="ur"` when Urdu is selected (mirrors the layout)
 *   - `class="dark"` when dark theme is selected (drives Tailwind's dark
 *     variant and the CSS-variable palette overrides in index.css)
 */

type Theme = "light" | "dark";

interface PreferencesContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Translate a key into the active language, with optional {placeholder} vars. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const PreferencesContext = React.createContext<PreferencesContextValue | null>(
  null
);

const LANGUAGE_KEY = "kissanai.language.v1";
const THEME_KEY = "kissanai.theme.v1";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode etc.) — preferences still work.
  }
}

function initialLanguage(): Language {
  const stored = readStorage(LANGUAGE_KEY);
  return stored === "ur" || stored === "en" ? stored : DEFAULT_LANGUAGE;
}

function initialTheme(): Theme {
  const stored = readStorage(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  // No stored preference → respect the operating system.
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

function applyDomPreferences(language: Language, theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = language;
  root.dir = language === "ur" ? "rtl" : "ltr";
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>(initialLanguage);
  const [theme, setThemeState] = React.useState<Theme>(initialTheme);

  // Keep <html> dir/lang/theme in sync with state, on mount and on change.
  React.useEffect(() => {
    applyDomPreferences(language, theme);
  }, [language, theme]);

  const setLanguage = React.useCallback((lang: Language) => {
    setLanguageState(lang);
    writeStorage(LANGUAGE_KEY, lang);
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    writeStorage(THEME_KEY, next);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      writeStorage(THEME_KEY, next);
      return next;
    });
  }, []);

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(language, key, vars),
    [language]
  );

  const value = React.useMemo(
    () => ({ language, setLanguage, theme, setTheme, toggleTheme, t }),
    [language, setLanguage, theme, setTheme, toggleTheme, t]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = React.useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
}

/** Convenience hook for components that only need translations. */
export function useI18n(): { t: (key: string) => string; language: Language } {
  const { t, language } = usePreferences();
  return { t, language };
}