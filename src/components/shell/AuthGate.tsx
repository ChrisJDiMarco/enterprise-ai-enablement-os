"use client";

import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { ProductionReadiness } from "@/lib/ui/types";

type LocalLoginState = "idle" | "loading" | "error";

export function AuthGate({ readiness }: { readiness: ProductionReadiness | null }) {
  const auth = readiness?.auth;
  const blockers = readiness?.blockers ?? [];
  const warnings = readiness?.warnings ?? [];
  const [localLoginState, setLocalLoginState] = useState<LocalLoginState>("idle");
  const [localLoginMessage, setLocalLoginMessage] = useState("");
  const statusMessageId = "auth-gate-status-message";

  async function localLogin() {
    if (localLoginState === "loading") return;

    setLocalLoginState("loading");
    setLocalLoginMessage("Starting local admin session...");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      });

      if (response.ok) {
        setLocalLoginMessage("Local admin session started. Reloading the workspace.");
        window.location.reload();
        return;
      }

      const detail = (await response.json().catch(() => null)) as { detail?: string; error?: string } | null;
      setLocalLoginState("error");
      setLocalLoginMessage(detail?.detail || detail?.error || `Local admin session failed with status ${response.status}.`);
    } catch {
      setLocalLoginState("error");
      setLocalLoginMessage("Local admin session could not be started. Check network access and auth configuration.");
    }
  }

  return (
    <main
      data-testid="auth-gate"
      className="min-h-[100svh] bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.10),transparent_34%),linear-gradient(180deg,var(--surface-muted),var(--background))] px-4 py-6 text-[var(--text)] sm:px-6 lg:px-10"
    >
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl items-center">
        <section className="grid w-full overflow-hidden rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/88 shadow-[var(--shadow-card)] backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b border-[var(--border)]/80 p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--primary)] text-base font-bold text-white">
                E
              </div>
              <div>
                <div className="text-sm font-semibold">Enterprise AI</div>
                <div className="text-xs text-[var(--text-muted)]">Enablement OS</div>
              </div>
            </div>

            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--primary)_22%,var(--border))] bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
              <ShieldCheck size={14} aria-hidden="true" />
              Auth required
            </div>
            <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.015em] text-[var(--text)] sm:text-4xl">
              Sign in to the enterprise workspace
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base sm:leading-7">
              Tenant data, connector secrets, runtime traces, and launch evidence are held until an authenticated
              enterprise session is available.
            </p>

            <dl className="mt-7 grid gap-3 sm:grid-cols-3">
              <AuthReadinessTile label="Identity mode" value={auth?.mode ?? "checking"} />
              <AuthReadinessTile label="SSO" value={auth?.oidcConfigured ? "configured" : "not configured"} />
              <AuthReadinessTile label="Local admin" value={auth?.localLoginEnabled ? "enabled" : "disabled"} />
            </dl>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="text-sm font-semibold text-[var(--text)]">Choose an access path</div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Use SSO for normal enterprise access. Local admin is a controlled break-glass path for development or
              emergency recovery when it has been explicitly enabled.
            </p>

            <div className="mt-6 space-y-3">
              {auth?.oidcConfigured ? (
                <a
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-button)] transition hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15"
                  href="/api/auth/oidc/start"
                >
                  <KeyRound size={16} aria-hidden="true" />
                  Sign in with SSO
                </a>
              ) : (
                <div className="rounded-lg border border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--warning)]">
                  SSO is not configured yet. Add OIDC issuer, client, secret, and redirect URI environment variables
                  before inviting enterprise users.
                </div>
              )}

              {auth?.localLoginEnabled ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)] shadow-[var(--shadow-button)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/15 disabled:cursor-not-allowed disabled:opacity-55"
                  onClick={localLogin}
                  disabled={localLoginState === "loading"}
                  aria-describedby={localLoginMessage ? statusMessageId : undefined}
                >
                  {localLoginState === "loading" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
                  {localLoginState === "loading" ? "Starting local session" : "Use local admin session"}
                </button>
              ) : null}

              {localLoginMessage ? (
                <div
                  id={statusMessageId}
                  data-testid="auth-gate-login-status"
                  role={localLoginState === "error" ? "alert" : "status"}
                  aria-live={localLoginState === "error" ? "assertive" : "polite"}
                  className={`rounded-lg border px-4 py-3 text-sm leading-6 ${
                    localLoginState === "error"
                      ? "border-[color-mix(in_srgb,var(--danger)_24%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]"
                      : "border-[color-mix(in_srgb,var(--info)_24%,var(--border))] bg-[var(--info-soft)] text-[var(--info)]"
                  }`}
                >
                  {localLoginMessage}
                </div>
              ) : null}
            </div>

            {blockers.length || warnings.length ? (
              <div className="mt-7 space-y-3">
                {blockers.length ? (
                  <ReadinessList
                    title="Production blockers"
                    tone="red"
                    items={blockers}
                    testId="auth-gate-blockers"
                  />
                ) : null}
                {warnings.length ? (
                  <ReadinessList
                    title="Warnings"
                    tone="amber"
                    items={warnings.slice(0, 3)}
                    testId="auth-gate-warnings"
                  />
                ) : null}
              </div>
            ) : (
              <div className="mt-7 rounded-lg border border-[var(--border)]/80 bg-[var(--surface-muted)]/80 p-4 text-sm leading-6 text-[var(--text-muted)]">
                No launch blockers were returned with the public readiness summary.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthReadinessTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/72 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-2 truncate text-sm font-semibold text-[var(--text)]">{value}</dd>
    </div>
  );
}

function ReadinessList({
  title,
  tone,
  items,
  testId,
}: {
  title: string;
  tone: "amber" | "red";
  items: { id: string; label: string; detail: string }[];
  testId: string;
}) {
  const toneClasses =
    tone === "red"
      ? "border-[color-mix(in_srgb,var(--danger)_24%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]"
      : "border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]";

  return (
    <div data-testid={testId} className={`rounded-lg border p-4 ${toneClasses}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="text-sm leading-6">
            <span className="font-semibold">{item.label}:</span> {item.detail}
          </div>
        ))}
      </div>
    </div>
  );
}
