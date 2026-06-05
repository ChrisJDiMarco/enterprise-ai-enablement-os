import { NextRequest, NextResponse } from "next/server";
import {
  formatZodError,
  workflowJobCreateInputSchema,
  workflowJobMaintenanceInputSchema,
  workflowJobUpdateInputSchema,
} from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
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
  const job = await enqueueWorkflowJob({
    organizationId: guard.session.user.organizationId,
    workflowId: input.workflowId,
    skillId: input.skillId,
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
  const job = await updateWorkflowJob({
    organizationId: guard.session.user.organizationId,
    id: input.id,
    status: input.status,
    output: input.output,
    error: input.error,
  });

  if (!job) {
    return NextResponse.json({ error: "Workflow job not found." }, { status: 404 });
  }

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.workflow-job-updated.v1",
    job,
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
