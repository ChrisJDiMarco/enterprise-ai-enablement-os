import { NextRequest, NextResponse } from "next/server";
import { connectorExecutionInputSchema, formatZodError } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { listConnectorEvents, recordConnectorEvent } from "@/lib/connector-events";
import { executeConnectorRequest } from "@/lib/connector-broker";
import { getDatabasePool, getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { withIdempotency } from "@/lib/idempotency";
import { recordOperationalEvent } from "@/lib/observability";
import { resolveWorkspaceSkillForRuntime, resolveWorkspaceToolForRuntime } from "@/lib/workspace-runtime-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const events = await listConnectorEvents(guard.session.user.organizationId, 250);
  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.connector-events.v1",
    events,
  });
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = connectorExecutionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid connector execution payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const requestedSkillId = input.skillId ?? input.skill?.id;
  const skillResolution = resolveWorkspaceSkillForRuntime(workspace, requestedSkillId);
  if (!skillResolution.ok) {
    return NextResponse.json(
      { error: skillResolution.error, code: skillResolution.code },
      { status: skillResolution.status },
    );
  }
  const toolResolution = resolveWorkspaceToolForRuntime(workspace, input.toolId);
  if (!toolResolution.ok) {
    return NextResponse.json(
      { error: toolResolution.error, code: toolResolution.code },
      { status: toolResolution.status },
    );
  }

  // The actual side-effecting execution + its evidence records. Wrapped in
  // idempotency so a client/network retry with the same key never re-executes.
  const executeAndRecord = async () => {
    const result = await executeConnectorRequest({
      request: {
        organizationId: guard.session.user.organizationId,
        skill: skillResolution.skill,
        toolId: toolResolution.tool.id,
        payload: input.payload,
        actor: guard.session.user.name,
        approved: Boolean(input.approved),
        approvalId: input.approvalId,
        idempotencyKey: input.idempotencyKey,
      },
      tools: workspace.tools,
    });
    await recordConnectorEvent({
      id: result.id,
      organizationId: guard.session.user.organizationId,
      skillId: skillResolution.skill.id,
      toolId: toolResolution.tool.id,
      status: result.status,
      decision: result.decision,
      payload: result.envelope.payloadPreview,
      envelope: result.envelope,
      createdAt: new Date().toISOString(),
    });
    await recordOperationalEvent({
      organizationId: guard.session.user.organizationId,
      name: "connector.execution.completed",
      level: result.status === "blocked" ? "warn" : "info",
      route: "/api/connectors/execute",
      actor: guard.session.user.name,
      metadata: {
        executionId: result.id,
        toolId: toolResolution.tool.id,
        skillId: skillResolution.skill.id,
        status: result.status,
        brokerMode: result.brokerMode,
        policyId: result.decision.policyId,
        policyStatus: result.decision.status,
        payloadDigest: result.envelope.payloadDigest,
        idempotencyKey: result.envelope.idempotencyKey,
        approvalApproved: result.envelope.approval.approved,
      },
    });
    return result;
  };

  const pool = getDatabasePool();
  let result: Awaited<ReturnType<typeof executeAndRecord>>;
  let replayed = false;
  if (input.idempotencyKey && pool) {
    const outcome = await withIdempotency(
      pool,
      { organizationId: guard.session.user.organizationId, scope: "connectors.execute", key: input.idempotencyKey },
      executeAndRecord,
    );
    result = outcome.result;
    replayed = outcome.replayed;
  } else {
    result = await executeAndRecord();
  }

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.connector-execution.v1",
    result,
    replayed,
  });
}
