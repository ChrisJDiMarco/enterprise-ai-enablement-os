import { NextRequest, NextResponse } from "next/server";

import { evalScheduleMaintenanceInputSchema, formatZodError } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { deriveEvalScheduleMaintenancePlan, deriveEvalSchedulePlan } from "@/lib/eval-scheduler";
import type { AuditLog } from "@/lib/enterprise-ai-data";
import {
  buildEvaluationArtifactAuditLog,
  mergeEvaluationArtifactIntoWorkspace,
  recordEvaluationArtifact,
  runDeterministicEvalSuite,
  type EvaluationArtifact,
} from "@/lib/evaluation-runner";
import { recordOperationalEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const plan = deriveEvalSchedulePlan({
    skills: workspace.skills,
    evalResults: workspace.evalResults,
  });

  return NextResponse.json(plan);
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const parsed = evalScheduleMaintenanceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid eval schedule maintenance payload.", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const plan = deriveEvalSchedulePlan({
    skills: workspace.skills,
    evalResults: workspace.evalResults,
  });
  const maintenance = deriveEvalScheduleMaintenancePlan(plan, parsed.data);
  const artifacts: EvaluationArtifact[] = [];
  const auditLogs: AuditLog[] = [];
  const skillNameById = new Map(workspace.skills.map((skill) => [skill.id, skill.name]));

  if (maintenance.action === "run_due" && !maintenance.dryRun) {
    const skillById = new Map(workspace.skills.map((skill) => [skill.id, skill]));
    for (const item of maintenance.items) {
      const skill = skillById.get(item.skillId);
      if (!skill) continue;
      const artifact = runDeterministicEvalSuite({
        organizationId: guard.session.user.organizationId,
        skill,
        suiteId: `${skill.id}-continuous-eval`,
        suiteName: "Continuous Eval Backfill",
        threshold: parsed.data.threshold,
      });
      await recordEvaluationArtifact(artifact);
      artifacts.push(artifact);
    }
  }

  let savedWorkspace = workspace;
  if (artifacts.length > 0) {
    // Merge every deterministic artifact into the freshest state + seal each
    // audit event atomically under a per-tenant lock. mutateWorkspace seals one
    // audit log per call, so seal the remainder via appendAuditLog after.
    const [firstArtifact, ...restArtifacts] = artifacts;
    const outcome = await repository.mutateWorkspace<EvaluationArtifact[]>(
      guard.session.user.organizationId,
      (current) => {
        let next = current;
        for (const artifact of artifacts) {
          next = mergeEvaluationArtifactIntoWorkspace(next, artifact).workspace;
        }
        return {
          commit: true as const,
          workspace: next,
          result: artifacts,
          auditLog: buildEvaluationArtifactAuditLog({
            artifact: firstArtifact,
            actor: guard.session.user.name,
            skillName: skillNameById.get(firstArtifact.skillId),
          }),
        };
      },
    );
    savedWorkspace = outcome.workspace;
    if (outcome.auditLog) auditLogs.push(outcome.auditLog);
    auditLogs.push(
      ...(await Promise.all(
        restArtifacts.map((artifact) =>
          repository.appendAuditLog(
            guard.session.user.organizationId,
            buildEvaluationArtifactAuditLog({
              artifact,
              actor: guard.session.user.name,
              skillName: skillNameById.get(artifact.skillId),
            }),
          ),
        ),
      )),
    );
  }

  await recordOperationalEvent({
    organizationId: guard.session.user.organizationId,
    name: maintenance.action === "run_due" && !maintenance.dryRun ? "eval.schedule.backfilled" : "eval.schedule.generated",
    level: maintenance.blockedSelected || plan.blockedCount ? "warn" : "info",
    route: "/api/evals/schedule",
    actor: guard.session.user.name,
    metadata: {
      action: maintenance.action,
      dryRun: maintenance.dryRun,
      dueCount: plan.dueCount,
      blockedCount: plan.blockedCount,
      healthyCount: plan.healthyCount,
      selected: maintenance.selected,
      artifacts: artifacts.length,
    },
  });

  return NextResponse.json({
    ...plan,
    maintenance,
    queued: maintenance.items,
    artifacts,
    auditLogs,
    workspaceUpdated: artifacts.length > 0,
    workspaceEvidence: {
      evalResults: savedWorkspace.evalResults.length,
      skillsUpdated: artifacts.length,
    },
    note:
      maintenance.action === "run_due"
        ? maintenance.note
        : process.env.EVAL_RUNNER_URL
          ? "External eval runner can consume the queued items."
          : "No external eval runner is configured; use action=run_due for deterministic local eval artifacts.",
  });
}
