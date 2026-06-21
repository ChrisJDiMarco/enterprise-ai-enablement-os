import { recordOperationalEvent } from "./lib/observability.ts";

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
