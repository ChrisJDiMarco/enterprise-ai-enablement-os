import { NextResponse } from "next/server";
import { deriveAgentControlPlane } from "@/lib/agent-control-plane";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { getEnterpriseConnectorReadiness } from "@/lib/enterprise-connectors";
import { listTenantSecrets } from "@/lib/tenant-secret-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const organizationId = guard.session.user.organizationId;
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const [workspace, auditLogs, configuredSecretNames] = await Promise.all([
    repository.getWorkspace(organizationId),
    repository.listAuditLogs(organizationId, 1000),
    listTenantSecrets(organizationId)
      .then((secrets) => secrets.map((secret) => secret.name))
      .catch(() => []),
  ]);

  const controlPlane = deriveAgentControlPlane({
    skills: workspace.skills,
    runs: workspace.runs,
    toolRequests: workspace.toolRequests,
    auditLogs: auditLogs.length ? auditLogs : workspace.auditLogs,
    contextSources: workspace.contextSources,
    connectorReadiness: getEnterpriseConnectorReadiness(process.env, configuredSecretNames),
  });

  return NextResponse.json({
    ...controlPlane,
    organizationId,
    generatedAt: new Date().toISOString(),
    privacyBoundary:
      "Signals are derived from governed runtime metadata, connector decisions, and audit records. Raw employee messages are not required for this control plane.",
  });
}
