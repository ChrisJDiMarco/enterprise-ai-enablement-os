import { NextRequest, NextResponse } from "next/server";
import { formatZodError, harnessRunInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { currentMonthRunSpend } from "@/lib/model-budget";
import { recordOperationalEvent } from "@/lib/observability";
import { buildServerAISettingsForOrganization } from "@/lib/server-ai-settings";
import { runServerHarnessSkill } from "@/lib/server-harness-runtime";
import { recordHarnessTrace } from "@/lib/trace-store";
import type { Skill, Tool } from "@/lib/enterprise-ai-data";

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
  const runId = body.runId || `run-${Date.now()}`;
  const timestamp = body.timestamp || new Date().toISOString();

  const result = await runServerHarnessSkill({
    skill: body.skill as Skill,
    tools: (Array.isArray(body.tools) ? body.tools : []) as Tool[],
    settings,
    triggeredBy: body.triggeredBy || guard.session.user.name,
    timestamp,
    runId,
    toolRequestId: body.toolRequestId || `tr-${Date.now()}`,
    message: body.message,
    currentMonthlySpendUsd: currentMonthRunSpend(workspace.runs),
  });
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
    result,
    traceRecord,
  });
}
