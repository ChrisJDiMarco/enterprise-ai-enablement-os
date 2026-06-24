"use client";

import { useId, type ReactNode } from "react";

import { GLOSSARY, glossaryLookup } from "@/lib/ui/glossary";

/**
 * Wraps the first use of a domain term with a dotted underline and a
 * keyboard-openable definition popover. Falls back to plain text when the term
 * isn't in the glossary, so it's always safe to wrap.
 */
export function GlossaryTerm({
  term,
  children,
  className = "",
}: {
  term: string;
  children?: ReactNode;
  className?: string;
}) {
  const entry = glossaryLookup(term);
  const id = useId().replace(/:/g, "");
  const label = children ?? entry?.term ?? term;

  if (!entry) return <>{label}</>;

  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        aria-describedby={id}
        className="cursor-help border-b border-dotted border-[var(--border-strong)] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)]"
      >
        {label}
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-max max-w-[260px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium leading-5 text-[var(--text-muted)] opacity-0 shadow-[var(--shadow-elevated)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="font-semibold text-[var(--text)]">{entry.term}</span> — {entry.plain}
      </span>
    </span>
  );
}

/** Full glossary reference, for a help/settings surface. */
export function GlossaryPanel({ className = "" }: { className?: string }) {
  const entries = Object.values(GLOSSARY).filter(
    (entry, index, all) => all.findIndex((other) => other.term === entry.term) === index,
  );
  return (
    <dl className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      {entries.map((entry) => (
        <div
          key={entry.term}
          className="rounded-lg border border-[var(--border)]/68 bg-[var(--surface)]/82 px-3 py-2.5 shadow-[var(--shadow-button)]"
        >
          <dt className="text-sm font-semibold text-[var(--text)]">{entry.term}</dt>
          <dd className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{entry.plain}</dd>
        </div>
      ))}
    </dl>
  );
}
