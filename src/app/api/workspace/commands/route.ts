import { NextRequest, NextResponse } from "next/server";

import { formatZodError, workspaceCommandInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { applyWorkspaceCommand, type WorkspaceCommand } from "@/lib/workspace-command-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = workspaceCommandInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workspace command.", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const result = applyWorkspaceCommand(workspace, parsed.data as WorkspaceCommand, {
    userId: guard.session.user.id,
    actor: guard.session.user.name,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        schema: "enterprise-ai-enablement-os.workspace-command-result.v1",
        persistence: repository.readiness(),
        commandId: result.commandId,
        ok: false,
        notification: result.notification,
        error: result.error,
      },
      { status: 400 },
    );
  }

  let saved = await repository.saveWorkspace(result.workspace);
  const sealedAuditLog = result.auditLog
    ? await repository.appendAuditLog(saved.organizationId, result.auditLog)
    : undefined;

  if (sealedAuditLog) {
    saved = await repository.saveWorkspace({
      ...saved,
      auditLogs: [sealedAuditLog, ...saved.auditLogs.filter((log) => log.id !== sealedAuditLog.id)],
    });
  }

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.workspace-command-result.v1",
    persistence: repository.readiness(),
    commandId: result.commandId,
    ok: true,
    notification: result.notification,
    auditLog: sealedAuditLog,
    result: result.result,
    rollbackToken: result.rollbackToken,
    workspace: saved,
  });
}
