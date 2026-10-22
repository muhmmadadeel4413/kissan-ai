import type { Language } from "./i18n";

/**
 * Locale-aware formatting helpers.
 *
 * Bug this fixes: every date/number in the app used
 * `toLocaleDateString(undefined, …)`, which resolves to the *browser's*
 * locale — not the app's UI language. A farmer who picks Urdu therefore saw
 * "Oct 22, 07:09 AM" sitting inside an otherwise Urdu card.
 *
 * Every user-visible date, time, number and currency must go through these
 * helpers so the output language always matches the selected UI language.
 */

/**
 * BCP-47 tags used for formatting.
 *
 * `-u-nu-latn` pins Latin digits (0-9). Urdu *can* be written with
 * Arabic-Indic digits (۰-۹) but Latin digits are the norm in Pakistani
 * farm/tech UIs and stay legible next to English crop and brand names.
 */
const LOCALE: Record<Language, string> = {
  en: "en-PK",
  ur: "ur-PK-u-nu-latn",
};

/** Resolve the Intl locale for a UI language. */
export function intlLocale(language: Language): string {
  return LOCALE[language] ?? LOCALE.en;
}

type DateInput = Date | string | number | null | undefined;

/** Coerce a loose date value into a valid Date, or null. */
function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date. Defaults to a short, farmer-friendly form ("22 اکتوبر").
 * Returns "" for invalid/missing input rather than "Invalid Date".
 */
export function formatDate(
  value: DateInput,
  language: Language,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
): string {
  const d = toDate(value);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat(intlLocale(language), options).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Format a date + time, e.g. "22 اکتوبر، 07:09". */
export function formatDateTime(
  value: DateInput,
  language: Language,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  return formatDate(value, language, options);
}

/** Format a time of day only, e.g. "07:09". */
export function formatTime(
  value: DateInput,
  language: Language,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
): string {
  const d = toDate(value);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat(intlLocale(language), options).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

/** Weekday name ("جمعرات" / "Thu"). */
export function formatWeekday(value: DateInput, language: Language): string {
  return formatDate(value, language, { weekday: "short" });
}

/** Month + year ("اکتوبر 2026"). */
export function formatMonthYear(value: DateInput, language: Language): string {
  return formatDate(value, language, { month: "long", year: "numeric" });
}

/** Thousands-separated number using the UI language's digit conventions. */
export function formatNumber(
  value: number,
  language: Language,
  options: Intl.NumberFormatOptions = {}
): string {
  if (!Number.isFinite(value)) return "";
  try {
    return new Intl.NumberFormat(intlLocale(language), options).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Pakistani rupee amount. Kept as "Rs" + grouped digits in both languages
 * because "Rs" is what farmers actually read on receipts and mandi boards.
 */
export function formatCurrency(
  value: number,
  language: Language,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 0 }
): string {
  return `Rs ${formatNumber(value, language, options)}`;
}

/**
 * Percent value without the sign — callers render "%" themselves so the
 * glyph stays in the right place inside mixed-direction text.
 */
export function formatPercentValue(value: number, language: Language): string {
  return formatNumber(value, language, { maximumFractionDigits: 0 });
}
