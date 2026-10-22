import type { WeatherData } from "./weather-service";

/**
 * Deterministic weather-to-farming insights.
 *
 * These are plain threshold rules over REAL provider values — no AI call, no
 * fake data. Each rule reads the actual temperature / humidity / rain / wind
 * and produces a level (low/medium/high) plus a practical, human message for a
 * farmer. Keeping the rules here (instead of in the page) makes them testable
 * and easy to refine as agronomic guidance improves.
 *
 * Language: every insight carries a stable `titleKey` / `messageKey` (plus the
 * numbers to interpolate) so the UI can render it in English *or* Urdu. The
 * English `title` / `message` fields are kept for logs and tests.
 */

export type InsightLevel = "low" | "medium" | "high";

export interface WeatherInsight {
  level: InsightLevel;
  /** English title (logs/tests). */
  title: string;
  /** English message (logs/tests). */
  message: string;
  /** i18n key for the localised title. */
  titleKey: string;
  /** i18n key for the localised message. */
  messageKey: string;
  /** Values interpolated into the translated message. */
  vars: Record<string, string | number>;
}

/** Build all applicable insights for a weather payload (may be empty). */
export function buildWeatherInsights(weather: WeatherData): WeatherInsight[] {
  const { current } = weather;
  const today = weather.forecast[0];
  const insights: WeatherInsight[] = [];

  /* ------------------------------- Rain ------------------------------- */
  const rainProb = Math.max(current.rainProbability, today?.rainProbability ?? 0);
  if (rainProb >= 70) {
    insights.push({
      level: "high",
      title: "Heavy rain likely",
      message: `There's a ${rainProb}% chance of rain — skip irrigation and let the rain water the soil. Keep an eye on low-lying fields for waterlogging.`,
      titleKey: "weatherInsight.rainHighTitle",
      messageKey: "weatherInsight.rainHighMessage",
      vars: { pct: rainProb },
    });
  } else if (rainProb >= 40) {
    insights.push({
      level: "medium",
      title: "Rain possible",
      message: `Rain chance is around ${rainProb}%. Delay watering until the rain passes, and be ready to protect newly sown seed from washout.`,
      titleKey: "weatherInsight.rainMediumTitle",
      messageKey: "weatherInsight.rainMediumMessage",
      vars: { pct: rainProb },
    });
  } else {
    insights.push({
      level: "low",
      title: "Dry conditions for field work",
      message: `Only a ${rainProb}% chance of rain — a good window for sowing, spraying, or harvesting. Water young crops if the topsoil looks dry.`,
      titleKey: "weatherInsight.rainLowTitle",
      messageKey: "weatherInsight.rainLowMessage",
      vars: { pct: rainProb },
    });
  }

  /* ------------------------------- Heat ------------------------------- */
  if (current.temperature >= 42) {
    insights.push({
      level: "high",
      title: "Extreme heat — protect your crop",
      message: `It's ${current.temperature}°C right now. Heat stress can wilt leaves and dry soil fast. Irrigate early morning or late evening and consider shade for young plants.`,
      titleKey: "weatherInsight.heatHighTitle",
      messageKey: "weatherInsight.heatHighMessage",
      vars: { temp: current.temperature },
    });
  } else if (current.temperature >= 38) {
    insights.push({
      level: "medium",
      title: "High heat today",
      message: `At ${current.temperature}°C, crops lose water quickly. Water early or late, and avoid transplanting or spraying during the hottest hours.`,
      titleKey: "weatherInsight.heatMediumTitle",
      messageKey: "weatherInsight.heatMediumMessage",
      vars: { temp: current.temperature },
    });
  } else if (current.temperature >= 33) {
    insights.push({
      level: "low",
      title: "Warm conditions",
      message: `At ${current.temperature}°C, watch soil moisture and water young crops if the topsoil looks dry.`,
      titleKey: "weatherInsight.heatLowTitle",
      messageKey: "weatherInsight.heatLowMessage",
      vars: { temp: current.temperature },
    });
  }

  /* ----------------------------- Humidity ----------------------------- */
  if (current.humidity >= 85) {
    insights.push({
      level: "high",
      title: "Very humid — watch for disease",
      message: `Humidity is ${current.humidity}%. Warm, damp air can encourage fungal diseases like blight and mildew. Check leaves for spots and improve airflow between rows.`,
      titleKey: "weatherInsight.humidityHighTitle",
      messageKey: "weatherInsight.humidityHighMessage",
      vars: { humidity: current.humidity },
    });
  } else if (current.humidity >= 70) {
    insights.push({
      level: "medium",
      title: "Humid conditions",
      message: `Humidity is ${current.humidity}%. Keep an eye out for fungal problems, especially if it stays warm and damp for a couple of days.`,
      titleKey: "weatherInsight.humidityMediumTitle",
      messageKey: "weatherInsight.humidityMediumMessage",
      vars: { humidity: current.humidity },
    });
  } else if (current.humidity < 25) {
    insights.push({
      level: "medium",
      title: "Very dry air",
      message: `Humidity is only ${current.humidity}%. Dry air pulls moisture from leaves and soil — irrigate if needed and mulch to hold water in the ground.`,
      titleKey: "weatherInsight.humidityLowTitle",
      messageKey: "weatherInsight.humidityLowMessage",
      vars: { humidity: current.humidity },
    });
  }

  /* ------------------------------- Wind ------------------------------- */
  if (current.windSpeed >= 40) {
    insights.push({
      level: "high",
      title: "Strong winds",
      message: `Wind is ${current.windSpeed} km/h — avoid spraying pesticides or fertilizer (drift) and support young or tall plants.`,
      titleKey: "weatherInsight.windHighTitle",
      messageKey: "weatherInsight.windHighMessage",
      vars: { wind: current.windSpeed },
    });
  } else if (current.windSpeed >= 25) {
    insights.push({
      level: "medium",
      title: "Breezy conditions",
      message: `Wind is ${current.windSpeed} km/h. Skip spraying today and check that young plants are well supported.`,
      titleKey: "weatherInsight.windMediumTitle",
      messageKey: "weatherInsight.windMediumMessage",
      vars: { wind: current.windSpeed },
    });
  } else if (current.windSpeed >= 15) {
    insights.push({
      level: "low",
      title: "Light breeze",
      message: `Wind is ${current.windSpeed} km/h — a good day for most field work and gentle spraying.`,
      titleKey: "weatherInsight.windLowTitle",
      messageKey: "weatherInsight.windLowMessage",
      vars: { wind: current.windSpeed },
    });
  }

  return insights;
}
