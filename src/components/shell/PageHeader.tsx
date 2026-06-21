import type React from "react";

export function PageHeader({
  title,
  subtitle,
  action,
  compact = false,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`ea-page-header flex min-w-0 flex-col overflow-visible rounded-lg ${
        compact
          ? "mb-3 gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
          : "mb-5 gap-4 px-5 py-5 xl:flex-row xl:items-start xl:justify-between"
      }`}
      data-compact={compact ? "true" : undefined}
      data-testid="page-header"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={`ea-page-header-accent hidden h-2 w-2 shrink-0 rounded-full bg-[var(--primary)] ring-4 ring-[var(--primary-soft)] sm:block ${
            compact ? "mt-1.5" : "mt-2"
          }`}
        />
        <div className="min-w-0">
          <h1 className={`font-semibold leading-tight tracking-tight text-[var(--text)] ${compact ? "text-[22px] sm:text-[26px]" : "text-[24px] sm:text-[30px]"}`}>
            {title}
          </h1>
          <p
            className={`max-w-4xl text-[14px] text-[var(--text-muted)] ${compact ? "mt-1 line-clamp-1 leading-5" : "mt-1.5 leading-6"}`}
            data-guided-copy="true"
          >
            {subtitle}
          </p>
        </div>
      </div>
      {action ? (
        <div
          className={`ea-page-header-actions w-full min-w-0 rounded-lg border border-[var(--border)]/60 bg-[var(--surface)]/70 p-1 shadow-[var(--shadow-button)] backdrop-blur xl:w-auto ${
            compact ? "lg:w-auto lg:max-w-[min(100%,720px)]" : "xl:w-auto xl:max-w-[min(100%,560px)]"
          }`}
          data-testid="page-header-actions"
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}
