/**
 * Centralized i18n for Kissan AI.
 *
 * Two languages: English (`en`, default) and Urdu (`ur`, RTL).
 * Dictionaries are split into feature modules (landing, app, farm, features,
 * auth) and composed here. Keys not found in the active language fall back
 * to English, so partial translations never break the UI.
 */

import { enLanding, urLanding } from "./landing";
import { enApp, urApp } from "./app";
import { enFarm, urFarm } from "./farm";
import { enFeatures, urFeatures } from "./features";
import { enAuth, urAuth } from "./auth";

export type Language = "en" | "ur";

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ur", label: "اردو" },
];

type Dict = Record<string, string>;

const en: Dict = {
  ...enLanding,
  ...enApp,
  ...enFarm,
  ...enFeatures,
  ...enAuth,
};

const ur: Dict = {
  ...urLanding,
  ...urApp,
  ...urFarm,
  ...urFeatures,
  ...urAuth,
};

export const translations: Record<Language, Dict> = { en, ur };

/** Translate a key into the active language, falling back to English. */
export function translate(
  lang: Language,
  key: string,
  vars?: Record<string, string | number>
): string {
  let text = translations[lang][key] ?? translations.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/** Default language. The Preferences provider persists the user's choice. */
export const DEFAULT_LANGUAGE: Language = "en";
