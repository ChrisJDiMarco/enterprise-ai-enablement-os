"use client";

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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950">
      <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-8 shadow-[var(--shadow-card)]">
        <div className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-100">
          Recovery mode
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-normal">The OS hit a recoverable issue</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The workspace shell is protected by an error boundary. Try reloading this surface first. If it repeats,
          capture the request time and share the error digest with the platform operator.
        </p>
        {error.digest ? (
          <div className="mt-5 rounded-lg bg-slate-50 p-4 font-mono text-xs text-slate-600">
            error_digest: {error.digest}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)] shadow-sm transition hover:bg-[var(--primary-hover)]"
            type="button"
            onClick={() => unstable_retry()}
          >
            Retry surface
          </button>
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Return to Command Center
          </button>
        </div>
      </section>
    </main>
  );
}
