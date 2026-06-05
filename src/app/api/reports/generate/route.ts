import { NextRequest, NextResponse } from "next/server";

import { formatZodError, reportGenerateInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { generateWithModelProvider } from "@/lib/model-provider";
import { buildServerAISettingsForOrganization } from "@/lib/server-ai-settings";
import {
  buildDeterministicReport,
  buildReportMetrics,
  buildReportSourcePacket,
  buildReportSystemPrompt,
  buildReportUserPrompt,
  normalizeReportTemplate,
  reportTemplateById,
} from "@/lib/report-generator";
import { normalizeWorkspace, type EnterpriseWorkspace } from "@/lib/workspace-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  triage: "Triage",
  discovery: "Discovery",
  scored: "Scored",
  governance_review: "Governance Review",
  approved_for_pilot: "Approved for Pilot",
  in_pilot: "In Pilot",
  measuring: "Measuring",
  scaled: "Scaled",
  parked: "Parked",
  rejected: "Rejected",
  in_review: "In Review",
  approved: "Approved",
  pilot: "Pilot",
  production: "Production",
  deprecated: "Deprecated",
  archived: "Archived",
  changes_requested: "Changes Requested",
  approved_with_conditions: "Approved with Conditions",
  not_submitted: "Not Submitted",
};

function cleanGeneratedReport(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed || !/^#\s+/m.test(trimmed)) return fallback;
  return trimmed
    .replace(/^```(?:markdown)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = reportGenerateInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report generation payload.", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const templateId = normalizeReportTemplate(parsed.data.template);
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
  const settings = await buildServerAISettingsForOrganization(
    guard.session.user.organizationId,
    parsed.data.routingSettings ?? {},
  );
  const metrics = buildReportMetrics({
    useCases: workspace.useCases,
    skills: workspace.skills,
    governanceReviews: workspace.governanceReviews,
  });
  const deterministicReport = buildDeterministicReport({
    templateId,
    useCases: workspace.useCases,
    skills: workspace.skills,
    governanceReviews: workspace.governanceReviews,
    workSignals: workspace.workSignals,
    metrics,
    statusLabels,
  });
  const sourcePacket = buildReportSourcePacket({
    templateId,
    useCases: workspace.useCases,
    skills: workspace.skills,
    governanceReviews: workspace.governanceReviews,
    workSignals: workspace.workSignals,
    metrics,
    statusLabels,
  });

  const generated = await generateWithModelProvider({
    settings,
    lane: "summarization",
    system: buildReportSystemPrompt(),
    user: buildReportUserPrompt({ sourcePacket, deterministicReport }),
    temperature: 0.2,
    maxTokens: 2400,
  });

  const report = generated.localFallback
    ? deterministicReport
    : cleanGeneratedReport(generated.text, deterministicReport);
  const mode = generated.localFallback ? "deterministic_fallback" : "ai_assisted";
  const now = new Date().toISOString();
  const template = reportTemplateById(templateId);
  const auditLog = {
    id: `audit-report-${Date.now()}`,
    eventType: "output_generated",
    message:
      mode === "ai_assisted"
        ? `${template.title} generated with ${generated.route.modelRef}.`
        : `${template.title} generated from deterministic workspace data fallback.`,
    actor: "Reports Studio",
    riskLevel: "low" as const,
    createdAt: now,
  };

  let saved = await repository.saveWorkspace({
    ...workspace,
    report,
    updatedAt: now,
  });
  const sealedAudit = await repository.appendAuditLog(saved.organizationId, auditLog);
  saved = await repository.saveWorkspace({
    ...saved,
    auditLogs: [sealedAudit, ...saved.auditLogs.filter((log) => log.id !== sealedAudit.id)],
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.report-generation.v1",
    generatedAt: now,
    template,
    report,
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
      useCases: workspace.useCases.length,
      skills: workspace.skills.length,
      governanceReviews: workspace.governanceReviews.length,
      workSignals: workspace.workSignals.length,
      metrics,
    },
    workspace: saved,
  });
}
