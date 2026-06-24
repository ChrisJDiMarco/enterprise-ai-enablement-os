import { ChevronRight } from "lucide-react";

/**
 * Compact navigation trail. Ancestor segments with an onClick are buttons; the
 * final segment is the current page (aria-current). Gives depth context across
 * the app's state-driven views.
 */

export type Crumb = { label: string; onClick?: () => void };

export function Breadcrumb({ items, className = "" }: { items: Crumb[]; className?: string }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={`flex min-w-0 items-center gap-1 text-xs ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="max-w-[140px] truncate rounded font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)]"
              >
                {item.label}
              </button>
            ) : (
              <span
                className={`max-w-[180px] truncate ${isLast ? "font-semibold text-[var(--text)]" : "text-[var(--text-muted)]"}`}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
            {!isLast ? <ChevronRight size={12} aria-hidden="true" className="shrink-0 text-[var(--text-soft)]" /> : null}
          </span>
        );
      })}
    </nav>
  );
}
