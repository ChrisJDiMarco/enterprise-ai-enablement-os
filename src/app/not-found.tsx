import Link from "next/link";
import { ArrowRight, Home, Search, ShieldCheck } from "lucide-react";

export default function NotFound() {
  return (
    <main
      data-testid="not-found-boundary"
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.10),transparent_34%),linear-gradient(180deg,#f8fafc,#eef2ff)] px-4 py-6 text-slate-950 sm:px-6 lg:px-10"
    >
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl content-center gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-lg border border-slate-200/80 bg-white/90 p-6 shadow-[var(--shadow-card)] backdrop-blur sm:p-8 lg:p-10">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#635bff] text-base font-bold text-white">
              E
            </div>
            <div>
              <div className="text-sm font-semibold">Enterprise AI</div>
              <div className="text-xs text-slate-500">Enablement OS</div>
            </div>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
            <Search size={14} aria-hidden="true" />
            Route not found
          </div>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.015em] text-slate-950 sm:text-4xl">
            This workspace surface is not available
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            The requested path is not part of the Enterprise AI Enablement OS. No workspace data was changed; return
            to an operating surface and continue from there.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-contrast)] shadow-[var(--shadow-button)] transition hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-4 focus:ring-[#635bff]/15"
              href="/?view=command"
            >
              <Home size={16} aria-hidden="true" />
              Open Command Center
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-button)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-[#635bff]/15"
              href="/?view=orchestrator"
            >
              Ask Orchestrator
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200/80 bg-white/80 p-6 shadow-[var(--shadow-card)] backdrop-blur sm:p-8 lg:p-10">
          <div className="flex size-11 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-slate-950">Recovery checklist</h2>
          <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
            <p>
              Use Command Center for the canonical workspace map, AI Assistant for intent-based routing, or the left
              navigation once the shell reloads.
            </p>
            <p>
              If a shared link sent you here, ask the workspace owner to resend it from the current operating surface.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
