"use client";

import { useId } from "react";
import { Check, Info, X } from "lucide-react";

/**
 * Renders a composite percentage score with a focus/hover popover listing the
 * underlying criteria (met/unmet) and the target, so opaque "% ready" badges
 * become auditable inline.
 */

export type ScoreInput = { label: string; met: boolean };

export function ScoreBreakdown({
  value,
  target,
  inputs,
  formula,
  suffix = "%",
  className = "",
}: {
  value: number;
  target?: number;
  inputs: ScoreInput[];
  formula?: string;
  suffix?: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const metCount = inputs.filter((input) => input.met).length;

  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        aria-describedby={id}
        className="inline-flex cursor-help items-center gap-1 rounded font-semibold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)]"
      >
        {value}
        {suffix}
        <Info size={12} aria-hidden="true" className="text-[var(--text-soft)]" />
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-max min-w-[220px] max-w-[300px] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs leading-5 opacity-0 shadow-[var(--shadow-elevated)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="mb-2 flex items-center justify-between gap-3 font-semibold text-[var(--text)]">
          <span>How this is scored</span>
          <span className="tabular-nums text-[var(--text-muted)]">
            {metCount}/{inputs.length}
          </span>
        </span>
        <span className="block space-y-1">
          {inputs.map((input) => (
            <span key={input.label} className="flex items-center gap-2 text-[var(--text-muted)]">
              {input.met ? (
                <Check size={12} aria-hidden="true" className="shrink-0 text-[var(--success)]" />
              ) : (
                <X size={12} aria-hidden="true" className="shrink-0 text-[var(--text-soft)]" />
              )}
              <span>{input.label}</span>
            </span>
          ))}
        </span>
        {target != null ? (
          <span className="mt-2 block text-[var(--text-soft)]">
            Target ≥ {target}
            {suffix}
          </span>
        ) : null}
        {formula ? <span className="mt-1 block text-[var(--text-soft)]">{formula}</span> : null}
      </span>
    </span>
  );
}
