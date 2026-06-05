import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950">
      <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-8 shadow-[var(--shadow-card)]">
        <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100">
          Workspace route not found
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-normal">This OS surface does not exist</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The requested route is not part of the Enterprise AI Enablement OS. Return to the Command Center and use
          search or the Orchestrator to open the right surface.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)] shadow-sm transition hover:bg-[var(--primary-hover)]"
            href="/?view=command"
          >
            Open Command Center
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            href="/?view=orchestrator"
          >
            Ask Orchestrator
          </Link>
        </div>
      </section>
    </main>
  );
}
