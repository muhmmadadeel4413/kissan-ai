import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWeather } from "./weather-service";
import { supabase } from "./supabase";

describe("weather-service", () => {
  beforeEach(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  it("normalizes misspelled Fasialabad and fetches weather", async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: {
        success: true,
        weather: {
          current: {
            temperature: 30,
            feelsLike: 32,
            humidity: 50,
            rainProbability: 10,
            windSpeed: 5,
            condition: "Clear sky",
            conditionCode: "Clear",
            capturedAt: new Date().toISOString(),
          },
          forecast: [],
          location: { name: "Faisalabad", country: "Pakistan" },
        },
      },
      error: null,
    });

    vi.spyOn(supabase, "functions", "get").mockReturnValue({
      invoke: mockInvoke,
    } as any);

    const weather = await getWeather("Fasialabad");

    // Must have invoked get-weather with the normalized canonical name "Faisalabad"
    expect(mockInvoke).toHaveBeenCalledWith("get-weather", {
      body: { location: "Faisalabad" },
    });
    expect(weather.location.name).toBe("Faisalabad");
    expect(weather.current.temperature).toBe(30);
  });

  it("falls back gracefully to direct Open-Meteo fetch if Edge Function returns 404", async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: {
        success: false,
        error: `We couldn't find "Fasialabad" on the map.`,
      },
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          text: async () => JSON.stringify({ error: `We couldn't find "Fasialabad" on the map.` }),
        },
      } as any,
    });

    vi.spyOn(supabase, "functions", "get").mockReturnValue({
      invoke: mockInvoke,
    } as any);

    // Mock global fetch for direct Open-Meteo fallback
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 32,
          apparent_temperature: 35,
          relative_humidity_2m: 55,
          weather_code: 0,
          wind_speed_10m: 4,
          time: new Date().toISOString(),
        },
        daily: {
          time: ["2026-09-06"],
          weather_code: [0],
          temperature_2m_max: [35],
          temperature_2m_min: [25],
          precipitation_probability_max: [10],
          wind_speed_10m_max: [10],
          precipitation_sum: [0],
          rain_sum: [0],
        },
      }),
    } as any);

    const weather = await getWeather("Fasialabad");

    expect(weather.location.name).toBe("Faisalabad");
    expect(weather.current.temperature).toBe(32);
    expect(weather.current.condition).toBe("Clear sky");
  });
});
