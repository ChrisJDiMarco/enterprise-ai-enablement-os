import { incCounter } from "./metrics.ts";
import { recordOperationalEvent } from "./observability.ts";
import { outboundUrlIssue } from "./url-safety.ts";

export type AlertSeverity = "critical" | "warning";

const DEFAULT_ALERT_DEBOUNCE_MS = 5 * 60 * 1000;
const lastFiredAt = new Map<string, number>();
const suppressedCount = new Map<string, number>();

/**
 * Fires an operational alert. Posts to ALERT_WEBHOOK_URL (PagerDuty/Slack/Sentry
 * webhook) when configured and safe, and ALWAYS records to the operational-event
 * pipeline (log drain / console) as a durable fallback. Best-effort: a failed
 * alert must never break the request that triggered it.
 */
export async function fireAlert(params: {
  organizationId: string;
  severity: AlertSeverity;
  title: string;
  detail?: string;
  route?: string;
}): Promise<void> {
  incCounter("alerts_total", { severity: params.severity });

  const webhook = process.env.ALERT_WEBHOOK_URL?.trim();
  if (webhook && !outboundUrlIssue(webhook)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      await fetch(webhook, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(process.env.ALERT_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          schema: "enterprise-ai-enablement-os.alert.v1",
          severity: params.severity,
          title: params.title,
          detail: params.detail,
          organizationId: params.organizationId,
          route: params.route,
          firedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // fall through to the operational-event record
    } finally {
      clearTimeout(timeout);
    }
  }

  await recordOperationalEvent({
    organizationId: params.organizationId,
    name: `alert.${params.severity}`,
    level: params.severity === "critical" ? "error" : "warn",
    route: params.route,
    metadata: { title: params.title, detail: params.detail },
  });
}

/**
 * Debounced alert: fires at most once per `key` per window so a sustained
 * failure (e.g. a DB outage hit on every request) pages on-call once instead of
 * flooding. The next fire after the window reports how many were suppressed.
 * Returns true if it fired, false if it was suppressed. Never throws.
 */
export async function fireAlertOnce(params: {
  key: string;
  organizationId: string;
  severity: AlertSeverity;
  title: string;
  detail?: string;
  route?: string;
  debounceMs?: number;
}): Promise<boolean> {
  const now = Date.now();
  const window = params.debounceMs ?? DEFAULT_ALERT_DEBOUNCE_MS;
  const last = lastFiredAt.get(params.key);
  if (last !== undefined && now - last < window) {
    suppressedCount.set(params.key, (suppressedCount.get(params.key) ?? 0) + 1);
    return false;
  }

  const suppressed = suppressedCount.get(params.key) ?? 0;
  lastFiredAt.set(params.key, now);
  suppressedCount.delete(params.key);

  const detail =
    suppressed > 0
      ? `${params.detail ? `${params.detail} ` : ""}(${suppressed} similar suppressed in the last ${Math.round(window / 1000)}s)`
      : params.detail;

  try {
    await fireAlert({
      organizationId: params.organizationId,
      severity: params.severity,
      title: params.title,
      detail,
      route: params.route,
    });
  } catch {
    // Alerting is best-effort and must never break the caller.
  }
  return true;
}

/** Test seam — clears the per-key debounce state. */
export function __resetAlertDebounceForTests() {
  lastFiredAt.clear();
  suppressedCount.clear();
}
