import { recordOperationalEvent } from "./lib/observability.ts";

/**
 * Next.js startup hook (runs once per server instance, before the server accepts
 * requests). Fails fast on fatal production misconfiguration so we never serve
 * traffic with a forgeable session secret or a guessable tenant-vault key.
 */
export async function register(): Promise<void> {
  // Only the Node.js server runtime can/should hard-exit; skip Edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionStartup } = await import("./lib/startup-validation.ts");
  assertProductionStartup();

  // Node-only process safety nets (kept out of the Edge bundle via dynamic import).
  const { installServerProcessHandlers } = await import("./lib/server-process-handlers.ts");
  installServerProcessHandlers();
}

/**
 * Next.js error instrumentation. Server errors (route handlers, Server Components,
 * actions) were previously unobserved — they vanished. This forwards them to the
 * existing operational-event pipeline (LOG_DRAIN_URL when configured, else
 * structured console), giving on-call real error capture without a new SDK.
 *
 * The operational-event layer already sanitizes PII/secrets before emission.
 */
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routeType?: string; routerKind?: string },
): Promise<void> {
  const err = error as { message?: unknown; digest?: unknown } | null;
  await recordOperationalEvent({
    organizationId: "platform",
    name: "server.request.error",
    level: "error",
    route: typeof request?.path === "string" ? request.path : undefined,
    metadata: {
      method: typeof request?.method === "string" ? request.method : undefined,
      routeType: typeof context?.routeType === "string" ? context.routeType : undefined,
      digest: err && typeof err.digest === "string" ? err.digest : undefined,
      // Not keyed "message" — that key is auto-redacted; the value is still
      // scrubbed for secret/PII patterns by the operational-event sanitizer.
      errorSummary: err && typeof err.message === "string" ? err.message : "Server error",
    },
  });
}
