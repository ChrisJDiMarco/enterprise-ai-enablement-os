"use client";

import { useState } from "react";
import type React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { type ColumnAlign, inferColumnAlign } from "./data-table-align";

export type { ColumnAlign } from "./data-table-align";

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
  pageSize,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  caption?: string;
  emptyMessage?: string;
  minWidth?: number;
  /** Per-column alignment override. Defaults to auto (numbers right-align). */
  align?: ColumnAlign[];
  /** When set, paginates client-side with prev/next controls. Omit to show all rows. */
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const columnAlign: ColumnAlign[] = columns.map((_, index) => align?.[index] ?? inferColumnAlign(rows, index));

  const pageCount = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = pageSize ? rows.slice(safePage * pageSize, safePage * pageSize + pageSize) : rows;
  const paginated = Boolean(pageSize) && rows.length > (pageSize ?? 0);
  const firstRow = paginated ? safePage * (pageSize ?? 1) + 1 : 1;
  const lastRow = pageSize ? Math.min(rows.length, safePage * pageSize + pageSize) : rows.length;

  const pagerButton =
    "rounded border border-[var(--border)]/68 p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="ea-surface ea-data-table overflow-hidden rounded-lg">
      <div className="grid gap-2 p-3 md:hidden" role="list" aria-label={`${caption} records`}>
        {visibleRows.length ? (
          visibleRows.map((row, rowIndex) => (
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
        className="hidden overflow-x-auto focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-soft)] md:block"
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
            {visibleRows.length ? (
              visibleRows.map((row, rowIndex) => (
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
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)]/54 bg-[var(--surface-muted)]/48 px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
          <span>
            {paginated
              ? `Showing ${firstRow.toLocaleString()}–${lastRow.toLocaleString()} of ${rows.length.toLocaleString()}`
              : `Showing ${rows.length.toLocaleString()} record${rows.length === 1 ? "" : "s"}`}
          </span>
          {paginated ? (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                className={pagerButton}
              >
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              <span className="tabular-nums">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                className={pagerButton}
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
