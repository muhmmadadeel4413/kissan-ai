import { describe, expect, it } from "vitest";
import {
  toCsv,
  exportExpensesCsv,
  exportDiagnosesCsv,
  exportFarmEventsCsv,
} from "./export-utils";
import type { Diagnosis, Expense, FarmEvent } from "../types";

/**
 * Unit tests for the CSV export utility.
 *
 * Locks in cell-escaping rules (commas, quotes, newlines) and the shape of
 * each pre-built exporter so downstream page code can safely rely on
 * `downloadCsv()` producing well-formed CSV.
 */

describe("toCsv", () => {
  it("emits a header row followed by one data row per input", () => {
    const rows = [
      { name: "Wheat", qty: 3 },
      { name: "Rice", qty: 5 },
    ];
    const csv = toCsv(rows, [
      { key: "name", header: "Crop" },
      { key: "qty", header: "Quantity" },
    ]);
    expect(csv).toBe("Crop,Quantity\nWheat,3\nRice,5");
  });

  it("returns only the header when the input array is empty", () => {
    const csv = toCsv([], [{ key: "a", header: "A" }]);
    expect(csv).toBe("A\n");
  });

  it("escapes cells containing commas", () => {
    const csv = toCsv([{ note: "one, two" }], [{ key: "note", header: "Note" }]);
    expect(csv).toBe('Note\n"one, two"');
  });

  it("escapes cells containing double quotes by doubling them", () => {
    const csv = toCsv([{ note: 'say "hi"' }], [{ key: "note", header: "Note" }]);
    expect(csv).toBe('Note\n"say ""hi"""');
  });

  it("escapes cells containing newlines", () => {
    const csv = toCsv([{ note: "a\nb" }], [{ key: "note", header: "Note" }]);
    expect(csv).toBe('Note\n"a\nb"');
  });

  it("treats null and undefined cell values as empty strings", () => {
    const csv = toCsv(
      [{ a: null as unknown as string, b: undefined as unknown as string }],
      [
        { key: "a", header: "A" },
        { key: "b", header: "B" },
      ]
    );
    expect(csv).toBe("A,B\n,");
  });
});

describe("exportExpensesCsv", () => {
  it("emits the documented column order for expenses", () => {
    const expenses: Expense[] = [
      {
        id: "e1",
        farmId: "f1",
        createdAt: "2026-09-01T10:00:00Z",
        expenseDate: "2026-09-01",
        category: "seeds",
        amount: 1200,
        description: "Wheat seed",
      },
    ];
    const csv = exportExpensesCsv(expenses);
    expect(csv.split("\n")[0]).toBe("Date,Category,Amount,Description");
    expect(csv).toContain("2026-09-01,seeds,1200,Wheat seed");
  });
});

describe("exportDiagnosesCsv", () => {
  it("flattens createdAt to a date and joins recommendedActions with semicolons", () => {
    const diagnoses: Diagnosis[] = [
      {
        id: "d1",
        farmId: "f1",
        createdAt: "2026-09-02T12:34:56Z",
        crop: "Wheat",
        diagnosis: "Leaf rust",
        severity: "moderate",
        confidence: 0.87,
        description: "Yellow pustules on leaves",
        recommendedActions: ["Apply fungicide", "Remove affected leaves"],
      } as unknown as Diagnosis,
    ];
    const csv = exportDiagnosesCsv(diagnoses);
    expect(csv.split("\n")[0]).toBe(
      "Date,Crop,Diagnosis,Severity,Confidence,Description,Recommended Actions"
    );
    expect(csv).toContain("2026-09-02,Wheat,Leaf rust,moderate,0.87");
    expect(csv).toContain("Apply fungicide; Remove affected leaves");
  });

  it("handles missing recommendedActions gracefully", () => {
    const diagnoses: Diagnosis[] = [
      {
        id: "d2",
        farmId: "f1",
        createdAt: "2026-09-03T10:00:00Z",
        crop: "Rice",
        diagnosis: "Healthy",
        severity: "none",
        confidence: 1,
        description: "No issues",
      } as unknown as Diagnosis,
    ];
    const csv = exportDiagnosesCsv(diagnoses);
    expect(csv).toContain("2026-09-03,Rice,Healthy");
  });
});

describe("exportFarmEventsCsv", () => {
  it("emits the documented column order for calendar events", () => {
    const events: FarmEvent[] = [
      {
        id: "ev1",
        farmId: "f1",
        createdAt: "2026-09-10T08:00:00Z",
        scheduledDate: "2026-09-10",
        eventType: "irrigation",
        title: "Irrigate field A",
        status: "scheduled",
        description: "Drip cycle",
      },
    ];
    const csv = exportFarmEventsCsv(events);
    expect(csv.split("\n")[0]).toBe("Date,Type,Title,Status,Description");
    expect(csv).toContain(
      "2026-09-10,irrigation,Irrigate field A,scheduled,Drip cycle"
    );
  });
});
