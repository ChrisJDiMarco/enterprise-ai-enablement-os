import type React from "react";

export type ColumnAlign = "left" | "right" | "center";

// A cell counts as numeric when its text is a plain number, currency, or percent
// (e.g. "1,842", "$12.50", "96%"). Unit-bearing text like "126 hrs/mo" stays left.
const NUMERIC_TEXT = /^[-+]?[$€£]?\s?[\d,]+(\.\d+)?\s?%?$/;

function isNumericText(value: React.ReactNode): boolean {
  return typeof value === "string" && NUMERIC_TEXT.test(value.trim());
}

/** Right-align a column when most of its cells read as numbers (with tabular figures). */
function inferAlign(rows: React.ReactNode[][], columnIndex: number): ColumnAlign {
  const textCells = rows
    .map((row) => row[columnIndex])
    .filter((cell) => typeof cell === "string" && cell.trim().length > 0) as string[];
  if (textCells.length === 0) return "left";
  const numeric = textCells.filter(isNumericText).length;
  return numeric / textCells.length >= 0.6 ? "right" : "left";
}

const ALIGN_CLASS: Record<ColumnAlign, string> = {
  left: "",
  right: "text-right tabular-nums",
  center: "text-center",
};

export function DataTable({
  columns,
  rows,
  caption = "Data table",
  emptyMessage = "No records available yet.",
  minWidth = 920,
  align,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  caption?: string;
  emptyMessage?: string;
  minWidth?: number;
  /** Per-column alignment override. Defaults to auto (numbers right-align). */
  align?: ColumnAlign[];
}) {
  const columnAlign: ColumnAlign[] = columns.map((_, index) => align?.[index] ?? inferAlign(rows, index));

  return (
    <div className="ea-surface ea-data-table overflow-hidden rounded-lg">
      <div className="grid gap-2 p-3 sm:hidden" role="list" aria-label={`${caption} records`}>
        {rows.length ? (
          rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="rounded-lg border border-[var(--border)]/68 bg-[var(--surface)]/82 p-3 shadow-[0_6px_18px_rgba(15,23,42,0.035)]"
              role="listitem"
            >
              <dl className="grid gap-2">
                {row.map((cell, cellIndex) => (
                  <div key={cellIndex} className={cellIndex === 0 ? "min-w-0" : "min-w-0 rounded-md bg-[var(--surface-muted)]/72 px-3 py-2"}>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                      {columns[cellIndex] ?? `Field ${cellIndex + 1}`}
                    </dt>
                    <dd
                      className={`mt-0.5 break-words text-sm ${cellIndex === 0 ? "font-semibold text-[var(--text)]" : "text-[var(--text-muted)]"} ${
                        columnAlign[cellIndex] === "right" ? "tabular-nums" : ""
                      }`}
                    >
                      {cell}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/74 px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            {emptyMessage}
          </div>
        )}
      </div>
      <div
        aria-label={`${caption} horizontal scroll area`}
        className="hidden overflow-x-auto focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-soft)] sm:block"
        data-testid="data-table-scroll"
        role="region"
        tabIndex={0}
      >
        <table
          aria-label={caption}
          className="w-full border-separate border-spacing-0 text-left text-sm"
          style={{ minWidth }}
        >
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-[1] bg-[var(--surface-muted)]/82 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] backdrop-blur">
            <tr>
              {columns.map((column, columnIndex) => (
                <th
                  key={column}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-3 ${ALIGN_CLASS[columnAlign[columnIndex]]}`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]/62">
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="group transition-colors hover:bg-[var(--surface-muted)]/42">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`px-4 py-2.5 align-middle text-[var(--text-muted)] first:font-semibold first:text-[var(--text)] group-hover:text-[var(--text)] ${ALIGN_CLASS[columnAlign[cellIndex]]}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length ? (
        <div className="border-t border-[var(--border)]/54 bg-[var(--surface-muted)]/48 px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
          Showing {rows.length.toLocaleString()} record{rows.length === 1 ? "" : "s"}
        </div>
      ) : null}
    </div>
  );
}
