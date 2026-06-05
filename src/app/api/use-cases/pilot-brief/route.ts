import { NextRequest, NextResponse } from "next/server";

import { formatZodError, useCasePilotBriefGenerateInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { generateWithModelProvider } from "@/lib/model-provider";
import {
  buildDeterministicPilotBrief,
  buildPilotBriefSourcePacket,
  buildPilotBriefSystemPrompt,
  buildPilotBriefUserPrompt,
  cleanGeneratedPilotBrief,
} from "@/lib/pilot-brief-generator";
import { buildServerAISettingsForOrganization } from "@/lib/server-ai-settings";
import { normalizeWorkspace, type EnterpriseWorkspace } from "@/lib/workspace-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = useCasePilotBriefGenerateInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pilot brief generation payload.", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const currentWorkspace = await repository.getWorkspace(guard.session.user.organizationId);
  const workspace = normalizeWorkspace(
    parsed.data.workspace
      ? {
          ...currentWorkspace,
          ...parsed.data.workspace,
          organizationId: currentWorkspace.organizationId,
        } as Partial<EnterpriseWorkspace>
      : currentWorkspace,
    guard.session.user.organizationId,
  );
  const useCase = workspace.useCases.find((item) => item.id === parsed.data.useCaseId);

  if (!useCase) {
    return NextResponse.json(
      {
        error: "Use case not found.",
        details: [{ path: "useCaseId", message: "The selected use case does not exist in the workspace." }],
      },
      { status: 404 },
    );
  }

  const settings = await buildServerAISettingsForOrganization(
    guard.session.user.organizationId,
    parsed.data.routingSettings ?? {},
  );
  const deterministicBrief = buildDeterministicPilotBrief(useCase);
  const sourcePacket = buildPilotBriefSourcePacket(useCase);
  const generated = await generateWithModelProvider({
    settings,
    lane: "reasoning",
    system: buildPilotBriefSystemPrompt(),
    user: buildPilotBriefUserPrompt({ sourcePacket, deterministicBrief }),
    temperature: 0.25,
    maxTokens: 2200,
  });

  const brief = generated.localFallback
    ? deterministicBrief
    : cleanGeneratedPilotBrief(generated.text, deterministicBrief);
  const mode = generated.localFallback ? "deterministic_fallback" : "ai_assisted";
  const now = new Date().toISOString();
  const auditLog = {
    id: `audit-pilot-brief-${Date.now()}`,
    eventType: "output_generated",
    message:
      mode === "ai_assisted"
        ? `${useCase.title} pilot brief generated with ${generated.route.modelRef}.`
        : `${useCase.title} pilot brief generated from deterministic workspace data fallback.`,
    actor: "Use Case Factory",
    riskLevel: useCase.riskLevel,
    createdAt: now,
  };

  let saved = await repository.saveWorkspace({
    ...workspace,
    updatedAt: now,
  });
  const sealedAudit = await repository.appendAuditLog(saved.organizationId, auditLog);
  saved = await repository.saveWorkspace({
    ...saved,
    auditLogs: [sealedAudit, ...saved.auditLogs.filter((log) => log.id !== sealedAudit.id)],
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.pilot-brief-generation.v1",
    generatedAt: now,
    useCaseId: useCase.id,
    brief,
    mode,
    auditLog: sealedAudit,
    model: {
      provider: generated.route.provider,
      model: generated.route.model,
      modelRef: generated.route.modelRef,
      routeReason: generated.route.reason,
      localFallback: generated.localFallback,
      finishReason: generated.finishReason,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      latencyMs: generated.latencyMs,
    },
    evidence: {
      sourcePacket,
      workspaceUseCases: workspace.useCases.length,
    },
    workspace: saved,
  });
}
