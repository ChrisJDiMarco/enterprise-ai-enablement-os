import { NextRequest, NextResponse } from "next/server";
import { formatZodError, harnessRunInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { mergeServerHarnessResultIntoWorkspace } from "@/lib/harness-workspace-persistence";
import { currentMonthRunSpend } from "@/lib/model-budget";
import { recordOperationalEvent } from "@/lib/observability";
import { buildServerAISettingsForOrganization } from "@/lib/server-ai-settings";
import { runServerHarnessSkill } from "@/lib/server-harness-runtime";
import { recordHarnessTrace } from "@/lib/trace-store";
import { resolveWorkspaceContextSourcesForRuntime, resolveWorkspaceSkillForRuntime } from "@/lib/workspace-runtime-policy";
import { retrieveContextWithIndex } from "@/lib/context-index";
import type { RetrievalResult } from "@/lib/context-retrieval";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const rawBody = await request.json().catch(() => null);
  if (!rawBody) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = harnessRunInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Harness run payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  const body = parsed.data;
  const settings = await buildServerAISettingsForOrganization(
    guard.session.user.organizationId,
    body.routingSettings ?? {},
  );
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });
  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const requestedSkillId = body.skillId ?? body.skill?.id;
  const skillResolution = resolveWorkspaceSkillForRuntime(workspace, requestedSkillId);
  if (!skillResolution.ok) {
    return NextResponse.json(
      { error: skillResolution.error, code: skillResolution.code },
      { status: skillResolution.status },
    );
  }
  const runId = body.runId || `run-${Date.now()}`;
  const timestamp = body.timestamp || new Date().toISOString();

  // Retrieve grounding from the Skill's approved, indexed context sources so the
  // model actually answers FROM that context. Best-effort: a retrieval failure
  // must not block the run (the runtime simply has no grounding passages).
  let retrievedContext: RetrievalResult[] = [];
  try {
    const contextSources = resolveWorkspaceContextSourcesForRuntime(workspace, skillResolution.skill);
    const retrieval = await retrieveContextWithIndex({
      organizationId: guard.session.user.organizationId,
      skill: skillResolution.skill,
      sources: contextSources.sources,
      query: body.message || skillResolution.skill.name,
      limit: 5,
    });
    retrievedContext = retrieval.results;
  } catch {
    retrievedContext = [];
  }

  // Slow model/provider work runs OUTSIDE the workspace lock.
  const result = await runServerHarnessSkill({
    skill: skillResolution.skill,
    tools: workspace.tools,
    settings,
    triggeredBy: body.triggeredBy || guard.session.user.name,
    timestamp,
    runId,
    toolRequestId: body.toolRequestId || `tr-${Date.now()}`,
    message: body.message,
    currentMonthlySpendUsd: currentMonthRunSpend(workspace.runs),
    retrievedContext,
  });

  // Merge the run evidence into the freshest workspace state + seal the audit
  // event atomically under a per-tenant lock so concurrent runs can't clobber.
  const outcome = await repository.mutateWorkspace<
    ReturnType<typeof mergeServerHarnessResultIntoWorkspace>
  >(guard.session.user.organizationId, (current) => {
    const workspacePersistence = mergeServerHarnessResultIntoWorkspace({
      workspace: current,
      result,
      actor: body.triggeredBy || guard.session.user.name,
    });
    return {
      commit: true as const,
      workspace: workspacePersistence.workspace,
      result: workspacePersistence,
      auditLog: workspacePersistence.auditLog,
    };
  });
  const workspacePersistence = outcome.result;
  const auditLog = outcome.auditLog!;
  const traceRecord = await recordHarnessTrace(guard.session.user.organizationId, result);
  await recordOperationalEvent({
    organizationId: guard.session.user.organizationId,
    name: "harness.run.completed",
    level: result.run.status === "blocked" ? "warn" : "info",
    route: "/api/harness/run",
    actor: guard.session.user.name,
    metadata: {
      runId: result.run.id,
      skillId: result.run.skillId,
      status: result.run.status,
      route: result.route.modelRef,
      budgetStatus: result.budget.status,
      estimatedCostUsd: result.model.estimatedCostUsd,
    },
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.harness-run-result.v1",
    generatedAt: new Date().toISOString(),
    executionMode: result.model.localFallback ? "server-local-fallback" : "server-provider",
    workspaceUpdated: true,
    workspaceRecord: {
      runId: result.run.id,
      runInserted: workspacePersistence.runInserted,
      toolRequestId: result.toolRequest?.id,
      toolRequestInserted: workspacePersistence.toolRequestInserted,
      auditLogId: auditLog.id,
    },
    result,
    traceRecord,
  });
}
