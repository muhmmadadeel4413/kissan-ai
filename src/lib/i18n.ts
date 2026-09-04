/**
 * Thin re-export of the i18n feature modules under src/i18n/.
 *
 * Existing imports (`from "../lib/i18n"`, etc.) continue to work so no
 * call-site changes are required. To add or edit translations, edit the
 * feature module directly:
 *   - src/i18n/landing.ts   — marketing pages (brand, hero, FAQ, footer…)
 *   - src/i18n/app.ts       — app shell (nav, common, page titles, dashboard…)
 *   - src/i18n/farm.ts      — farm profile
 *   - src/i18n/features.ts  — crop recommendation, irrigation, expenses,
 *                             calendar, settings
 *   - src/i18n/auth.ts      — login, signup, reset password
 */
export {
  type Language,
  LANGUAGE_OPTIONS,
  translations,
  translate,
  DEFAULT_LANGUAGE,
} from "../i18n";
