import { NextRequest, NextResponse } from "next/server";

import { databaseBackupDrillInputSchema, formatZodError } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { runTenantBackupRestoreDrill } from "@/lib/database-ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "admin");
  if (!guard.ok) return guard.response;

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const organizationId = guard.session.user.organizationId;
  const [workspace, auditLogs] = await Promise.all([
    repository.getWorkspace(organizationId),
    repository.listAuditLogs(organizationId, 10000),
  ]);
  const result = await runTenantBackupRestoreDrill({
    workspace,
    auditLogs,
    repositoryMode: repository.mode,
    dryRun: true,
    writeArtifact: false,
  });
  const { snapshot: discardedSnapshot, ...manifest } = result;
  void discardedSnapshot;

  return NextResponse.json(manifest);
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "admin");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const parsed = databaseBackupDrillInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid backup drill payload.", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const organizationId = guard.session.user.organizationId;
  const [workspace, auditLogs] = await Promise.all([
    repository.getWorkspace(organizationId),
    repository.listAuditLogs(organizationId, 10000),
  ]);
  const result = await runTenantBackupRestoreDrill({
    workspace,
    auditLogs,
    repositoryMode: repository.mode,
    dryRun: parsed.data.dryRun,
  });

  if (!result.dryRun) {
    await repository.appendAuditLog(organizationId, {
      id: `database-restore-drill-${Date.now()}`,
      eventType: "database_restore_drill_verified",
      message: `Database restore drill verified for ${result.source.auditEvents} audit event(s), ${result.source.skills} skill(s), and backup digest ${result.digest.slice(0, 12)}.`,
      actor: guard.session.user.name,
      riskLevel: result.verification.auditIntegrity.verified ? "low" : "high",
      createdAt: result.generatedAt,
    });
  }

  const { snapshot: discardedSnapshot, ...manifest } = result;
  void discardedSnapshot;
  return NextResponse.json({
    ...manifest,
    persisted: !result.dryRun,
  });
}
