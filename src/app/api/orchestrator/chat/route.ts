import { NextRequest, NextResponse } from "next/server";
import { formatZodError, orchestratorChatInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { buildServerAISettings } from "@/lib/server-ai-settings";
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
  const settings = buildServerAISettings(input.routingSettings ?? {});
  const plan = await planOrchestratorChat({
    message: input.message,
    history: input.history,
    workspace: input.workspace,
    settings,
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
  });
}
