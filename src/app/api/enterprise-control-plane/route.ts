import { NextRequest } from "next/server";

import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import {
  buildEnterpriseAiControlPlaneResponse,
  formatEnterpriseAiControlPlaneMarkdown,
} from "@/lib/enterprise-ai-control-plane-response";
import { privateApiJson, privateMarkdownAttachment, safeAttachmentFilenameStem } from "@/lib/next-api-response";
import { listTenantSecrets } from "@/lib/tenant-secret-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const organizationId = guard.session.user.organizationId;
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return privateApiJson(unavailable, { status: 503 });

  const [workspace, auditLogs, configuredSecretNames] = await Promise.all([
    repository.getWorkspace(organizationId),
    repository.listAuditLogs(organizationId, 1000),
    listTenantSecrets(organizationId)
      .then((secrets) => secrets.map((secret) => secret.name))
      .catch(() => []),
  ]);
  const payload = buildEnterpriseAiControlPlaneResponse({
    workspace,
    auditLogs,
    configuredSecretNames,
  });

  if (request.nextUrl.searchParams.get("format") === "markdown") {
    const attachmentFilename = `${safeAttachmentFilenameStem(
      payload.organization.name,
      "enterprise-ai-control-plane",
    )}-enterprise-ai-control-plane.md`;

    return privateMarkdownAttachment(formatEnterpriseAiControlPlaneMarkdown(payload), attachmentFilename);
  }

  return privateApiJson(payload);
}
