import { NextRequest, NextResponse } from "next/server";
import { formatZodError, orchestratorChatInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { currentMonthRunSpend, evaluateModelBudget } from "@/lib/model-budget";
import { recordOperationalEvent } from "@/lib/observability";
import { fireAlert } from "@/lib/alerts";
import { incCounter, observe } from "@/lib/metrics";
import { buildServerAISettingsForOrganization } from "@/lib/server-ai-settings";
import { buildEmergencyOrchestratorPlan, planOrchestratorChat } from "@/lib/orchestrator-runtime";
import { deriveTrustedOrchestratorWorkspaceContext } from "@/lib/orchestrator-workspace-context";
import { getProductionReadiness } from "@/lib/production-readiness";
import { loadTenantReadinessContext } from "@/lib/tenant-readiness-context";
import { privateResponseHeaders } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: privateResponseHeaders() });
  }

  const parsed = orchestratorChatInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Orchestrator chat payload.", details: formatZodError(parsed.error) },
      { status: 400, headers: privateResponseHeaders() },
    );
  }

  const input = parsed.data;
  const settings = await buildServerAISettingsForOrganization(
    guard.session.user.organizationId,
    input.routingSettings ?? {},
  );
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503, headers: privateResponseHeaders() });
  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const tenantReadiness = await loadTenantReadinessContext({
    session: guard.session,
    deps: { repository },
  });
  const productionReadiness = getProductionReadiness(tenantReadiness.options);
  const trustedWorkspaceContext = deriveTrustedOrchestratorWorkspaceContext({
    workspace,
    productionReadiness,
    currentUserRole: guard.session.user.role,
    selectedSkillId: input.selectedSkillId,
    selectedRunId: input.selectedRunId,
  });
  const plan = await planOrchestratorChat({
    message: input.message,
    history: input.history,
    workspace: trustedWorkspaceContext,
    settings,
  }).catch(async () => {
    const fallback = buildEmergencyOrchestratorPlan({
      message: input.message,
      workspace: trustedWorkspaceContext,
      finishReason: "route_planner_exception",
    });
    await recordOperationalEvent({
      organizationId: guard.session.user.organizationId,
      name: "orchestrator.chat.planner_error",
      level: "error",
      route: "/api/orchestrator/chat",
      actor: guard.session.user.name,
      metadata: {
        fallbackModel: fallback.model.modelRef,
        selectedSkillId: input.selectedSkillId ?? null,
        selectedRunId: input.selectedRunId ?? null,
      },
    });
    return fallback;
  });
  const budget = evaluateModelBudget({
    settings,
    route: {
      provider: plan.model.provider,
      model: plan.model.model,
      modelRef: plan.model.modelRef,
      fallbackUsed: plan.model.localFallback,
      reason: plan.model.routeReason,
    },
    inputTokens: plan.model.inputTokens,
    outputTokens: plan.model.outputTokens,
    currentMonthlySpendUsd: currentMonthRunSpend(workspace.runs),
  });
  const responsePlan =
    budget.status === "block"
      ? {
          ...plan,
          autoActions: [],
          evidence: [
            ...plan.evidence,
            { label: "Budget", value: "blocked" },
          ].slice(0, 9),
        }
      : plan;

  observe("model_generation_latency_ms", plan.model.latencyMs, {
    provider: plan.model.provider,
    lane: "workflow",
  });
  incCounter("orchestrator_requests_total", { budget: budget.status, local_fallback: String(plan.model.localFallback) });
  if (budget.status === "block") {
    await fireAlert({
      organizationId: guard.session.user.organizationId,
      severity: "warning",
      title: "Model budget exceeded — orchestrator request blocked",
      detail: `Estimated run cost $${budget.estimatedRunCostUsd} would exceed the configured monthly budget.`,
      route: "/api/orchestrator/chat",
    });
  }

  await recordOperationalEvent({
    organizationId: guard.session.user.organizationId,
    name: "orchestrator.chat.planned",
    level: budget.status === "block" ? "warn" : "info",
    route: "/api/orchestrator/chat",
    actor: guard.session.user.name,
    metadata: {
      provider: plan.model.provider,
      model: plan.model.model,
      localFallback: plan.model.localFallback,
      actionCount: responsePlan.actions.length,
      autoActionCount: responsePlan.autoActions.length,
      budgetStatus: budget.status,
      estimatedRunCostUsd: budget.estimatedRunCostUsd,
      selectedSkillId: input.selectedSkillId ?? null,
      selectedRunId: input.selectedRunId ?? null,
    },
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.orchestrator-plan.v1",
    generatedAt: new Date().toISOString(),
    session: {
      userId: guard.session.user.id,
      organizationId: guard.session.user.organizationId,
      role: guard.session.user.role,
    },
    plan: responsePlan,
    budget,
  }, { headers: privateResponseHeaders() });
}
