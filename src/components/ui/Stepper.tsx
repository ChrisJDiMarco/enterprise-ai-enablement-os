import { Check } from "lucide-react";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div role="list" className="flex items-center gap-3">
      {steps.map((step, index) => {
        const done = index < current;
        const isCurrent = index === current;
        const active = index <= current;
        return (
          <div
            key={step}
            role="listitem"
            aria-current={isCurrent ? "step" : undefined}
            className="flex flex-1 items-center gap-3"
          >
            <div
              className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                active
                  ? "bg-[var(--primary)] text-[var(--primary-contrast)] shadow-[var(--shadow-button)]"
                  : "bg-[var(--surface-subtle)] text-[var(--text-muted)] ring-1 ring-[var(--border)]/70"
              } ${isCurrent ? "ring-2 ring-[var(--primary-soft)]" : ""}`}
            >
              {done ? <Check size={14} aria-hidden="true" /> : index + 1}
            </div>
            <div className={`hidden text-xs font-semibold md:block ${active ? "text-[var(--text)]" : "text-[var(--text-soft)]"}`}>
              {step}
            </div>
            {index < steps.length - 1 ? <div className="h-px flex-1 bg-[var(--border)]/80" /> : null}
          </div>
        );
      })}
    </div>
  );
}
