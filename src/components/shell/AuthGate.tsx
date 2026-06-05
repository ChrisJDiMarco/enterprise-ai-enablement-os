import type { ProductionReadiness } from "@/lib/ui/types";

export function AuthGate({ readiness }: { readiness: ProductionReadiness | null }) {
  const auth = readiness?.auth;
  const blockers = readiness?.blockers ?? [];

  async function localLogin() {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    if (response.ok) {
      window.location.reload();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-6 text-slate-950">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <div className="flex size-12 items-center justify-center rounded-xl bg-[#635bff] text-base font-bold text-white">
          F
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-normal">Sign in to Enterprise AI Enablement OS</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This workspace requires an authenticated enterprise session before tenant data can be loaded.
        </p>

        <div className="mt-6 space-y-3">
          {auth?.oidcConfigured ? (
            <a
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#635bff] px-4 text-sm font-semibold text-white hover:bg-[#5147e8]"
              href="/api/auth/oidc/start"
            >
              Sign in with SSO
            </a>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              SSO is not configured yet. Add OIDC issuer, client, secret, and redirect URI environment variables.
            </div>
          )}

          {auth?.localLoginEnabled ? (
            <button type="button"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={localLogin}
            >
              Use local admin session
            </button>
          ) : null}
        </div>

        {blockers.length ? (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-800">Production blockers</div>
            <div className="mt-3 space-y-2">
              {blockers.map((blocker) => (
                <div key={blocker.id} className="text-sm leading-6 text-red-700">
                  <span className="font-semibold">{blocker.label}:</span> {blocker.detail}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
