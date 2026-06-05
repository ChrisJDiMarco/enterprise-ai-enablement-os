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

  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#f8fafc",
          color: "#0f172a",
          display: "flex",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: 24,
        }}
      >
        <main
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 20px 70px rgba(15,23,42,0.12)",
            maxWidth: 560,
            padding: 32,
            width: "100%",
          }}
        >
          <title>Enterprise AI Enablement OS Recovery</title>
          <p
            style={{
              color: "#4f46e5",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.14em",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Global recovery
          </p>
          <h1 style={{ fontSize: 28, lineHeight: 1.2, margin: "16px 0 0" }}>
            Enterprise AI Enablement OS needs a clean reload
          </h1>
          <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.7, margin: "16px 0 0" }}>
            A root-level failure was contained before exposing a broken workspace. Retry the app, or return to the
            Command Center from a fresh session.
          </p>
          {error.digest ? (
            <pre
              style={{
                background: "#f8fafc",
                borderRadius: 8,
                color: "#475569",
                fontSize: 12,
                marginTop: 20,
                overflow: "auto",
                padding: 16,
              }}
            >
              error_digest: {error.digest}
            </pre>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
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
              Retry
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
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
        </main>
      </body>
    </html>
  );
}
