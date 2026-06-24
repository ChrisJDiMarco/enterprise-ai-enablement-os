import type React from "react";
import { AlertTriangle, Check, HelpCircle } from "lucide-react";
import { Badge, type BadgeTone } from "./Badge";
import { Panel } from "./Panel";

export function SectionTitle({
  title,
  helper,
  compact,
}: {
  title: string;
  helper?: string;
  compact?: boolean;
}) {
  return (
    <div>
      <div className={`${compact ? "text-sm" : "text-[15px]"} font-semibold tracking-[-0.005em] text-[var(--text)]`}>{title}</div>
      {helper ? (
        <div className="mt-1 max-w-3xl text-xs leading-5 text-[var(--text-muted)]" data-guided-copy="true">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

export function ChartSkeleton({ error }: { error?: string }) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex h-full items-center justify-center gap-2 rounded-lg border border-dashed border-[color-mix(in_srgb,var(--danger)_32%,var(--border))] bg-[var(--danger-soft)] p-5 text-center text-sm font-medium text-[var(--danger)]"
      >
        <AlertTriangle size={16} aria-hidden="true" className="shrink-0" />
        {error}
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-label="Chart loading"
      className="relative flex h-full items-end gap-3 rounded-lg border border-dashed border-[var(--border)]/72 bg-[var(--surface-inset)] p-5"
    >
      {[42, 68, 54, 82, 73, 90].map((height, index) => (
        <div key={index} className="flex flex-1 items-end">
          <div className="w-full animate-pulse rounded-t-md bg-[var(--border)]/55" style={{ height: `${height}%` }} />
        </div>
      ))}
      <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
        Loading chart
      </span>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: React.ReactNode;
  /** Optional helper text shown under the control when there's no error. */
  hint?: string;
  /** Inline validation message (announced via role="alert"). */
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]/95">{label}</span>
      <div className="mt-2">{children}</div>
      {hint && !error ? <span className="mt-1 block text-xs leading-5 text-[var(--text-soft)]">{hint}</span> : null}
      {error ? (
        <span role="alert" className="mt-1 block text-xs font-medium leading-5 text-[var(--danger)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function CheckRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onChange}
      className="flex items-center gap-3 rounded-lg border border-[var(--border)]/64 bg-[var(--surface)]/72 px-3 py-3 text-left text-sm font-medium shadow-[var(--shadow-button)] transition-[background-color,border-color] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
    >
      <span className={`flex size-5 items-center justify-center rounded-md border ${checked ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-contrast)]" : "border-[var(--border-strong)]"}`}>
        {checked ? <Check size={13} /> : null}
      </span>
      {label}
    </button>
  );
}

export function ReadinessTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: BadgeTone;
}) {
  return (
    <Panel className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</div>
      <div className="mt-3">
        <Badge tone={tone}>{value}</Badge>
      </div>
    </Panel>
  );
}

export function StatusNotice({
  children,
  tone = "blue",
  className = "",
  testId,
  compact = false,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  testId?: string;
  compact?: boolean;
}) {
  const tones: Record<BadgeTone, string> = {
    slate: "border-[var(--border)]/82 bg-[var(--surface)]/86 text-[var(--text-muted)]",
    green: "border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]",
    amber: "border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]",
    red: "border-[color-mix(in_srgb,var(--danger)_24%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
    blue: "border-[color-mix(in_srgb,var(--info)_24%,var(--border))] bg-[var(--info-soft)] text-[var(--info)]",
    purple: "border-[color-mix(in_srgb,var(--primary)_22%,var(--border))] bg-[var(--primary-soft)] text-[var(--primary)]",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid={testId}
      className={`rounded-lg border font-medium shadow-[var(--shadow-button)] ${compact ? "px-3 py-2 text-xs leading-5" : "px-4 py-3 text-sm leading-6"} ${tones[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

export function TextBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]" data-guided-copy="true">{body}</p>
    </div>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold text-[var(--text-muted)]">
        <span>{label}</span>
        <span className="tabular-nums">{value}/5</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-[var(--border)]/68">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--accent-blue),var(--accent-teal))] shadow-[0_0_0_1px_rgba(99,91,255,0.08)]"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function Avatar({ label }: { label: string }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)] ring-1 ring-[var(--primary)]/10">
      {label}
    </div>
  );
}

export function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MessageCircleIcon({ size = 16, className }: { size?: number; className?: string }) {
  return <HelpCircle size={size} className={className} />;
}
