import { NextRequest, NextResponse } from "next/server";
import { formatZodError, orchestratorChatInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { currentMonthRunSpend, evaluateModelBudget } from "@/lib/model-budget";
import { recordOperationalEvent } from "@/lib/observability";
import { buildServerAISettingsForOrganization } from "@/lib/server-ai-settings";
import { planOrchestratorChat } from "@/lib/orchestrator-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = orchestratorChatInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Orchestrator chat payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  const input = parsed.data;
  const settings = await buildServerAISettingsForOrganization(
    guard.session.user.organizationId,
    input.routingSettings ?? {},
  );
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });
  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const plan = await planOrchestratorChat({
    message: input.message,
    history: input.history,
    workspace: input.workspace,
    settings,
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
      actionCount: plan.actions.length,
      autoActionCount: plan.autoActions.length,
      budgetStatus: budget.status,
      estimatedRunCostUsd: budget.estimatedRunCostUsd,
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
    plan,
    budget,
  });
}
