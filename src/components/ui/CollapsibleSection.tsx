"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Panel } from "./Panel";

/**
 * A consistent, accessible disclosure section: a Panel with a clickable header
 * (title + optional summary + badge + chevron) that expands/collapses its content.
 * Use it to demote secondary/supporting/explanatory content (collapsed by default)
 * so each screen leads with its main content — without removing anything.
 *
 * Uses an uncontrolled native <details>/<summary> (built-in keyboard + screen-reader
 * support, CSS-only chevron rotation via group-open). It is deliberately NOT a
 * controlled component: passing `open` as a React prop fights the browser's native
 * toggle whenever the parent re-renders, which makes the section snap shut. Instead
 * `defaultOpen` is applied once on mount via a ref, and the browser owns open/closed
 * state from then on.
 */
export function CollapsibleSection({
  title,
  summary,
  badge,
  defaultOpen = false,
  children,
  className = "",
  id,
  testId,
  hidden,
}: {
  title: ReactNode;
  summary?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
  testId?: string;
  hidden?: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = defaultOpen;
  }, [defaultOpen]);

  return (
    <Panel className={`overflow-hidden ${className}`} id={id} data-testid={testId} hidden={hidden}>
      <details ref={detailsRef} className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-muted)]/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text)]">{title}</span>
              {badge}
            </span>
            {summary ? <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{summary}</span> : null}
          </span>
          <ChevronDown
            size={16}
            className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-180 group-hover:text-[var(--text-muted)]"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-[var(--border)]/70">{children}</div>
      </details>
    </Panel>
  );
}
