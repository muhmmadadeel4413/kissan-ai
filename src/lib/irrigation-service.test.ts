import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchIrrigationHistory } from "./irrigation-service";
import { supabase } from "./supabase";

describe("irrigation-service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes snake_case database records into safe camelCase IrrigationRecommendation", async () => {
    const rawDatabaseRow = {
      id: "rec-123",
      farm_id: "farm-456",
      summary: "Apply moderate watering today",
      created_at: new Date().toISOString(),
      limitations: ["Based on soil type and growth stage"],
      needs_more_information: false,
      missing_information: [],
      recommendation: {
        status: "irrigate_now",
        urgency: "high",
        recommendation: "Apply moderate watering today",
        timing: {
          recommended_time: "Early morning",
          reason: "Reduce evaporation during peak sun",
        },
        // In the DB/Edge Function, these are returned in snake_case:
        water_guidance: {
          amount: "25 mm",
          unit: "mm",
          confidence: 85,
          relative: "Moderate (25-30 mm)",
        },
        weather_impact: "Warm day ahead with low rain probability",
        soil_impact: "Clay loam retains water well",
        crop_stage_impact: "Flowering stage requires consistent moisture",
        rain_adjustment: "No rain in forecast for 48h",
        next_check: "In 2 days",
        important_notes: ["Check soil depth before second irrigation"],
        limitations: ["Estimated based on crop profile"],
      },
    };

    // Mock supabase select query
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [rawDatabaseRow],
            error: null,
          }),
        }),
      }),
    });

    vi.spyOn(supabase, "from").mockReturnValue({
      select: mockSelect,
    } as any);

    const history = await fetchIrrigationHistory("farm-456");

    expect(history.length).toBe(1);
    const rec = history[0].recommendation;

    // Must be normalized to camelCase so UI components (CurrentRecommendationCard, etc.)
    // never hit TypeError: Cannot read properties of undefined
    expect(rec.waterGuidance).toBeDefined();
    expect(rec.waterGuidance.relative).toBe("Moderate (25-30 mm)");
    expect(rec.waterGuidance.amount).toBe("25 mm");
    expect(rec.weatherImpact).toBe("Warm day ahead with low rain probability");
    expect(rec.soilImpact).toBe("Clay loam retains water well");
    expect(rec.cropStageImpact).toBe("Flowering stage requires consistent moisture");
    expect(rec.rainAdjustment).toBe("No rain in forecast for 48h");
    expect(rec.nextCheck).toBe("In 2 days");
    expect(rec.importantNotes).toEqual(["Check soil depth before second irrigation"]);
  });

  it("handles empty or partial recommendation safely without throwing", async () => {
    const rawPartialRow = {
      id: "rec-partial",
      farm_id: "farm-456",
      summary: "Incomplete",
      created_at: new Date().toISOString(),
      limitations: [],
      needs_more_information: false,
      missing_information: [],
      recommendation: {
        status: "adequate",
        // missing water_guidance, weather_impact, etc.
      },
    };

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [rawPartialRow],
            error: null,
          }),
        }),
      }),
    });

    vi.spyOn(supabase, "from").mockReturnValue({
      select: mockSelect,
    } as any);

    const history = await fetchIrrigationHistory("farm-456");
    expect(history.length).toBe(1);
    const rec = history[0].recommendation;
    // Guaranteed non-null waterGuidance with relative string
    expect(rec.waterGuidance).toBeDefined();
    expect(typeof rec.waterGuidance.relative).toBe("string");
    expect(typeof rec.weatherImpact).toBe("string");
  });
});
