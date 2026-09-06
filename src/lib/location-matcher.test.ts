import { describe, it, expect } from "vitest";
import {
  resolveLocation,
  findLocationSuggestions,
  damerauLevenshteinDistance,
  stringSimilarity,
} from "./location-matcher";

describe("location-matcher", () => {
  it("computes Damerau-Levenshtein distance with transposition", () => {
    // "fasialabad" vs "faisalabad" is 1 transposition of 'si' and 'is'
    expect(damerauLevenshteinDistance("fasialabad", "faisalabad")).toBe(1);
    expect(stringSimilarity("fasialabad", "faisalabad")).toBeGreaterThan(0.85);
  });

  it("resolves misspelled Fasialabad to Faisalabad", () => {
    const res = resolveLocation("Fasialabad");
    expect(res).not.toBeNull();
    expect(res?.name).toBe("Faisalabad");
    expect(res?.admin1).toBe("Punjab");
    expect(res?.country).toBe("Pakistan");
    expect(res?.latitude).toBeCloseTo(31.4187, 2);
    expect(res?.longitude).toBeCloseTo(73.0791, 2);
  });

  it("resolves common Pakistani city aliases & abbreviations", () => {
    expect(resolveLocation("fsd")?.name).toBe("Faisalabad");
    expect(resolveLocation("lhr")?.name).toBe("Lahore");
    expect(resolveLocation("isb")?.name).toBe("Islamabad");
    expect(resolveLocation("rwp")?.name).toBe("Rawalpindi");
    expect(resolveLocation("khi")?.name).toBe("Karachi");
    expect(resolveLocation("dg khan")?.name).toBe("Dera Ghazi Khan");
  });

  it("resolves common transliteration typos", () => {
    expect(resolveLocation("Lahor")?.name).toBe("Lahore");
    expect(resolveLocation("Rawalpndi")?.name).toBe("Rawalpindi");
    expect(resolveLocation("Gujrawala")?.name).toBe("Gujranwala");
    expect(resolveLocation("Shekhupura")?.name).toBe("Sheikhupura");
  });

  it("resolves composite strings with chaks or villages", () => {
    const res = resolveLocation("Chak 123 GB, Fasialabad");
    expect(res).not.toBeNull();
    expect(res?.name).toBe("Faisalabad");
  });

  it("provides autocomplete suggestions for partial inputs", () => {
    const suggestions = findLocationSuggestions("fasi");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].name).toBe("Faisalabad");
  });
});
