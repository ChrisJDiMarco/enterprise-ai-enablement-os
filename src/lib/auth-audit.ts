import { getWorkspaceRepository } from "./database.ts";
import type { AuditLog } from "./enterprise-ai-data.ts";

export type AuthAuditEventType = "auth_login" | "auth_login_failed" | "auth_logout";

/**
 * Records an authentication event to the tamper-evident audit ledger. Auth
 * (login/logout/failed) produced no audit trail before — a SOC 2 / access-review
 * gap. This is best-effort: authentication must never fail because audit logging
 * did, so all errors are swallowed.
 */
export async function recordAuthAuditEvent(params: {
  organizationId: string;
  eventType: AuthAuditEventType;
  message: string;
  actor: string;
  riskLevel?: AuditLog["riskLevel"];
}): Promise<void> {
  try {
    const repository = getWorkspaceRepository();
    if (!repository.readiness().configured) return;
    await repository.appendAuditLog(params.organizationId, {
      id: `audit-${params.eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventType: params.eventType,
      message: params.message,
      actor: params.actor,
      riskLevel: params.riskLevel ?? "low",
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Best-effort only — never block auth on audit failure.
  }
}
