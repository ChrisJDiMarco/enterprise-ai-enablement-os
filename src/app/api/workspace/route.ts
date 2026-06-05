import { NextRequest, NextResponse } from "next/server";
import { formatZodError, workspaceInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { EnterpriseWorkspace, normalizeWorkspace } from "@/lib/workspace-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const auditLogs = await repository.listAuditLogs(guard.session.user.organizationId, 500);
  const auditById = new Map([...workspace.auditLogs, ...auditLogs].map((log) => [log.id, log]));

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.workspace-response.v1",
    persistence: repository.readiness(),
    workspace: {
      ...workspace,
      auditLogs: Array.from(auditById.values()).sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      ),
    },
  });
}

export async function PUT(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = workspaceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workspace payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = normalizeWorkspace(parsed.data as Partial<EnterpriseWorkspace>, guard.session.user.organizationId);
  const saved = await repository.saveWorkspace(workspace);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.workspace-response.v1",
    persistence: repository.readiness(),
    workspace: saved,
  });
}
