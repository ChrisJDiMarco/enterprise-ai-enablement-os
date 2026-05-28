import { NextRequest, NextResponse } from "next/server";
import { formatZodError, harnessRunInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { buildServerAISettings } from "@/lib/server-ai-settings";
import { runServerHarnessSkill } from "@/lib/server-harness-runtime";
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
  const settings = buildServerAISettings(body.routingSettings ?? {});
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
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.harness-run-result.v1",
    generatedAt: new Date().toISOString(),
    executionMode: result.model.localFallback ? "server-local-fallback" : "server-provider",
    result,
  });
}
