"use client";

import { Home, RotateCcw, ShieldAlert } from "lucide-react";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    void fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "policy_violation",
        message: "Client route error boundary rendered.",
        actor: "System",
        riskLevel: "medium",
        metadata: {
          digest: error.digest ?? null,
          name: error.name,
        },
      }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <main
      data-testid="route-error-boundary"
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,#f8fafc,#fff7ed)] px-4 py-6 text-slate-950 sm:px-6 lg:px-10"
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

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            <ShieldAlert size={14} aria-hidden="true" />
            Recovery mode
          </div>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.015em] text-slate-950 sm:text-4xl">
            The workspace contained a recoverable issue
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            This surface was isolated before it could leave the operating system in a broken state. Retry the route
            first; if it repeats, share the digest and request time with the platform operator.
          </p>

          {error.digest ? (
            <div className="mt-6 rounded-lg border border-slate-200/80 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-600">
              error_digest: {error.digest}
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-contrast)] shadow-[var(--shadow-button)] transition hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-4 focus:ring-[#635bff]/15"
              type="button"
              onClick={() => unstable_retry()}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Retry surface
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-button)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-[#635bff]/15"
              type="button"
              onClick={() => {
                window.location.href = "/?view=command";
              }}
            >
              <Home size={16} aria-hidden="true" />
              Open Command Center
            </button>
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200/80 bg-white/80 p-6 shadow-[var(--shadow-card)] backdrop-blur sm:p-8 lg:p-10">
          <h2 className="text-lg font-semibold text-slate-950">What the platform already did</h2>
          <div className="mt-5 grid gap-3">
            {[
              ["Boundary contained", "Only this route was replaced by recovery UI."],
              ["Audit attempted", "A platform audit event was sent with the digest and error type."],
              ["Workspace preserved", "Retry re-fetches and re-renders this surface without changing data."],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="text-sm font-semibold text-slate-950">{label}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{detail}</div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
