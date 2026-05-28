import { NextRequest, NextResponse } from "next/server";
import { connectorExecutionInputSchema, formatZodError } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { listConnectorEvents, recordConnectorEvent } from "@/lib/connector-events";
import { executeConnectorRequest } from "@/lib/connector-broker";
import type { Skill, Tool } from "@/lib/enterprise-ai-data";

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

  const result = await executeConnectorRequest({
    request: {
      organizationId: guard.session.user.organizationId,
      skill: input.skill as Skill,
      toolId: input.toolId,
      payload: input.payload,
      approved: Boolean(input.approved),
    },
    tools: input.tools as Tool[],
  });
  await recordConnectorEvent({
    id: result.id,
    organizationId: guard.session.user.organizationId,
    skillId: input.skill.id,
    toolId: input.toolId,
    status: result.status,
    decision: result.decision,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.connector-execution.v1",
    result,
  });
}
