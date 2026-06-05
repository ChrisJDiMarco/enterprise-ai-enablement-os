export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-3">
      {steps.map((step, index) => (
        <div key={step} className="flex flex-1 items-center gap-3">
          <div
            className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
              index <= current ? "bg-[var(--primary)] text-[var(--primary-contrast)]" : "bg-slate-100 text-slate-500"
            }`}
          >
            {index + 1}
          </div>
          <div className={`hidden text-xs font-semibold md:block ${index <= current ? "text-slate-950" : "text-slate-400"}`}>
            {step}
          </div>
          {index < steps.length - 1 ? <div className="h-px flex-1 bg-slate-200/80" /> : null}
        </div>
      ))}
    </div>
  );
}
