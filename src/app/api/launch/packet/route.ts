import { NextRequest } from "next/server";
import { verifyAuditChain } from "@/lib/audit-integrity";
import { getRequestSession, requireRole } from "@/lib/auth";
import { listConnectorEvents, summarizeConnectorEvents } from "@/lib/connector-events";
import { buildCustomerLaunchPacket } from "@/lib/customer-launch-packet";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { buildEvidencePacket } from "@/lib/evidence-packet";
import { listEvaluationArtifacts } from "@/lib/evaluation-runner";
import {
  privateApiJson,
  privateMarkdownAttachment,
  safeAttachmentFilenameStem,
} from "@/lib/next-api-response";
import { getProductionReadiness } from "@/lib/production-readiness";
import { auditIntegrityReadinessFromVerification } from "@/lib/production-ops-readiness";
import { listTenantSecrets } from "@/lib/tenant-secret-vault";
import { listHarnessTraces, summarizeHarnessTraces } from "@/lib/trace-store";
import type { ProductionReadiness } from "@/lib/ui/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const organizationId = guard.session.user.organizationId;
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return privateApiJson(unavailable, { status: 503 });

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
    connectorEventSummary: summarizeConnectorEvents(connectorEvents),
    harnessTraceSummary: summarizeHarnessTraces(traces),
  }) as ProductionReadiness;
  const packet = buildCustomerLaunchPacket({
    workspace: fullWorkspace,
    readiness,
    evidencePacket,
    configuredSecretNames,
  });

  if (request.nextUrl.searchParams.get("format") === "markdown") {
    const attachmentFilename = `${safeAttachmentFilenameStem(
      packet.organizationName,
      "enterprise-ai-launch-packet",
    )}-launch-packet.md`;

    return privateMarkdownAttachment(packet.markdown, attachmentFilename);
  }

  return privateApiJson(packet);
}
