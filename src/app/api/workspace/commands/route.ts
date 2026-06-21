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

  // Atomic read-modify-write: applying the command against the freshest state
  // under a per-tenant lock prevents concurrent editors from clobbering each other.
  const outcome = await repository.mutateWorkspace(guard.session.user.organizationId, (workspace) => {
    const result = applyWorkspaceCommand(workspace, parsed.data as WorkspaceCommand, {
      userId: guard.session.user.id,
      actor: guard.session.user.name,
    });
    if (!result.ok) {
      return { commit: false as const, result };
    }
    return { commit: true as const, workspace: result.workspace, result, auditLog: result.auditLog };
  });

  const result = outcome.result;

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

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.workspace-command-result.v1",
    persistence: repository.readiness(),
    commandId: result.commandId,
    ok: true,
    notification: result.notification,
    auditLog: outcome.auditLog,
    result: result.result,
    rollbackToken: result.rollbackToken,
    workspace: outcome.workspace,
  });
}
