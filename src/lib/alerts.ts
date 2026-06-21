import { incCounter } from "./metrics.ts";
import { recordOperationalEvent } from "./observability.ts";
import { outboundUrlIssue } from "./url-safety.ts";

export type AlertSeverity = "critical" | "warning";

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
