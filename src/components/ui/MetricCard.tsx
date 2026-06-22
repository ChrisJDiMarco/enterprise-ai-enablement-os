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
        <div className={`flex size-8 items-center justify-center rounded-lg ring-1 ring-inset ${danger ? "bg-[var(--danger-soft)] text-[var(--danger)] ring-[color-mix(in_srgb,var(--danger)_24%,var(--border))]" : "bg-[var(--surface-muted)]/72 text-[var(--primary)] ring-[var(--border)]/72"}`}>
          <Icon size={17} />
        </div>
        <div className={`max-w-[62%] truncate rounded-full px-2.5 py-1 text-right text-[11px] font-semibold leading-4 ring-1 ring-inset ${danger ? "bg-[var(--warning-soft)] text-[var(--warning)] ring-[color-mix(in_srgb,var(--warning)_26%,var(--border))]" : "bg-[var(--success-soft)] text-[var(--success)] ring-[color-mix(in_srgb,var(--success)_24%,var(--border))]"}`}>{trend}</div>
      </div>
      <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 truncate text-[25px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--text)]">{value}</div>
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
        <Panel className="h-full min-h-[118px] p-4 transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--primary)]/30 hover:bg-[var(--surface)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.055)]">
          {content}
        </Panel>
      </button>
    );
  }

  return (
    <Panel className="min-h-[118px] p-4">
      {content}
    </Panel>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)]/58 bg-[var(--surface)]/62 px-3 py-2.5 shadow-[var(--shadow-button)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 min-w-0 truncate text-sm font-semibold tabular-nums text-[var(--text)]">{value}</div>
    </div>
  );
}
