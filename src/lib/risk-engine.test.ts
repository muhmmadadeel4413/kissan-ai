import { describe, expect, it } from "vitest";
import {
  evaluateRiskSignals,
  prioritiseRisks,
  scoreToLevel,
  RISK_THRESHOLDS,
  type RiskEngineInput,
} from "./risk-engine";

/**
 * Unit tests for the deterministic Farm Risk Engine (Prompt 8).
 *
 * The engine is a pure, dependency-free rule layer — these tests lock in the
 * documented scoring behaviour so thresholds can be refined agronomically
 * without regressing the rules.
 */

/** Fixed "now" so recency math is deterministic. */
const NOW = new Date("2025-06-15T12:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

/** A fully-clear baseline input: no risk signals expected. */
function baselineInput(overrides: Partial<RiskEngineInput> = {}): RiskEngineInput {
  return {
    farm: {
      currentCrop: "Wheat",
      location: "Lahore",
      landArea: "5 acres",
      soilType: "Loam",
      irrigationMethod: "Canal",
      plantingDate: "2025-02-10",
    },
    growth: {
      cropAgeDays: 90,
      growthStage: "vegetative",
      stageLabel: "Vegetative",
    },
    weather: {
      temperature: 26,
      humidity: 55,
      rainProbability: 10,
      windSpeed: 8,
      condition: "Clear",
    },
    recentDiagnoses: [],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* scoreToLevel                                                        */
/* ------------------------------------------------------------------ */

describe("scoreToLevel", () => {
  it("maps scores to documented levels", () => {
    expect(scoreToLevel(0)).toBe("low");
    expect(scoreToLevel(1)).toBe("low");
    expect(scoreToLevel(2)).toBe("medium");
    expect(scoreToLevel(3)).toBe("medium");
    expect(scoreToLevel(4)).toBe("high");
    expect(scoreToLevel(5)).toBe("high");
  });
});

/* ------------------------------------------------------------------ */
/* Baseline — no data / no risk                                       */
/* ------------------------------------------------------------------ */

describe("evaluateRiskSignals — baseline & missing data", () => {
  it("returns no signals for a fully-clear baseline", () => {
    expect(evaluateRiskSignals(baselineInput(), NOW)).toEqual([]);
  });

  it("returns no signals when weather and growth are absent (no invented risks)", () => {
    const input = baselineInput({ weather: null, growth: null });
    expect(evaluateRiskSignals(input, NOW)).toEqual([]);
  });

  it("never invents disease/pest risk without a matching diagnosis", () => {
    const input = baselineInput({
      weather: { temperature: 26, humidity: 40, rainProbability: 5, windSpeed: 6 },
      recentDiagnoses: [
        {
          diagnosis: "Nutrient deficiency",
          severity: "medium",
          confidence: 80,
          createdAt: daysAgo(3),
        },
      ],
    });
    const signals = evaluateRiskSignals(input, NOW);
    expect(signals.some((s) => s.category === "pest")).toBe(false);
    expect(signals.some((s) => s.category === "disease")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Weather signals                                                     */
/* ------------------------------------------------------------------ */

describe("evaluateRiskSignals — weather", () => {
  it("flags extreme heat as HIGH", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        weather: { temperature: 43, humidity: 40, rainProbability: 5, windSpeed: 8 },
      }),
      NOW
    );
    const heat = signals.find((s) => s.title === "Extreme heat risk");
    expect(heat).toBeDefined();
    expect(heat!.level).toBe("high");
  });

  it("flags high heat as MEDIUM (below HIGH threshold)", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        weather: { temperature: 40, humidity: 40, rainProbability: 5, windSpeed: 8 },
      }),
      NOW
    );
    const heat = signals.find((s) => s.title === "High heat risk");
    expect(heat).toBeDefined();
    expect(heat!.level).toBe("medium");
  });

  it("flags very humid conditions as a disease-condition warning (not a diagnosis)", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        weather: {
          temperature: 28,
          humidity: RISK_THRESHOLDS.humidityHigh + 1,
          rainProbability: 5,
          windSpeed: 8,
        },
      }),
      NOW
    );
    const humid = signals.find((s) => s.category === "disease");
    expect(humid).toBeDefined();
    expect(humid!.level).toBe("high");
    // Honest framing — a conditions warning, not "your crop has disease X".
    expect(humid!.explanation).toContain("not a diagnosis");
  });

  it("flags heavy rain as HIGH", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        weather: {
          temperature: 26,
          humidity: 55,
          rainProbability: RISK_THRESHOLDS.rainHigh + 5,
          windSpeed: 8,
        },
      }),
      NOW
    );
    expect(signals.find((s) => s.title === "Heavy rain / waterlogging risk")?.level).toBe("high");
  });

  it("flags strong wind as HIGH when it is the strongest weather signal", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        weather: {
          temperature: 26,
          humidity: 55,
          rainProbability: 10, // low — so rain doesn't out-score wind
          windSpeed: RISK_THRESHOLDS.windHigh + 5,
        },
      }),
      NOW
    );
    expect(signals.find((s) => s.title === "Strong wind risk")?.level).toBe("high");
  });

  it("keeps only the strongest weather signal (rain out-scores wind)", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        weather: {
          temperature: 26,
          humidity: 55,
          rainProbability: RISK_THRESHOLDS.rainHigh + 5,
          windSpeed: RISK_THRESHOLDS.windHigh + 5,
        },
      }),
      NOW
    );
    // Rain (score 4) and wind (score 3) are both category "weather"; only the
    // strongest survives the per-category aggregation, so wind is dropped.
    expect(signals.some((s) => s.title === "Heavy rain / waterlogging risk")).toBe(true);
    expect(signals.some((s) => s.title === "Strong wind risk")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Diagnosis signals                                                   */
/* ------------------------------------------------------------------ */

describe("evaluateRiskSignals — diagnoses", () => {
  it("raises a pest signal from a recent high-confidence pest diagnosis", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        recentDiagnoses: [
          {
            diagnosis: "Aphid infestation detected",
            severity: "medium",
            confidence: 90,
            createdAt: daysAgo(2),
          },
        ],
      }),
      NOW
    );
    const pest = signals.find((s) => s.category === "pest");
    expect(pest).toBeDefined();
    // 3 * 1.0 * 1.0 = 3 → medium (documented score→level mapping).
    expect(pest!.level).toBe("medium");
  });

  it("scores recent diagnoses higher than old ones", () => {
    const recent = evaluateRiskSignals(
      baselineInput({
        recentDiagnoses: [
          {
            diagnosis: "Aphid infestation",
            severity: "medium",
            confidence: 90,
            createdAt: daysAgo(2),
          },
        ],
      }),
      NOW
    );
    const old = evaluateRiskSignals(
      baselineInput({
        recentDiagnoses: [
          {
            diagnosis: "Aphid infestation",
            severity: "medium",
            confidence: 90,
            createdAt: daysAgo(40),
          },
        ],
      }),
      NOW
    );
    const recentPest = recent.find((s) => s.category === "pest");
    const oldPest = old.find((s) => s.category === "pest");
    expect(recentPest?.score ?? 0).toBeGreaterThan(oldPest?.score ?? 0);
  });

  it("boosts disease risk when humidity is elevated", () => {
    const dry = evaluateRiskSignals(
      baselineInput({
        weather: { temperature: 26, humidity: 40, rainProbability: 5, windSpeed: 8 },
        recentDiagnoses: [
          {
            diagnosis: "Leaf blight detected",
            severity: "medium",
            confidence: 90,
            createdAt: daysAgo(2),
          },
        ],
      }),
      NOW
    );
    const humid = evaluateRiskSignals(
      baselineInput({
        weather: {
          temperature: 26,
          humidity: RISK_THRESHOLDS.humidityMedium + 5,
          rainProbability: 5,
          windSpeed: 8,
        },
        recentDiagnoses: [
          {
            diagnosis: "Leaf blight detected",
            severity: "medium",
            confidence: 90,
            createdAt: daysAgo(2),
          },
        ],
      }),
      NOW
    );
    const dryDisease = dry.find((s) => s.category === "disease");
    const humidDisease = humid.find((s) => s.category === "disease");
    expect((humidDisease?.score ?? 0)).toBeGreaterThan(dryDisease?.score ?? 0);
  });
});

/* ------------------------------------------------------------------ */
/* Irrigation                                                          */
/* ------------------------------------------------------------------ */

describe("evaluateRiskSignals — irrigation", () => {
  it("warns of possible water stress for rain-dependent + hot + dry", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        farm: {
          ...baselineInput().farm!,
          irrigationMethod: "Rain-fed (Barani)",
        },
        weather: {
          temperature: RISK_THRESHOLDS.heatMedium,
          humidity: 30,
          rainProbability: 10,
          windSpeed: 8,
        },
      }),
      NOW
    );
    const stress = signals.find((s) => s.category === "irrigation");
    expect(stress).toBeDefined();
    expect(stress!.level).toBe("medium");
  });

  it("skips water-stress warning when rain is likely", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        farm: {
          ...baselineInput().farm!,
          irrigationMethod: "Rain-fed (Barani)",
        },
        weather: {
          temperature: RISK_THRESHOLDS.heatMedium,
          humidity: 30,
          rainProbability: RISK_THRESHOLDS.rainMedium + 10,
          windSpeed: 8,
        },
      }),
      NOW
    );
    // No "Possible water stress" signal.
    expect(signals.find((s) => s.title === "Possible water stress")).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Crop stress                                                         */
/* ------------------------------------------------------------------ */

describe("evaluateRiskSignals — crop stress", () => {
  it("flags environmental stress when hot + dry + little rain", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        weather: {
          temperature: RISK_THRESHOLDS.heatWarm + 2,
          humidity: 25,
          rainProbability: 5,
          windSpeed: 8,
        },
      }),
      NOW
    );
    const stress = signals.find((s) => s.category === "crop_stress");
    expect(stress).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* Aggregation & prioritisation                                        */
/* ------------------------------------------------------------------ */

describe("evaluateRiskSignals — aggregation", () => {
  it("keeps only the strongest signal per category", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        weather: {
          temperature: 30,
          humidity: RISK_THRESHOLDS.humidityHigh + 1,
          rainProbability: 10,
          windSpeed: 8,
        },
        recentDiagnoses: [
          {
            diagnosis: "Powdery mildew detected",
            severity: "high",
            confidence: 95,
            createdAt: daysAgo(1),
          },
        ],
      }),
      NOW
    );
    // Many disease-category signals exist; only one should survive per category.
    const diseaseCount = signals.filter((s) => s.category === "disease").length;
    expect(diseaseCount).toBeLessThanOrEqual(1);
  });

  it("sorts signals by descending evidence score", () => {
    const signals = evaluateRiskSignals(
      baselineInput({
        weather: {
          temperature: RISK_THRESHOLDS.heatHigh + 1,
          humidity: RISK_THRESHOLDS.humidityHigh + 1,
          rainProbability: RISK_THRESHOLDS.rainHigh + 5,
          windSpeed: RISK_THRESHOLDS.windHigh + 5,
        },
        recentDiagnoses: [
          {
            diagnosis: "Aphid infestation",
            severity: "high",
            confidence: 95,
            createdAt: daysAgo(1),
          },
        ],
      }),
      NOW
    );
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i - 1].score).toBeGreaterThanOrEqual(signals[i].score);
    }
  });
});

describe("prioritiseRisks", () => {
  it("caps the number of risks at the requested maximum", () => {
    const input = baselineInput({
      weather: {
        temperature: RISK_THRESHOLDS.heatHigh + 1,
        humidity: RISK_THRESHOLDS.humidityHigh + 1,
        rainProbability: RISK_THRESHOLDS.rainHigh + 5,
        windSpeed: RISK_THRESHOLDS.windHigh + 5,
      },
      recentDiagnoses: [
        {
          diagnosis: "Aphid infestation",
          severity: "medium",
          confidence: 90,
          createdAt: daysAgo(2),
        },
      ],
    });
    const signals = evaluateRiskSignals(input, NOW);
    const capped = prioritiseRisks(signals, 3);
    expect(capped.length).toBeLessThanOrEqual(3);
    expect(capped.length).toBe(Math.min(signals.length, 3));
  });
});