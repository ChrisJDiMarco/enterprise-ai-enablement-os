import { NextRequest } from "next/server";
import { getRequestSession, requireRole } from "@/lib/auth";
import { listConnectorEvents } from "@/lib/connector-events";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { buildEvidencePacket } from "@/lib/evidence-packet";
import { listEvaluationArtifacts } from "@/lib/evaluation-runner";
import {
  privateApiJson,
  privateMarkdownAttachment,
  safeAttachmentFilenameStem,
} from "@/lib/next-api-response";
import { listHarnessTraces } from "@/lib/trace-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const organizationId = guard.session.user.organizationId;
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return privateApiJson(unavailable, { status: 503 });

  const [workspace, traces, evalArtifacts, connectorEvents, auditLogs] = await Promise.all([
    repository.getWorkspace(organizationId),
    listHarnessTraces(organizationId, 500),
    listEvaluationArtifacts(organizationId, 500),
    listConnectorEvents(organizationId, 500),
    repository.listAuditLogs(organizationId, 1000),
  ]);
  const packet = buildEvidencePacket({
    workspace: { ...workspace, auditLogs: auditLogs.length ? auditLogs : workspace.auditLogs },
    traces,
    evalArtifacts,
    connectorEvents,
  });

  if (request.nextUrl.searchParams.get("format") === "markdown") {
    const attachmentFilename = `${safeAttachmentFilenameStem(
      organizationId,
      "enterprise-ai-evidence-packet",
    )}-evidence-packet.md`;

    return privateMarkdownAttachment(packet.markdown, attachmentFilename);
  }

  return privateApiJson(packet);
}
