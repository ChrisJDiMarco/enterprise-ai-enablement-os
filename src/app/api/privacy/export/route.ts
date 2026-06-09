import { NextRequest, NextResponse } from "next/server";

import { canAccess, getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { buildPrivacyExportPacket, privacyLifecycleConfigFromEnv } from "@/lib/privacy-lifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getRequestSession();
  const guard = requireRole(session, "privacy_reviewer");
  if (!guard.ok) return guard.response;

  const config = privacyLifecycleConfigFromEnv();
  if (process.env.NODE_ENV === "production" && !config.exportEnabled && !config.requestWorkflowUrl) {
    return NextResponse.json(
      {
        error: "Privacy export is not enabled.",
        reason: config.reason,
        required: ["PRIVACY_EXPORT_ENABLED", "PRIVACY_REQUEST_WORKFLOW_URL", "DATA_RETENTION_DAYS"],
      },
      { status: 403 },
    );
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const url = new URL(request.url);
  const subjectUserId = url.searchParams.get("userId")?.trim() || undefined;
  const subjectEmail = url.searchParams.get("email")?.trim() || undefined;
  const scope = url.searchParams.get("scope")?.trim().toLowerCase();

  if (scope === "tenant" && (subjectUserId || subjectEmail)) {
    return NextResponse.json(
      {
        error: "Privacy export scope is ambiguous.",
        reason: "Use userId or email for a subject export, or scope=tenant without subject identifiers for a tenant-wide export.",
        required: ["userId or email", "scope=tenant"],
      },
      { status: 400 },
    );
  }

  if (!subjectUserId && !subjectEmail && scope !== "tenant") {
    return NextResponse.json(
      {
        error: "Privacy export requires a subject.",
        reason: "Provide userId or email for a data-subject export. Use scope=tenant for an explicit tenant-wide export.",
        required: ["userId", "email", "scope=tenant"],
      },
      { status: 400 },
    );
  }

  if (scope === "tenant" && !canAccess(session, "admin")) {
    return NextResponse.json(
      {
        error: "Tenant-wide privacy export requires admin access.",
        reason: "Privacy reviewers can export a named data subject; only admins can request tenant-wide privacy export packets.",
        requiredRole: "admin",
      },
      { status: 403 },
    );
  }

  const packet = buildPrivacyExportPacket({ workspace, subjectUserId, subjectEmail });
  const auditSubject = packet.scope === "tenant" ? "tenant scope" : `subject hash ${packet.subject.hash.slice(0, 12)}`;

  await repository.appendAuditLog(guard.session.user.organizationId, {
    id: `privacy-export-${Date.now()}`,
    eventType: "privacy_export_generated",
    message: `Privacy export generated for ${auditSubject}.`,
    actor: guard.session.user.name,
    riskLevel: packet.scope === "tenant" ? "high" : "medium",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    lifecycle: config,
    packet,
  });
}
