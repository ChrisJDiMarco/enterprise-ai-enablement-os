import type React from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="mb-6 flex flex-col gap-4 border-b border-slate-200/72 pb-5 lg:flex-row lg:items-start lg:justify-between"
      data-testid="page-header"
    >
      <div className="flex min-w-0 items-start gap-4">
        <span
          aria-hidden="true"
          className="mt-2 hidden h-11 w-1.5 shrink-0 rounded-full bg-[linear-gradient(180deg,var(--primary),var(--accent-teal),var(--accent-amber))] sm:block"
        />
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.025em] text-slate-950 sm:text-[32px]">{title}</h1>
          <p className="mt-2 max-w-4xl text-[15px] leading-7 text-slate-500">{subtitle}</p>
        </div>
      </div>
      {action ? (
        <div
          className="shrink-0 rounded-lg border border-slate-200/72 bg-white/76 p-1.5 shadow-[var(--shadow-button)] backdrop-blur"
          data-testid="page-header-actions"
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}
