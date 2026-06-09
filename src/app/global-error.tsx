"use client";

import { useEffect } from "react";

export default function GlobalError({
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
        message: "Global application error boundary rendered.",
        actor: "System",
        riskLevel: "high",
        metadata: {
          digest: error.digest ?? null,
          name: error.name,
        },
      }),
    }).catch(() => undefined);
  }, [error]);

  const statusItems = [
    ["Root boundary active", "The failure was contained before a broken shell was shown."],
    ["Audit attempted", "A high-risk recovery event was sent with the digest and error type."],
    ["Data unchanged", "Retry reloads the app surface without mutating workspace records."],
  ];

  return (
    <html lang="en">
      <head>
        <title>Enterprise AI Enablement OS Recovery</title>
      </head>
      <body
        style={{
          alignItems: "center",
          background:
            "radial-gradient(circle at top left, rgba(99,91,255,0.10), transparent 34%), linear-gradient(180deg, #f8fafc, #eef2ff)",
          color: "#0f172a",
          display: "flex",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "24px",
        }}
      >
        <main
          data-testid="global-error-boundary"
          style={{
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(226,232,240,0.9)",
            borderRadius: 10,
            boxShadow: "0 24px 80px rgba(15,23,42,0.14)",
            display: "grid",
            gap: 24,
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)",
            maxWidth: 1080,
            padding: 32,
            width: "100%",
          }}
        >
          <section>
            <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
              <div
                style={{
                  alignItems: "center",
                  background: "#635bff",
                  borderRadius: 12,
                  color: "#ffffff",
                  display: "flex",
                  fontSize: 16,
                  fontWeight: 800,
                  height: 44,
                  justifyContent: "center",
                  width: 44,
                }}
              >
                E
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Enterprise AI</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>Enablement OS</div>
              </div>
            </div>

            <p
              style={{
                background: "#eef2ff",
                border: "1px solid #e0e7ff",
                borderRadius: 999,
                color: "#4f46e5",
                display: "inline-flex",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.14em",
                margin: "32px 0 0",
                padding: "6px 12px",
                textTransform: "uppercase",
              }}
            >
              Global recovery
            </p>
            <h1 style={{ fontSize: 36, letterSpacing: "-0.015em", lineHeight: 1.1, margin: "18px 0 0" }}>
              Enterprise AI Enablement OS needs a clean reload
            </h1>
            <p style={{ color: "#475569", fontSize: 16, lineHeight: 1.7, margin: "18px 0 0" }}>
              A root-level failure was contained before exposing a broken workspace. Retry the app first; if it repeats,
              share the digest and request time with the platform operator.
            </p>
            {error.digest ? (
              <pre
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  color: "#475569",
                  fontSize: 12,
                  lineHeight: 1.7,
                  marginTop: 24,
                  overflow: "auto",
                  padding: 16,
                }}
              >
                error_digest: {error.digest}
              </pre>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
              <button
                type="button"
                style={{
                  background: "#635bff",
                  border: 0,
                  borderRadius: 8,
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  minHeight: 44,
                  padding: "0 18px",
                }}
                onClick={() => unstable_retry()}
              >
                Retry app
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/?view=command";
                }}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  color: "#334155",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  minHeight: 44,
                  padding: "0 18px",
                }}
              >
                Open Command Center
              </button>
            </div>
          </section>

          <aside
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 18, lineHeight: 1.3, margin: 0 }}>Recovery status</h2>
            <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
              {statusItems.map(([label, detail]) => (
                <div
                  key={label}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
                  <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>{detail}</div>
                </div>
              ))}
            </div>
          </aside>
        </main>
        <style
          dangerouslySetInnerHTML={{
            __html:
              "@media (max-width: 860px){main[data-testid='global-error-boundary']{grid-template-columns:1fr!important;padding:24px!important}h1{font-size:30px!important}}",
          }}
        />
      </body>
    </html>
  );
}
