import type React from "react";
import { Panel } from "./Panel";

export function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  danger,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  trend: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex size-8 items-center justify-center rounded-lg ring-1 ring-inset ${danger ? "bg-red-50/76 text-red-600 ring-red-100" : "bg-white/84 text-[var(--primary)] ring-slate-200/82 shadow-[var(--shadow-button)]"}`}>
          <Icon size={17} />
        </div>
        <div className={`max-w-[58%] rounded-md px-2 py-1 text-right text-xs font-semibold leading-4 ring-1 ring-inset ${danger ? "bg-amber-50/78 text-amber-700 ring-amber-100" : "bg-green-50/76 text-green-700 ring-green-100"}`}>{trend}</div>
      </div>
      <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-2 truncate text-[28px] font-semibold leading-none tracking-[-0.02em] text-slate-950">{value}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={`${label}: ${value}. ${trend}`}
        className="h-full w-full min-w-0 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
        onClick={onClick}
      >
        <Panel className="h-full min-h-[132px] p-4 transition-[background-color,border-color,box-shadow] hover:border-[var(--primary)]/30 hover:bg-white hover:shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          {content}
        </Panel>
      </button>
    );
  }

  return (
    <Panel className="min-h-[132px] p-4">
      {content}
    </Panel>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200/62 bg-white/72 px-3 py-3 shadow-[var(--shadow-button)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}
