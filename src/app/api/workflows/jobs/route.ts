import { NextRequest, NextResponse } from "next/server";
import {
  formatZodError,
  workflowJobCreateInputSchema,
  workflowJobMaintenanceInputSchema,
  workflowJobUpdateInputSchema,
} from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { resolveWorkspaceSkillForRuntime } from "@/lib/workspace-runtime-policy";
import { enqueueWorkflowJob, listWorkflowJobs, reconcileStaleWorkflowJobs, updateWorkflowJob } from "@/lib/workflow-jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const jobs = await listWorkflowJobs(guard.session.user.organizationId);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.workflow-jobs.v1",
    jobs,
  });
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const parsed = workflowJobCreateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow job payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;
  let skillId = input.skillId;

  if (input.skillId) {
    const repository = getWorkspaceRepository();
    const unavailable = persistenceUnavailable(repository);
    if (unavailable) return NextResponse.json(unavailable, { status: 503 });

    const workspace = await repository.getWorkspace(guard.session.user.organizationId);
    const skillResolution = resolveWorkspaceSkillForRuntime(workspace, input.skillId);
    if (!skillResolution.ok) {
      return NextResponse.json(
        { error: skillResolution.error, code: skillResolution.code },
        { status: skillResolution.status },
      );
    }
    skillId = skillResolution.skill.id;
  }

  const job = await enqueueWorkflowJob({
    organizationId: guard.session.user.organizationId,
    workflowId: input.workflowId,
    skillId,
    input: input.input,
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.workflow-job-created.v1",
    job,
  });
}

export async function PATCH(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const parsed = workflowJobUpdateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow job update payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;
  const result = await updateWorkflowJob({
    organizationId: guard.session.user.organizationId,
    id: input.id,
    status: input.status,
    output: input.output,
    error: input.error,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.detail,
        reason: result.reason,
        currentStatus: result.reason === "invalid_transition" ? result.currentStatus : undefined,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.workflow-job-updated.v1",
    job: result.job,
  });
}

export async function PUT(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "admin");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const parsed = workflowJobMaintenanceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workflow job maintenance payload.", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const result = await reconcileStaleWorkflowJobs({
    organizationId: guard.session.user.organizationId,
    dryRun: input.dryRun,
    staleAfterMinutes: input.staleAfterMinutes,
    maxJobs: input.maxJobs,
  });

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.workflow-job-maintenance.v1",
    ...result,
  });
}
