import type React from "react";

export function DataTable({
  columns,
  rows,
  caption = "Data table",
  emptyMessage = "No records available yet.",
  minWidth = 920,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  caption?: string;
  emptyMessage?: string;
  minWidth?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/48 bg-white/64 shadow-[0_1px_0_rgba(15,23,42,0.012)]">
      <div className="overflow-x-auto">
        <table
          aria-label={caption}
          className="w-full border-separate border-spacing-0 text-left text-sm"
          style={{ minWidth }}
        >
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-[1] bg-slate-50/72 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 backdrop-blur">
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className="whitespace-nowrap px-5 py-3.5">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/76">
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="group transition hover:bg-[var(--primary-soft)]/20">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                  className="px-5 py-3 align-middle text-slate-600 first:font-semibold first:text-slate-900 group-hover:text-slate-800"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} className="px-5 py-10 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length ? (
        <div className="border-t border-slate-100/82 bg-white/40 px-5 py-2.5 text-xs font-medium text-slate-500">
          Showing {rows.length.toLocaleString()} record{rows.length === 1 ? "" : "s"}
        </div>
      ) : null}
    </div>
  );
}
