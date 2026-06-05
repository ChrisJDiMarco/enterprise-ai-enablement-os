import { NextRequest, NextResponse } from "next/server";

import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { buildPrivacyExportPacket, privacyLifecycleConfigFromEnv } from "@/lib/privacy-lifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "privacy_reviewer");
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
  const packet = buildPrivacyExportPacket({ workspace, subjectUserId, subjectEmail });

  await repository.appendAuditLog(guard.session.user.organizationId, {
    id: `privacy-export-${Date.now()}`,
    eventType: "privacy_export_generated",
    message: `Privacy export generated for ${subjectUserId || subjectEmail || "tenant scope"}.`,
    actor: guard.session.user.name,
    riskLevel: "medium",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    lifecycle: config,
    packet,
  });
}
