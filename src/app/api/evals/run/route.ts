import { NextRequest, NextResponse } from "next/server";
import { evalRunInputSchema, formatZodError } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import {
  listEvaluationArtifacts,
  mergeEvaluationArtifactIntoWorkspace,
  recordEvaluationArtifact,
  runDeterministicEvalSuite,
} from "@/lib/evaluation-runner";
import { resolveWorkspaceSkillForRuntime } from "@/lib/workspace-runtime-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const artifacts = await listEvaluationArtifacts(guard.session.user.organizationId, 250);
  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.eval-artifacts.v1",
    artifacts,
  });
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = evalRunInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid eval run payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const requestedSkillId = parsed.data.skillId ?? parsed.data.skill?.id;
  const skillResolution = resolveWorkspaceSkillForRuntime(workspace, requestedSkillId);
  if (!skillResolution.ok) {
    return NextResponse.json(
      { error: skillResolution.error, code: skillResolution.code },
      { status: skillResolution.status },
    );
  }

  const artifact = runDeterministicEvalSuite({
    organizationId: guard.session.user.organizationId,
    skill: skillResolution.skill,
    tests: parsed.data.tests,
    suiteId: parsed.data.suiteId,
    suiteName: parsed.data.suiteName,
    threshold: parsed.data.threshold,
  });
  await recordEvaluationArtifact(artifact);
  const merged = mergeEvaluationArtifactIntoWorkspace(workspace, artifact);
  const workspaceUpdated = merged.changed;
  if (merged.changed) {
    await repository.saveWorkspace(merged.workspace);
  }

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.eval-run-result.v1",
    generatedAt: new Date().toISOString(),
    artifact,
    workspaceUpdated,
  });
}
