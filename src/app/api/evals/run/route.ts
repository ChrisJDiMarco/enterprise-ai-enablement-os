import { NextRequest, NextResponse } from "next/server";
import { evalRunInputSchema, formatZodError } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import {
  buildEvaluationArtifactAuditLog,
  listEvaluationArtifacts,
  mergeEvaluationArtifactIntoWorkspace,
  recordEvaluationArtifact,
  runModelEvalSuite,
} from "@/lib/evaluation-runner";
import { recordOperationalEvent } from "@/lib/observability";
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

  // Run the eval against a live model OUTSIDE any workspace lock (model calls are
  // slow). The suite self-labels as "simulated" if the provider degrades, so a
  // pass is only ever recorded from a real model response.
  const artifact = await runModelEvalSuite({
    organizationId: guard.session.user.organizationId,
    skill: skillResolution.skill,
    settings: workspace.aiSettings,
    tests: parsed.data.tests,
    suiteId: parsed.data.suiteId,
    suiteName: parsed.data.suiteName,
    threshold: parsed.data.threshold,
  });
  await recordEvaluationArtifact(artifact);

  // Merge the artifact + seal the audit event atomically against the freshest state.
  const outcome = await repository.mutateWorkspace(guard.session.user.organizationId, (current) => {
    const merged = mergeEvaluationArtifactIntoWorkspace(current, artifact);
    const auditLog = buildEvaluationArtifactAuditLog({
      artifact,
      actor: guard.session.user.name,
      skillName: skillResolution.skill.name,
    });
    return { commit: true as const, workspace: merged.workspace, result: merged.changed, auditLog };
  });

  await recordOperationalEvent({
    organizationId: guard.session.user.organizationId,
    name:
      artifact.executionMode === "simulated"
        ? "eval.run.simulated"
        : artifact.passed
          ? "eval.run.passed"
          : "eval.run.failed",
    level:
      artifact.executionMode === "simulated"
        ? "warn"
        : artifact.passed
          ? "info"
          : artifact.result.criticalFailures > 0
            ? "error"
            : "warn",
    route: "/api/evals/run",
    actor: guard.session.user.name,
    metadata: {
      artifactId: artifact.id,
      evalResultId: artifact.result.id,
      skillId: artifact.skillId,
      suiteId: artifact.suiteId,
      score: artifact.score,
      threshold: artifact.threshold,
      passed: artifact.passed,
      executionMode: artifact.executionMode,
      criticalFailures: artifact.result.criticalFailures,
      testCount: artifact.result.resultsByTest.length,
    },
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.eval-run-result.v1",
    generatedAt: new Date().toISOString(),
    artifact,
    auditLog: outcome.auditLog,
    workspaceUpdated: outcome.result,
  });
}
