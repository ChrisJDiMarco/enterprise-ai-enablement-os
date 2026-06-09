import { Loader2 } from "lucide-react";

export function BootShell() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-labelledby="boot-shell-title"
      data-testid="boot-shell"
      className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-950"
    >
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-slate-200 bg-white lg:block">
          <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#635bff] text-sm font-bold text-white">
              E
            </div>
            <div>
              <div className="text-sm font-semibold">Enterprise AI</div>
              <div className="text-xs text-slate-500">Enablement OS</div>
            </div>
          </div>
          <div className="space-y-2 px-4 py-5" aria-hidden="true">
            {["Command Center", "Use Case Factory", "AI Harness", "Skills Library"].map((item) => (
              <div key={item} className="h-9 rounded-lg bg-slate-100" />
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 lg:ml-[248px]">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#635bff] text-sm font-bold text-white lg:hidden">
                E
              </div>
              <div className="hidden min-w-0 sm:block lg:hidden">
                <div className="truncate text-sm font-semibold">Enterprise AI</div>
                <div className="truncate text-xs text-slate-500">Enablement OS</div>
              </div>
              <div className="hidden h-9 w-[min(420px,42vw)] rounded-lg bg-slate-100 lg:block" aria-hidden="true" />
            </div>
            <div className="flex shrink-0 items-center gap-3" aria-hidden="true">
              <div className="size-9 rounded-lg bg-slate-100" />
              <div className="size-9 rounded-full bg-slate-100" />
            </div>
          </header>

          <div className="px-4 py-6 sm:px-7">
            <section className="max-w-3xl rounded-lg border border-slate-200/80 bg-white/88 p-5 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Loading
              </div>
              <h1 id="boot-shell-title" className="mt-3 text-2xl font-semibold tracking-[-0.01em] text-slate-950">
                Preparing workspace
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Loading tenant settings, readiness checks, navigation, and workspace records.
              </p>
            </section>

            <div className="mt-6 h-7 w-64 max-w-full rounded-lg bg-slate-100" aria-hidden="true" />
            <div className="mt-3 h-4 w-96 max-w-full rounded bg-slate-100" aria-hidden="true" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-28 rounded-xl border border-slate-200 bg-white" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
