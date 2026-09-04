import type { Diagnosis, Expense, FarmEvent } from "../types";

/**
 * Generic CSV export utility.
 *
 * Converts an array of objects into a CSV string and triggers a browser
 * download. Handles proper escaping of commas, quotes, and newlines in cell
 * values.
 */

/** Escape a cell value for safe CSV output. */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Convert an array of objects to a CSV string. */
export function toCsv<T>(
  rows: T[],
  columns: { key: keyof T & string; header: string }[]
): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCell(row[c.key])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

/** Trigger a browser download of a CSV string as a .csv file. */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Format an ISO date string to a human-readable date (YYYY-MM-DD). */
function formatDate(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Pre-built exporters for Kissan AI data types                       */
/* ------------------------------------------------------------------ */

export function exportExpensesCsv(expenses: Expense[]): string {
  return toCsv(expenses, [
    { key: "expenseDate", header: "Date" },
    { key: "category", header: "Category" },
    { key: "amount", header: "Amount" },
    { key: "description", header: "Description" },
  ]);
}

export function exportDiagnosesCsv(diagnoses: Diagnosis[]): string {
  return toCsv(
    diagnoses.map((d) => ({
      ...d,
      date: formatDate(d.createdAt),
      actions: (d.recommendedActions ?? []).join("; "),
    })),
    [
      { key: "date", header: "Date" },
      { key: "crop", header: "Crop" },
      { key: "diagnosis", header: "Diagnosis" },
      { key: "severity", header: "Severity" },
      { key: "confidence", header: "Confidence" },
      { key: "description", header: "Description" },
      { key: "actions", header: "Recommended Actions" },
    ]
  );
}

export function exportFarmEventsCsv(events: FarmEvent[]): string {
  return toCsv(events, [
    { key: "scheduledDate", header: "Date" },
    { key: "eventType", header: "Type" },
    { key: "title", header: "Title" },
    { key: "status", header: "Status" },
    { key: "description", header: "Description" },
  ]);
}
