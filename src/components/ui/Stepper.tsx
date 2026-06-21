export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-3">
      {steps.map((step, index) => (
        <div key={step} className="flex flex-1 items-center gap-3">
          <div
            className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
              index <= current ? "bg-[linear-gradient(135deg,var(--primary),var(--accent-blue))] text-[var(--primary-contrast)] shadow-[var(--shadow-button)]" : "bg-[var(--surface-subtle)] text-[var(--text-muted)] ring-1 ring-[var(--border)]/70"
            }`}
          >
            {index + 1}
          </div>
          <div className={`hidden text-xs font-semibold md:block ${index <= current ? "text-[var(--text)]" : "text-[var(--text-soft)]"}`}>
            {step}
          </div>
          {index < steps.length - 1 ? <div className="h-px flex-1 bg-[var(--border)]/80" /> : null}
        </div>
      ))}
    </div>
  );
}
