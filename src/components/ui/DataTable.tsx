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
    <div className="ea-surface overflow-hidden rounded-lg">
      <div className="grid gap-2 p-3 sm:hidden" role="list" aria-label={`${caption} records`}>
        {rows.length ? (
          rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="rounded-lg border border-slate-200/78 bg-white/88 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
              role="listitem"
            >
              <dl className="grid gap-2">
                {row.map((cell, cellIndex) => (
                  <div key={cellIndex} className={cellIndex === 0 ? "min-w-0" : "min-w-0 rounded-md bg-slate-50/72 px-3 py-2"}>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      {columns[cellIndex] ?? `Field ${cellIndex + 1}`}
                    </dt>
                    <dd className={`mt-0.5 break-words text-sm ${cellIndex === 0 ? "font-semibold text-slate-950" : "text-slate-600"}`}>
                      {cell}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white/74 px-4 py-8 text-center text-sm text-slate-500">
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
          <thead className="sticky top-0 z-[1] bg-slate-100/78 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 backdrop-blur">
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className="whitespace-nowrap px-5 py-3.5">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/62">
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="group transition-colors hover:bg-white/76">
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
        <div className="border-t border-slate-200/62 bg-slate-50/68 px-5 py-2.5 text-xs font-medium text-slate-500">
          Showing {rows.length.toLocaleString()} record{rows.length === 1 ? "" : "s"}
        </div>
      ) : null}
    </div>
  );
}
