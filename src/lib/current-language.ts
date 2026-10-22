import { DEFAULT_LANGUAGE, translate, type Language } from "./i18n";

/**
 * Synchronous read of the persisted UI language.
 *
 * React contexts can only call `useI18n()` inside components. A few error
 * paths live in module-level helpers and event handlers (e.g. the auth error
 * mapper) that still must produce a message in the farmer's language, so they
 * read the same localStorage key that `PreferencesContext` writes.
 *
 * The storage key is intentionally duplicated here rather than imported to
 * avoid a circular dependency between this module and the context.
 */
const LANGUAGE_KEY = "kissanai.language.v1";

export function currentLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    return stored === "ur" || stored === "en" ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/** Translate a key in the currently active UI language (non-React modules). */
export function tNow(key: string, vars?: Record<string, string | number>): string {
  return translate(currentLanguage(), key, vars);
}
