import type { WeatherData } from "./weather-service";

/**
 * Deterministic weather-to-farming insights.
 *
 * These are plain threshold rules over REAL provider values — no AI call, no
 * fake data. Each rule reads the actual temperature / humidity / rain / wind
 * and produces a level (low/medium/high) plus a practical, human message for a
 * farmer. Keeping the rules here (instead of in the page) makes them testable
 * and easy to refine as agronomic guidance improves.
 */

export type InsightLevel = "low" | "medium" | "high";

export interface WeatherInsight {
  level: InsightLevel;
  title: string;
  message: string;
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
    });
  } else if (rainProb >= 40) {
    insights.push({
      level: "medium",
      title: "Rain possible",
      message: `Rain chance is around ${rainProb}%. Delay watering until the rain passes, and be ready to protect newly sown seed from washout.`,
    });
  } else {
    insights.push({
      level: "low",
      title: "Dry conditions for field work",
      message: `Only a ${rainProb}% chance of rain — a good window for sowing, spraying, or harvesting. Water young crops if the topsoil looks dry.`,
    });
  }

  /* ------------------------------- Heat ------------------------------- */
  if (current.temperature >= 42) {
    insights.push({
      level: "high",
      title: "Extreme heat — protect your crop",
      message: `It's ${current.temperature}°C right now. Heat stress can wilt leaves and dry soil fast. Irrigate early morning or late evening and consider shade for young plants.`,
    });
  } else if (current.temperature >= 38) {
    insights.push({
      level: "medium",
      title: "High heat today",
      message: `At ${current.temperature}°C, crops lose water quickly. Water early or late, and avoid transplanting or spraying during the hottest hours.`,
    });
  } else if (current.temperature >= 33) {
    insights.push({
      level: "low",
      title: "Warm conditions",
      message: `At ${current.temperature}°C, watch soil moisture and water young crops if the topsoil looks dry.`,
    });
  }

  /* ----------------------------- Humidity ----------------------------- */
  if (current.humidity >= 85) {
    insights.push({
      level: "high",
      title: "Very humid — watch for disease",
      message: `Humidity is ${current.humidity}%. Warm, damp air can encourage fungal diseases like blight and mildew. Check leaves for spots and improve airflow between rows.`,
    });
  } else if (current.humidity >= 70) {
    insights.push({
      level: "medium",
      title: "Humid conditions",
      message: `Humidity is ${current.humidity}%. Keep an eye out for fungal problems, especially if it stays warm and damp for a couple of days.`,
    });
  } else if (current.humidity < 25) {
    insights.push({
      level: "medium",
      title: "Very dry air",
      message: `Humidity is only ${current.humidity}%. Dry air pulls moisture from leaves and soil — irrigate if needed and mulch to hold water in the ground.`,
    });
  }

  /* ------------------------------- Wind ------------------------------- */
  if (current.windSpeed >= 40) {
    insights.push({
      level: "high",
      title: "Strong winds",
      message: `Wind is ${current.windSpeed} km/h — avoid spraying pesticides or fertilizer (drift) and support young or tall plants.`,
    });
  } else if (current.windSpeed >= 25) {
    insights.push({
      level: "medium",
      title: "Breezy conditions",
      message: `Wind is ${current.windSpeed} km/h. Skip spraying today and check that young plants are well supported.`,
    });
  } else if (current.windSpeed >= 15) {
    insights.push({
      level: "low",
      title: "Light breeze",
      message: `Wind is ${current.windSpeed} km/h — a good day for most field work and gentle spraying.`,
    });
  }

  return insights;
}