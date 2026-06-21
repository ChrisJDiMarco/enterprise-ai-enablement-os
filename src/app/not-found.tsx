import Link from "next/link";
import { ArrowRight, Home, Search, ShieldCheck } from "lucide-react";

export default function NotFound() {
  return (
    <main
      data-testid="not-found-boundary"
      className="min-h-[100svh] bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.10),transparent_34%),linear-gradient(180deg,var(--surface-muted),var(--background))] px-4 py-6 text-[var(--text)] sm:px-6 lg:px-10"
    >
      <section className="mx-auto grid min-h-[calc(100svh-3rem)] w-full max-w-6xl content-center gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface-overlay)] p-6 shadow-[var(--shadow-card)] backdrop-blur sm:p-8 lg:p-10">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--primary)] text-base font-bold text-white">
              E
            </div>
            <div>
              <div className="text-sm font-semibold">Enterprise AI</div>
              <div className="text-xs text-[var(--text-muted)]">Enablement OS</div>
            </div>
          </div>

          <div className="mt-8 inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--primary)]/16 bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
            <Search size={14} aria-hidden="true" />
            Route not found
          </div>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.015em] text-[var(--text)] sm:text-4xl">
            This workspace surface is not available
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base sm:leading-7">
            The requested path is not part of the Enterprise AI Enablement OS. No workspace data was changed; return
            to an operating surface and continue from there.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-contrast)] shadow-[var(--shadow-button)] transition hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15"
              href="/?view=command"
            >
              <Home size={16} aria-hidden="true" />
              Open Command Center
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] shadow-[var(--shadow-button)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15"
              href="/?view=orchestrator"
            >
              Ask Orchestrator
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-card)] backdrop-blur sm:p-8 lg:p-10">
          <div className="flex size-11 items-center justify-center rounded-xl border border-green-100 bg-green-50 text-green-700">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-[var(--text)]">Recovery checklist</h2>
          <div className="mt-5 space-y-4 text-sm leading-6 text-[var(--text-muted)]">
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
