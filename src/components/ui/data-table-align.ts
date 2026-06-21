import type React from "react";

export type ColumnAlign = "left" | "right" | "center";

// A cell counts as numeric when its text is a plain number, currency, or percent
// (e.g. "1,842", "$12.50", "96%"). Unit-bearing text like "126 hrs/mo" stays left.
const NUMERIC_TEXT = /^[-+]?[$€£]?\s?[\d,]+(\.\d+)?\s?%?$/;

export function isNumericText(value: React.ReactNode): boolean {
  return typeof value === "string" && NUMERIC_TEXT.test(value.trim());
}

/** Right-align a column when most of its cells read as numbers (with tabular figures). */
export function inferColumnAlign(rows: React.ReactNode[][], columnIndex: number): ColumnAlign {
  const textCells = rows
    .map((row) => row[columnIndex])
    .filter((cell) => typeof cell === "string" && cell.trim().length > 0) as string[];
  if (textCells.length === 0) return "left";
  const numeric = textCells.filter(isNumericText).length;
  return numeric / textCells.length >= 0.6 ? "right" : "left";
}
