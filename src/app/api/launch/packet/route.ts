import { NextRequest, NextResponse } from "next/server";
import { verifyAuditChain } from "@/lib/audit-integrity";
import { getRequestSession, requireRole } from "@/lib/auth";
import { listConnectorEvents } from "@/lib/connector-events";
import { buildCustomerLaunchPacket } from "@/lib/customer-launch-packet";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { buildEvidencePacket } from "@/lib/evidence-packet";
import { listEvaluationArtifacts } from "@/lib/evaluation-runner";
import { getProductionReadiness } from "@/lib/production-readiness";
import { auditIntegrityReadinessFromVerification } from "@/lib/production-ops-readiness";
import { listTenantSecrets } from "@/lib/tenant-secret-vault";
import { listHarnessTraces } from "@/lib/trace-store";
import type { ProductionReadiness } from "@/lib/ui/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function filename(value: string) {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return safe || "enterprise-ai-launch-packet";
}

export async function GET(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const organizationId = guard.session.user.organizationId;
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const [workspace, traces, evalArtifacts, connectorEvents, auditLogs, configuredSecretNames] = await Promise.all([
    repository.getWorkspace(organizationId),
    listHarnessTraces(organizationId, 500),
    listEvaluationArtifacts(organizationId, 500),
    listConnectorEvents(organizationId, 500),
    repository.listAuditLogs(organizationId, 10000),
    listTenantSecrets(organizationId)
      .then((secrets) => secrets.map((secret) => secret.name))
      .catch(() => []),
  ]);
  const fullWorkspace = { ...workspace, auditLogs: auditLogs.length ? auditLogs : workspace.auditLogs };
  const evidencePacket = buildEvidencePacket({
    workspace: fullWorkspace,
    traces,
    evalArtifacts,
    connectorEvents,
  });
  const readiness = getProductionReadiness({
    configuredSecretNames,
    auditIntegrity: auditIntegrityReadinessFromVerification(verifyAuditChain(organizationId, fullWorkspace.auditLogs)),
  }) as ProductionReadiness;
  const packet = buildCustomerLaunchPacket({
    workspace: fullWorkspace,
    readiness,
    evidencePacket,
  });

  if (request.nextUrl.searchParams.get("format") === "markdown") {
    return new NextResponse(packet.markdown, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename(packet.organizationName)}-launch-packet.md"`,
      },
    });
  }

  return NextResponse.json(packet, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
