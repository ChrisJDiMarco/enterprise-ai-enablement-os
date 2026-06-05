import type React from "react";
import { Check, HelpCircle } from "lucide-react";
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
      <div className={`${compact ? "text-sm" : "text-[15px]"} font-semibold tracking-[-0.005em] text-slate-950`}>{title}</div>
      {helper ? <div className="mt-1 max-w-3xl text-xs leading-5 text-slate-500/95">{helper}</div> : null}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex h-full items-end gap-3 rounded-lg bg-white/46 p-5 ring-1 ring-slate-200/42">
      {[42, 68, 54, 82, 73, 90].map((height, index) => (
        <div key={index} className="flex flex-1 items-end">
          <div className="w-full rounded-t-md bg-slate-200/62" style={{ height: `${height}%` }} />
        </div>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500/95">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export function CheckRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-3 rounded-lg border border-slate-200/54 bg-white/[0.62] px-3 py-3 text-left text-sm font-medium transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
    >
      <span className={`flex size-5 items-center justify-center rounded-md border ${checked ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-contrast)]" : "border-slate-300"}`}>
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
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-3">
        <Badge tone={tone}>{value}</Badge>
      </div>
    </Panel>
  );
}

export function TextBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span>{value}/5</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[var(--primary)] shadow-[0_0_0_1px_rgba(99,91,255,0.08)]" style={{ width: `${(value / 5) * 100}%` }} />
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
