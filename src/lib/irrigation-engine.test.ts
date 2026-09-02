import { describe, expect, it } from "vitest";
import type { IrrigationRecommendation } from "../types";
import {
  evaluateIrrigation,
  effectiveRainPct,
  sanitizeIrrigationPayload,
  insufficientRecommendation,
} from "./irrigation-engine";

/**
 * Unit tests for the deterministic Irrigation Advisor rule layer (Prompt 14).
 *
 * The engine is pure and dependency-free — these tests lock in the documented
 * rain-aware, missing-data, and no-fabrication rules so they can be refined
 * agronomically without regressing honesty guarantees.
 */

/** A valid baseline input: crop + soil + method + a known growth stage. */
function baseline(overrides: Record<string, unknown> = {}) {
  return {
    crop: "Wheat",
    growthStage: "vegetative",
    soilType: "Loam",
    irrigationMethod: "Canal",
    rainProbability: 10,
    temperature: 26,
    ...overrides,
  };
}

describe("evaluateIrrigation - missing information", () => {
  it("returns an honest insufficient state when the crop is missing", () => {
    const out = evaluateIrrigation(baseline({ crop: "" }));
    expect(out.status).toBe("insufficient");
    expect(out.urgency).toBe("low");
  });

  it("returns an honest insufficient state when the soil type is missing", () => {
    const out = evaluateIrrigation(baseline({ soilType: "" }));
    expect(out.status).toBe("insufficient");
  });

  it("returns an honest insufficient state when the irrigation method is missing", () => {
    const out = evaluateIrrigation(baseline({ irrigationMethod: "" }));
    expect(out.status).toBe("insufficient");
  });
});

describe("evaluateIrrigation - rain aware", () => {
  it("recommends delay when meaningful rain is expected soon", () => {
    const out = evaluateIrrigation(baseline({ rainProbability: 80 }));
    expect(out.status).toBe("delay");
    expect(out.reason.toLowerCase()).toContain("rain");
  });

  it("does not blindly recommend watering when rain is on the way", () => {
    const out = evaluateIrrigation(baseline({ rainProbability: 75 }));
    expect(out.status).toBe("delay");
  });
});

describe("evaluateIrrigation - normal crop needs water", () => {
  it("keeps an adequate/monitor stance when conditions are stable", () => {
    // Known stage, comfortable temperature, low rain -> no invented urgency.
    const out = evaluateIrrigation(baseline({ temperature: 24 }));
    expect(out.status).toBe("adequate");
    expect(out.urgency).toBe("low");
  });

  it("recommends irrigation soon for a water-demanding stage in warm weather", () => {
    const out = evaluateIrrigation(
      baseline({ growthStage: "flowering", temperature: 36 })
    );
    expect(out.status).toBe("irrigation_soon");
    expect(out.urgency).toBe("medium");
  });
});

describe("evaluateIrrigation - rain-dependent + hot", () => {
  it("warns of water stress for rain-dependent irrigation with extreme heat", () => {
    const out = evaluateIrrigation(
      baseline({ irrigationMethod: "Rain-fed", temperature: 42 })
    );
    expect(out.status).toBe("irrigate_now");
    expect(out.urgency).toBe("high");
  });
});

describe("sanitizeIrrigationPayload / honesty", () => {
  it("drops invalid status payloads (returns null)", () => {
    expect(sanitizeIrrigationPayload({ irrigation_status: "bogus" })).toBeNull();
  });

  it("never fabricates a precise quantity: keeps amount empty when unverified", () => {
    const safe = sanitizeIrrigationPayload({ irrigation_status: "adequate" });
    expect(safe).not.toBeNull();
    expect(safe!.recommendation.status).toBe("adequate");
    expect(safe!.recommendation.waterGuidance.amount).toBe("");
  });

  it("clamps water confidence into 0-100", () => {
    const safe = sanitizeIrrigationPayload({
      irrigation_status: "adequate",
      water_guidance: { confidence: 999 },
    });
    expect(safe!.recommendation.waterGuidance.confidence).toBe(100);
  });
});

describe("effectiveRainPct", () => {
  it("takes the maximum of current and forecast rain", () => {
    expect(
      effectiveRainPct(20, [{ rainProbability: 60 }, { rainProbability: 30 }])
    ).toBe(60);
  });

  it("returns 0 when no real rain data exists", () => {
    expect(effectiveRainPct(undefined, [])).toBe(0);
  });
});

describe("insufficientRecommendation", () => {
  it("is always low urgency and never fabricates an amount", () => {
    const rec: IrrigationRecommendation = insufficientRecommendation(["Soil type"]);
    expect(rec.status).toBe("insufficient");
    expect(rec.waterGuidance.amount).toBe("");
    expect(rec.limitations.join(" ")).toContain("Soil type");
  });
});