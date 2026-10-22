import type { Language } from "./i18n";
import type { CropGrowthInfo, Severity } from "../types";

/**
 * Localisation of *data* values that reach the UI from outside the i18n
 * dictionary: crop names, growth stages, severities and AI-generated text.
 *
 * Bug this fixes: the deterministic engines and the AI return plain English
 * ("Growth stage unavailable", "Potato", "Healthy Potato Plant"). Those
 * strings were rendered verbatim inside the Urdu UI, producing the
 * English/Urdu mixture visible on the Crop Doctor page.
 *
 * Rule of thumb enforced here:
 *   - Language-independent codes (enums, stage ids) are mapped to Urdu.
 *   - Free-form AI prose is *detected*; when the UI is Urdu and the text is
 *     English we mark it so the UI can render it as-is but flagged, instead
 *     of silently pretending it is translated.
 */

/* ------------------------------------------------------------------ */
/* Crops                                                               */
/* ------------------------------------------------------------------ */

/**
 * Canonical crop slug → Urdu name. Keys are lower-case, whitespace-collapsed
 * English crop names as stored in `farms.current_crop` / returned by the AI.
 */
const CROP_URDU: Record<string, string> = {
  wheat: "گندم",
  rice: "چاول",
  paddy: "چاول",
  cotton: "کپاس",
  maize: "مکئی",
  corn: "مکئی",
  sugarcane: "گنا",
  "sugar cane": "گنا",
  potato: "آلو",
  tomato: "ٹماٹر",
  onion: "پیاز",
  garlic: "لہسن",
  chilli: "مرچ",
  chili: "مرچ",
  pepper: "مرچ",
  eggplant: "بینگن",
  brinjal: "بینگن",
  okra: "بھنڈی",
  spinach: "پالک",
  carrot: "گاجر",
  radish: "مولی",
  turnip: "شلجم",
  cauliflower: "پھول گوبھی",
  cabbage: "بند گوبھی",
  cucumber: "کھیرا",
  pumpkin: "کدو",
  melon: "خربوزہ",
  watermelon: "تربوز",
  mango: "آم",
  citrus: "ترنج",
  orange: "مالٹا",
  banana: "کیلا",
  apple: "سیب",
  date: "کھجور",
  gram: "چنا",
  chickpea: "چنا",
  lentil: "مسور",
  mustard: "سرسوں",
  barley: "جو",
  millet: "باجرہ",
  sorghum: "جوار",
  sunflower: "سورج مکھی",
  groundnut: "مونگ پھلی",
  peanut: "مونگ پھلی",
  soybean: "سویا بین",
  tobacco: "تمباکو",
  fodder: "چارہ",
  berseem: "برسیم",
};

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Translate a crop name into the active UI language.
 * Unknown crops are returned unchanged (we never invent a translation).
 */
export function localizeCrop(crop: string | null | undefined, language: Language): string {
  if (!crop) return "";
  if (language !== "ur") return crop;
  const key = normalizeTerm(crop);
  return CROP_URDU[key] ?? crop;
}

/* ------------------------------------------------------------------ */
/* Growth stages                                                       */
/* ------------------------------------------------------------------ */

/**
 * Stable stage code → Urdu label. Keys mirror `CropGrowthStage` in types.
 * English labels live in the i18n dictionaries (`farm.stage.*`).
 */
const STAGE_URDU: Record<string, string> = {
  germination: "اگاؤ / نمود",
  vegetative: "نشوونما",
  flowering: "پھول آنے کا مرحلہ",
  fruiting: "پھل / تولیدی مرحلہ",
  maturity: "پکائی",
  harvest: "کٹائی / تیار",
  not_started: "ابھی شروع نہیں ہوا",
  unknown: "نشوونما کا مرحلہ دستیاب نہیں",
};

const STAGE_ENGLISH: Record<string, string> = {
  germination: "Germination / Emergence",
  vegetative: "Vegetative",
  flowering: "Flowering",
  fruiting: "Fruiting / Reproductive",
  maturity: "Maturity",
  harvest: "Harvest / Ready",
  not_started: "Not started",
  unknown: "Growth stage unavailable",
};

/** True when the stage carries no real information. */
export function isUnknownGrowthStage(growth: CropGrowthInfo | null | undefined): boolean {
  if (!growth) return true;
  return growth.growthStage === "unknown" || growth.growthStage === "not_started";
}

/**
 * Localised growth-stage label.
 *
 * Prefers the stable `growthStage` code over the English `stageLabel`
 * string, so it keeps working even if the label text is reworded.
 */
export function localizeGrowthStage(
  growth: CropGrowthInfo | null | undefined,
  language: Language
): string {
  if (!growth) return language === "ur" ? STAGE_URDU.unknown : STAGE_ENGLISH.unknown;
  const code = growth.growthStage;
  const table = language === "ur" ? STAGE_URDU : STAGE_ENGLISH;
  return table[code] ?? growth.stageLabel ?? (language === "ur" ? STAGE_URDU.unknown : STAGE_ENGLISH.unknown);
}

/**
 * Localised reason for why a stage is unavailable — previously an English
 * sentence ("A planting date is needed to calculate the growth stage.")
 * leaking into Urdu cards.
 */
export function localizeGrowthReason(
  growth: CropGrowthInfo | null | undefined,
  language: Language
): string {
  if (language !== "ur") return growth?.reason ?? "";
  if (!growth?.reason) return "";
  if (growth.growthStage === "unknown" && growth.cropAgeDays === null) {
    return "نشوونما کا مرحلہ معلوم کرنے کے لیے کاشت کی تاریخ درکار ہے۔";
  }
  if (growth.growthStage === "not_started") {
    return "کاشت کی تاریخ آج سے آگے کی ہے۔";
  }
  if (growth.growthStage === "unknown") {
    return "اس فصل کے لیے نشوونما کے مرحلے کی ترتیب دستیاب نہیں۔";
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Severity                                                            */
/* ------------------------------------------------------------------ */

const SEVERITY_URDU: Record<Severity, string> = {
  high: "شدید",
  medium: "درمیانہ",
  low: "کم",
};

const SEVERITY_ENGLISH: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Localised severity word (the badge text). */
export function localizeSeverity(severity: Severity, language: Language): string {
  return language === "ur" ? SEVERITY_URDU[severity] : SEVERITY_ENGLISH[severity];
}

/* ------------------------------------------------------------------ */
/* Weather                                                             */
/* ------------------------------------------------------------------ */

/**
 * WMO weather descriptions → Urdu. The set is closed and defined in
 * `src/lib/weather-service.ts` (`wmoToDescription`), so a string map is exact
 * and needs no code plumbing through the weather pipeline.
 */
const WEATHER_URDU: Record<string, string> = {
  "Clear sky": "صاف آسمان",
  "Mainly clear": "زیادہ تر صاف",
  "Partly cloudy": "کچھ بادل",
  Overcast: "مکمل بادل چھائے ہوئے",
  Fog: "دھند",
  "Rime fog": "یخ بستہ دھند",
  "Light drizzle": "ہلکی بوندا باندی",
  "Moderate drizzle": "درمیانی بوندا باندی",
  "Dense drizzle": "گھنی بوندا باندی",
  "Freezing drizzle": "منجمند بوندا باندی",
  "Dense freezing drizzle": "گھنی منجمند بوندا باندی",
  "Slight rain": "ہلکی بارش",
  "Moderate rain": "درمیانی بارش",
  "Heavy rain": "تیز بارش",
  "Freezing rain": "منجمند بارش",
  "Heavy freezing rain": "تیز منجمند بارش",
  "Slight snow": "ہلکی برف باری",
  "Moderate snow": "درمیانی برف باری",
  "Heavy snow": "تیز برف باری",
  "Snow grains": "برف کے دانے",
  "Slight rain showers": "ہلکی بارش کے چھینٹے",
  "Moderate rain showers": "درمیانی بارش کے چھینٹے",
  "Violent rain showers": "شدید بارش کے چھینٹے",
  "Slight snow showers": "ہلکی برف کے چھینٹے",
  "Heavy snow showers": "تیز برف کے چھینٹے",
  Thunderstorm: "آندھی و طوفان",
  "Thunderstorm with slight hail": "اولوں کے ساتھ طوفان",
  "Thunderstorm with heavy hail": "شدید اولوں کے ساتھ طوفان",
  Conditions: "موسمی حالات",
};

/** Localised weather condition text; unknown values pass through unchanged. */
export function localizeWeatherCondition(
  condition: string | null | undefined,
  language: Language
): string {
  if (!condition) return "";
  if (language !== "ur") return condition;
  return WEATHER_URDU[condition] ?? condition;
}

/* ------------------------------------------------------------------ */
/* Risk engine text                                                    */
/* ------------------------------------------------------------------ */

/**
 * Risk alerts are generated by the `assess-risks` Edge Function and PERSISTED
 * to the database with English `title` / `explanation` text. Both fields are
 * fixed strings (all variable data lives in `evidence`), so an exact-match
 * table is reliable and needs no schema change.
 *
 * Anything not in the table is returned unchanged — a new rule added later
 * degrades to English rather than to a broken label.
 */
const RISK_TEXT_URDU: Record<string, string> = {
  /* Titles */
  "Extreme heat risk": "شدید گرمی کا خطرہ",
  "High heat risk": "زیادہ گرمی کا خطرہ",
  "Warm conditions": "گرم موسم",
  "Heavy rain / waterlogging risk": "تیز بارش / پانی کھڑا ہونے کا خطرہ",
  "Rain possible — waterlogging watch": "بارش ممکن — پانی جمع ہونے پر نظر",
  "High humidity — disease conditions": "زیادہ نمی — بیماری کے حالات",
  "Humid conditions — disease watch": "مرطوب موسم — بیماری پر نظر",
  "Strong wind risk": "تیز ہوا کا خطرہ",
  "Breezy conditions": "ہلکی تیز ہوا",
  "Elevated pest pressure": "کیڑوں کا بڑھتا دباؤ",
  "Elevated disease risk": "بیماری کا بڑھتا خطرہ",
  "Possible water stress": "پانی کی کمی کا امکان",
  "Excess moisture watch": "زیادہ نمی پر نظر",
  "Environmental crop stress": "ماحولیاتی دباؤ سے فصل پر اثر",

  /* Explanations */
  "Very high temperatures may cause heat stress — leaves can wilt, flowers may drop, and the crop loses water faster than it can take it up.":
    "بہت زیادہ درجہ حرارت گرمی کی شدت پیدا کر سکتا ہے — پتے مرجھا سکتے ہیں، پھول گر سکتے ہیں، اور فصل اپنی ضرورت کے مطابق پانی جذب نہیں کر پاتی۔",
  "High temperatures may increase heat stress and water demand for the crop.":
    "زیادہ درجہ حرارت فصل میں گرمی کی شدت اور پانی کی طلب بڑھا سکتا ہے۔",
  "Warm conditions are manageable but slightly increase water demand.":
    "گرم موسم قابلِ انتظام ہے مگر پانی کی طلب قدرے بڑھ جاتی ہے۔",
  "High chance of heavy rain may cause waterlogging, especially in low-lying fields or heavy soils, which can suffocate roots.":
    "تیز بارش کے زیادہ امکان سے پانی کھڑا ہو سکتا ہے، خاص طور پر نشیبی کھیتوں یا بھاری مٹی میں، جس سے جڑیں گھٹ سکتی ہیں۔",
  "A moderate chance of rain means fields may get wet; low-lying areas are at some risk of waterlogging.":
    "بارش کے درمیانی امکان کا مطلب ہے کہ کھیت تر ہو سکتے ہیں؛ نشیبی علاقوں میں پانی جمع ہونے کا کچھ خطرہ ہے۔",
  "Warm, very humid air may increase the risk of fungal diseases like blight and mildew. This is a conditions warning, not a diagnosis.":
    "گرم اور بہت مرطوب ہوا جھلسنے اور پھپھوندی جیسی فنگل بیماریوں کا خطرہ بڑھا سکتی ہے۔ یہ حالات کی وارننگ ہے، تشخیص نہیں۔",
  "Moderate humidity may slightly increase the risk of fungal problems if it stays damp for a couple of days.":
    "درمیانی نمی سے فنگل مسائل کا خطرہ قدرے بڑھ سکتا ہے، خاص طور پر اگر دو دن تک موسم مرطوب رہے۔",
  "Strong winds may damage young or tall plants and cause spray drift if any treatment is applied.":
    "تیز ہوائیں جوان یا لمبے پودوں کو نقصان پہنچا سکتی ہیں، اور اگر کوئی دوا دی جائے تو سپرے اڑ سکتا ہے۔",
  "Moderate winds can cause spray drift and stress young plants.":
    "درمیانی ہوا سپرے کو اڑا سکتی ہے اور جوان پودوں پر دباؤ ڈال سکتی ہے۔",
  "A recent crop check found a pest problem. Combined with the current growth stage, pest pressure may remain elevated and deserves monitoring.":
    "حالیہ فصل چیک میں کیڑے کا مسئلہ ملا تھا۔ موجودہ نشوونما کے مرحلے کے ساتھ مل کر کیڑوں کا دباؤ برقرار رہ سکتا ہے اور نگرانی ضروری ہے۔",
  "A recent crop check found a disease. Current conditions (and humidity if elevated) may keep disease risk elevated — monitor closely rather than assume.":
    "حالیہ فصل چیک میں بیماری ملی تھی۔ موجودہ حالات (اور زیادہ نمی) بیماری کے خطرے کو برقرار رکھ سکتے ہیں — اندازے کے بجائے قریب سے نگرانی کریں۔",
  "Your irrigation depends on rainfall and conditions are hot with little rain expected — the crop may face water stress.":
    "آپ کی آبپاشی بارش پر منحصر ہے اور موسم گرم ہے جبکہ بارش کا امکان کم ہے — فصل کو پانی کی کمی کا سامنا ہو سکتا ہے۔",
  "Heavy rain is expected; fields may hold too much water, especially in heavy soil.":
    "تیز بارش متوقع ہے؛ کھیتوں میں پانی زیادہ رک سکتا ہے، خاص طور پر بھاری مٹی میں۔",
  "Hot, dry conditions with little rain may stress the crop, especially in a sensitive growth stage.":
    "گرم، خشک موسم اور کم بارش فصل پر دباؤ ڈال سکتی ہے، خاص طور پر حساس نشوونما کے مرحلے میں۔",

  /* Honest limitations (assess-risks Edge Function) */
  "Risk assessment is limited because current weather data is unavailable.":
    "خطرے کا جائزہ محدود ہے کیونکہ موجودہ موسمی ڈیٹا دستیاب نہیں۔",
  "Growth stage is unavailable, so crop-stage-specific risks are limited.":
    "نشوونما کا مرحلہ دستیاب نہیں، اس لیے مرحلے سے متعلق مخصوص خطرات محدود ہیں۔",
  "No recent crop diagnoses were found, so disease/pest risks are based on conditions alone.":
    "حالیہ فصل کی کوئی تشخیص موجود نہیں، اس لیے بیماری/کیڑوں کے خطرات صرف موجودہ حالات پر مبنی ہیں۔",
};

/** Translate a persisted risk-engine string; unknown text passes through. */
export function localizeRiskText(text: string | null | undefined, language: Language): string {
  if (!text) return "";
  if (language !== "ur") return text;
  return RISK_TEXT_URDU[text] ?? text;
}

/* ------------------------------------------------------------------ */
/* Missing farm fields                                                 */
/* ------------------------------------------------------------------ */

/**
 * The Edge Functions return a closed set of English field names when a farm
 * profile is incomplete. Localise them so the "what's missing" checklist
 * never mixes English labels into an Urdu sentence.
 */
const MISSING_FIELD_URDU: Record<string, string> = {
  "Current crop": "موجودہ فصل",
  "Soil type": "مٹی کی قسم",
  "Irrigation method": "آبپاشی کا طریقہ",
  "Farm location": "فارم کا مقام",
};

/** Localised farm-field label; unknown values pass through unchanged. */
export function localizeMissingField(field: string | null | undefined, language: Language): string {
  if (!field) return "";
  if (language !== "ur") return field;
  return MISSING_FIELD_URDU[field] ?? field;
}

/* ------------------------------------------------------------------ */
/* Irrigation engine reasons                                           */
/* ------------------------------------------------------------------ */

/**
 * `evaluateIrrigation` (src/lib/irrigation-engine.ts) returns one of a closed
 * set of fixed English reasons. They are deterministic, so an exact-match
 * table keeps the dashboard irrigation card fully in the farmer's language
 * without changing the engine or its tests.
 */
const IRRIGATION_REASON_URDU: Record<string, string> = {
  "Not enough farm information is available to recommend irrigation. Missing crop, soil type, or irrigation method.":
    "آبپاشی کی سفارش کے لیے فارم کی کافی معلومات موجود نہیں۔ فصل، مٹی کی قسم یا آبپاشی کا طریقہ درج نہیں ہے۔",
  "Rain is expected soon, so irrigation can be delayed. Check soil moisture and avoid watering until the rain passes.":
    "جلد بارش متوقع ہے، اس لیے آبپاشی مؤخر کی جا سکتی ہے۔ مٹی کی نمی چیک کریں اور بارش گزرنے تک پانی نہ دیں۔",
  "Rain may arrive, but very high temperatures raise water demand — monitor soil moisture and be ready to irrigate soon.":
    "بارش آ سکتی ہے، مگر بہت زیادہ درجہ حرارت پانی کی طلب بڑھا دیتا ہے — مٹی کی نمی پر نظر رکھیں اور جلد آبپاشی کے لیے تیار رہیں۔",
  "Your irrigation depends on rainfall and very high temperatures increase crop water loss — irrigate now if water is available.":
    "آپ کی آبپاشی بارش پر منحصر ہے اور بہت زیادہ درجہ حرارت سے فصل زیادہ پانی کھوتی ہے — اگر پانی دستیاب ہو تو ابھی آبپاشی کریں۔",
  "Warm conditions with rain-dependent irrigation raise crop water need — check soil moisture and prepare to irrigate.":
    "گرم موسم اور بارش پر منحصر آبپاشی سے فصل کی پانی کی ضرورت بڑھ جاتی ہے — مٹی کی نمی چیک کریں اور آبپاشی کے لیے تیار رہیں۔",
  "The crop is in a water-demanding stage and conditions are warm — plan to irrigate and keep soil moisture sufficient.":
    "فصل پانی کی زیادہ ضرورت والے مرحلے میں ہے اور موسم گرم ہے — آبپاشی کا منصوبہ بنائیں اور مٹی کی نمی کافی رکھیں۔",
  "Conditions are stable and not strongly demanding water. Monitor soil moisture and irrigate according to your local practice.":
    "موسم مستحکم ہے اور پانی کی شدید ضرورت نہیں۔ مٹی کی نمی پر نظر رکھیں اور اپنے مقامی طریقے کے مطابق آبپاشی کریں۔",
  "There is no strong signal that irrigation is needed right now. Monitor soil moisture and follow normal irrigation practice.":
    "ابھی آبپاشی کی ضرورت کی کوئی واضح علامت نہیں۔ مٹی کی نمی پر نظر رکھیں اور معمول کے مطابق آبپاشی کریں۔",
};

/** Translate an irrigation-engine reason; unknown text passes through. */
export function localizeIrrigationReason(
  reason: string | null | undefined,
  language: Language
): string {
  if (!reason) return "";
  if (language !== "ur") return reason;
  return IRRIGATION_REASON_URDU[reason] ?? reason;
}

/* ------------------------------------------------------------------ */
/* Farm enum values (soil / irrigation) and yield factor labels        */
/* ------------------------------------------------------------------ */

/** Soil types offered by the farm setup form. */
const SOIL_TYPE_URDU: Record<string, string> = {
  Clay: "چکنی مٹی",
  Sandy: "ریتلی مٹی",
  Loamy: "زرخیز مٹی",
  Silt: "گاد والی مٹی",
  Saline: "نمکین مٹی",
  Mixed: "ملی جلی مٹی",
};

/** Irrigation methods offered by the farm setup form. */
const IRRIGATION_METHOD_URDU: Record<string, string> = {
  Drip: "ڈرپ",
  "Flood / Furrow": "سیلاب / نالی",
  Sprinkler: "سپرنکلر",
  Canal: "نہر",
  "Rain-fed": "بارش پر منحصر",
};

/** Labels used by the deterministic yield estimator's factor list. */
const YIELD_LABEL_URDU: Record<string, string> = {
  Crop: "فصل",
  "Soil type": "مٹی کی قسم",
  Irrigation: "آبپاشی",
  Variety: "قسم",
  "Land area": "رقبہ",
  "Current crop": "موجودہ فصل",
  "Crop variety": "فصل کی قسم",
  "Planting date": "بوائی کی تاریخ",
};

export function localizeSoilType(value: string | null | undefined, language: Language): string {
  if (!value) return "";
  if (language !== "ur") return value;
  return SOIL_TYPE_URDU[value] ?? value;
}

export function localizeIrrigationMethod(
  value: string | null | undefined,
  language: Language
): string {
  if (!value) return "";
  if (language !== "ur") return value;
  return IRRIGATION_METHOD_URDU[value] ?? value;
}

/** Localised yield-factor label ("Crop", "Soil type", …). */
export function localizeYieldLabel(label: string, language: Language): string {
  if (language !== "ur") return label;
  return YIELD_LABEL_URDU[label] ?? label;
}

/** Localised yield-factor value, dispatched on its label. */
export function localizeYieldValue(
  label: string,
  value: string,
  language: Language
): string {
  if (language !== "ur") return value;
  switch (label) {
    case "Crop":
    case "Current crop":
      return localizeCrop(value, language);
    case "Soil type":
      return localizeSoilType(value, language);
    case "Irrigation":
      return localizeIrrigationMethod(value, language);
    default:
      return value;
  }
}

/* ------------------------------------------------------------------ */
/* Script detection                                                    */
/* ------------------------------------------------------------------ */

const URDU_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const DEVANAGARI = /[\u0900-\u097F]/;
const LATIN_WORD = /[A-Za-z]{3,}/;

/** True when the string contains at least one Urdu/Arabic-script character. */
export function hasUrduScript(text: string): boolean {
  return URDU_SCRIPT.test(text);
}

/** True when the string contains Devanagari (a wrong-script bug in Urdu mode). */
export function hasDevanagari(text: string): boolean {
  return DEVANAGARI.test(text);
}

/**
 * Heuristic: does this string look like untranslated English prose?
 *
 * Needs 3+ Latin letters and no Urdu script. Used to decide whether an
 * AI-generated diagnosis name should be shown with a "not translated"
 * affordance instead of being passed off as Urdu.
 */
export function looksEnglish(text: string): boolean {
  if (!text) return false;
  if (hasUrduScript(text)) return false;
  return LATIN_WORD.test(text);
}

/**
 * Normalise a value for safe display inside an RTL container.
 *
 * Mixed strings such as a farmer's Latin-script name or a diagnosis that is
 * still in English get wrapped in Unicode isolates so the surrounding RTL
 * paragraph does not reorder their punctuation (the "…hammad Adeel abbas"
 * truncation bug).
 */
export function isolate(text: string, direction?: "auto" | "ltr" | "rtl"): string {
  if (!text) return "";
  const dir = direction ?? (hasUrduScript(text) ? "rtl" : "ltr");
  const open = dir === "rtl" ? "\u2067" : "\u2066"; // RLI / LRI
  const close = "\u2069"; // PDI
  return `${open}${text}${close}`;
}
