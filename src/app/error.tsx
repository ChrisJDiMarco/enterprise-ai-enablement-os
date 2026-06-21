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
      className="min-h-[100svh] bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,var(--surface-muted),var(--background))] px-4 py-6 text-[var(--text)] sm:px-6 lg:px-10"
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

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            <ShieldAlert size={14} aria-hidden="true" />
            Recovery mode
          </div>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.015em] text-[var(--text)] sm:text-4xl">
            The workspace contained a recoverable issue
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base sm:leading-7">
            This surface was isolated before it could leave the operating system in a broken state. Retry the route
            first; if it repeats, share the digest and request time with the platform operator.
          </p>

          {error.digest ? (
            <div className="mt-6 rounded-lg border border-[var(--border)]/80 bg-[var(--surface-inset)] p-4 font-mono text-xs leading-6 text-[var(--text-muted)]">
              error_digest: {error.digest}
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-contrast)] shadow-[var(--shadow-button)] transition hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15"
              type="button"
              onClick={() => unstable_retry()}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Retry surface
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] shadow-[var(--shadow-button)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15"
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

        <aside className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-card)] backdrop-blur sm:p-8 lg:p-10">
          <h2 className="text-lg font-semibold text-[var(--text)]">What the platform already did</h2>
          <div className="mt-5 grid gap-3">
            {[
              ["Boundary contained", "Only this route was replaced by recovery UI."],
              ["Audit attempted", "A platform audit event was sent with the digest and error type."],
              ["Workspace preserved", "Retry re-fetches and re-renders this surface without changing data."],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface-muted)]/80 p-4">
                <div className="text-sm font-semibold text-[var(--text)]">{label}</div>
                <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{detail}</div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
