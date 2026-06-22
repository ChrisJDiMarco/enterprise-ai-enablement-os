import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDatabaseSchema, getDatabasePool, withTenant } from "./database.ts";
import { tenantScopedJsonPath } from "./tenant-file-storage.ts";

export type WorkflowJobStatus = "queued" | "running" | "waiting_for_approval" | "completed" | "failed" | "cancelled";

export type WorkflowJob = {
  id: string;
  organizationId: string;
  workflowId?: string;
  skillId?: string;
  status: WorkflowJobStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowJobSummary = {
  total: number;
  active: number;
  queued: number;
  running: number;
  waitingForApproval: number;
  completed: number;
  failed: number;
  cancelled: number;
  staleActive: number;
  staleAfterMinutes: number;
  oldestActiveAt?: string;
  latestUpdatedAt?: string;
};

export type WorkflowJobSummaryOptions = {
  now?: Date | string;
  staleAfterMinutes?: number;
};

export type WorkflowJobReconciliationAction =
  | "cancel_stale_queued"
  | "fail_stale_running"
  | "escalate_stale_approval";

export type WorkflowJobReconciliationItem = {
  jobId: string;
  previousStatus: WorkflowJobStatus;
  action: WorkflowJobReconciliationAction;
  targetStatus?: WorkflowJobStatus;
  mutates: boolean;
  updatedAt: string;
  reason: string;
};

export type WorkflowJobReconciliationPlan = {
  action: "reconcile_stale";
  scanned: number;
  selected: number;
  staleAfterMinutes: number;
  cutoffAt: string;
  maxJobs: number;
  plannedCancels: number;
  plannedFailures: number;
  approvalEscalations: number;
  plannedMutations: number;
  items: WorkflowJobReconciliationItem[];
};

export type WorkflowJobReconciliationOptions = WorkflowJobSummaryOptions & {
  maxJobs?: number;
};

export type WorkflowJobReconciliationResult = WorkflowJobReconciliationPlan & {
  dryRun: boolean;
  mutationsApplied: number;
  summaryBefore: WorkflowJobSummary;
  projectedSummary: WorkflowJobSummary;
};

export type WorkflowJobTransitionDecision = {
  allowed: boolean;
  reason: string;
};

export type WorkflowJobUpdateResult =
  | { ok: true; job: WorkflowJob }
  | { ok: false; status: 404; reason: "not_found"; detail: string }
  | { ok: false; status: 409; reason: "invalid_transition"; detail: string; currentStatus: WorkflowJobStatus };

export const DEFAULT_WORKFLOW_JOB_STALE_AFTER_MINUTES = 60;
export const DEFAULT_WORKFLOW_JOB_RECONCILIATION_LIMIT = 50;

const workflowJobTerminalStatuses = new Set<WorkflowJobStatus>(["completed", "failed", "cancelled"]);
const allowedWorkflowJobTransitions: Record<WorkflowJobStatus, WorkflowJobStatus[]> = {
  queued: ["queued", "running", "waiting_for_approval", "completed", "failed", "cancelled"],
  running: ["running", "waiting_for_approval", "completed", "failed", "cancelled"],
  waiting_for_approval: ["waiting_for_approval", "running", "completed", "failed", "cancelled"],
  completed: ["completed"],
  failed: ["failed"],
  cancelled: ["cancelled"],
};

const jobsDir = path.join(process.cwd(), ".data", "workflow-jobs");

function jobPath(organizationId: string) {
  return tenantScopedJsonPath(jobsDir, organizationId);
}

export async function listWorkflowJobs(organizationId: string): Promise<WorkflowJob[]> {
  const pool = getDatabasePool();
  if (pool) {
    await ensureDatabaseSchema(pool);
    const result = await withTenant(pool, organizationId, (client) =>
      client.query<{
        id: string;
        organization_id: string;
        workflow_id: string | null;
        skill_id: string | null;
        status: WorkflowJobStatus;
        input: Record<string, unknown>;
        output: Record<string, unknown> | null;
        error: string | null;
        created_at: Date;
        updated_at: Date;
      }>(
        "select id, organization_id, workflow_id, skill_id, status, input, output, error, created_at, updated_at from workflow_jobs where organization_id = $1 order by created_at desc limit 500",
        [organizationId],
      ),
    );
    return result.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      workflowId: row.workflow_id ?? undefined,
      skillId: row.skill_id ?? undefined,
      status: row.status,
      input: row.input,
      output: row.output ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  try {
    const raw = await readFile(jobPath(organizationId), "utf8");
    return JSON.parse(raw) as WorkflowJob[];
  } catch {
    return [];
  }
}

function timestampMs(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function positiveInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function workflowJobStaleAfterMinutesFromEnv(env: Record<string, string | undefined> = process.env) {
  return positiveInteger(env.WORKFLOW_JOB_STALE_AFTER_MINUTES) ?? DEFAULT_WORKFLOW_JOB_STALE_AFTER_MINUTES;
}

function activeJob(status: WorkflowJobStatus) {
  return status === "queued" || status === "running" || status === "waiting_for_approval";
}

function resolveNow(value?: Date | string) {
  const parsedNowMs = value instanceof Date ? value.getTime() : Date.parse(value ?? new Date().toISOString());
  const nowMs = Number.isFinite(parsedNowMs) ? parsedNowMs : Date.now();
  return {
    nowMs,
    nowIso: new Date(nowMs).toISOString(),
  };
}

export function createWorkflowJobId() {
  return `job-${randomUUID()}`;
}

export function canTransitionWorkflowJobStatus(
  currentStatus: WorkflowJobStatus,
  nextStatus: WorkflowJobStatus,
): WorkflowJobTransitionDecision {
  if (workflowJobTerminalStatuses.has(currentStatus) && currentStatus !== nextStatus) {
    return {
      allowed: false,
      reason: `Workflow job is terminal (${currentStatus}) and cannot transition to ${nextStatus}.`,
    };
  }

  if (allowedWorkflowJobTransitions[currentStatus]?.includes(nextStatus)) {
    return {
      allowed: true,
      reason: currentStatus === nextStatus ? "Workflow job status is unchanged." : `Workflow job can transition from ${currentStatus} to ${nextStatus}.`,
    };
  }

  return {
    allowed: false,
    reason: `Workflow job cannot transition from ${currentStatus} to ${nextStatus}.`,
  };
}

export function summarizeWorkflowJobs(jobs: WorkflowJob[], options: WorkflowJobSummaryOptions = {}): WorkflowJobSummary {
  const { nowMs } = resolveNow(options.now);
  const staleAfterMinutes = positiveInteger(options.staleAfterMinutes) ?? workflowJobStaleAfterMinutesFromEnv();
  const staleAfterMs = staleAfterMinutes * 60 * 1000;
  const summary: WorkflowJobSummary = {
    total: jobs.length,
    active: 0,
    queued: 0,
    running: 0,
    waitingForApproval: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    staleActive: 0,
    staleAfterMinutes,
  };

  for (const job of jobs) {
    switch (job.status) {
      case "queued":
        summary.queued += 1;
        break;
      case "running":
        summary.running += 1;
        break;
      case "waiting_for_approval":
        summary.waitingForApproval += 1;
        break;
      case "completed":
        summary.completed += 1;
        break;
      case "failed":
        summary.failed += 1;
        break;
      case "cancelled":
        summary.cancelled += 1;
        break;
    }

    const updatedAt = job.updatedAt || job.createdAt;
    if (activeJob(job.status)) {
      const updatedMs = timestampMs(updatedAt);
      summary.active += 1;
      if (updatedAt && updatedMs <= nowMs - staleAfterMs) {
        summary.staleActive += 1;
      }
      if (updatedAt && (summary.oldestActiveAt === undefined || updatedMs <= timestampMs(summary.oldestActiveAt))) {
        summary.oldestActiveAt = updatedAt;
      }
    }
    if (updatedAt && timestampMs(updatedAt) >= timestampMs(summary.latestUpdatedAt)) {
      summary.latestUpdatedAt = updatedAt;
    }
  }

  return summary;
}

function workflowJobUpdatedAt(job: WorkflowJob) {
  return job.updatedAt || job.createdAt;
}

function reconciliationReason(item: {
  status: WorkflowJobStatus;
  updatedAt: string;
  staleAfterMinutes: number;
}) {
  if (item.status === "queued") {
    return `Queued workflow job has not been accepted by a worker since ${item.updatedAt}; cancel it after ${item.staleAfterMinutes} minute(s) to unblock the ledger.`;
  }
  if (item.status === "running") {
    return `Running workflow job has not heartbeated since ${item.updatedAt}; mark it failed after ${item.staleAfterMinutes} minute(s) so operators can retry with evidence.`;
  }
  return `Workflow job has waited for approval since ${item.updatedAt}; escalate to the approval owner instead of auto-closing it.`;
}

function reconciliationItem(
  job: WorkflowJob,
  staleAfterMinutes: number,
): WorkflowJobReconciliationItem {
  const updatedAt = workflowJobUpdatedAt(job);
  if (job.status === "queued") {
    return {
      jobId: job.id,
      previousStatus: job.status,
      action: "cancel_stale_queued",
      targetStatus: "cancelled",
      mutates: true,
      updatedAt,
      reason: reconciliationReason({ status: job.status, updatedAt, staleAfterMinutes }),
    };
  }
  if (job.status === "running") {
    return {
      jobId: job.id,
      previousStatus: job.status,
      action: "fail_stale_running",
      targetStatus: "failed",
      mutates: true,
      updatedAt,
      reason: reconciliationReason({ status: job.status, updatedAt, staleAfterMinutes }),
    };
  }
  return {
    jobId: job.id,
    previousStatus: job.status,
    action: "escalate_stale_approval",
    targetStatus: job.status,
    mutates: false,
    updatedAt,
    reason: reconciliationReason({ status: job.status, updatedAt, staleAfterMinutes }),
  };
}

export function deriveWorkflowJobReconciliationPlan(
  jobs: WorkflowJob[],
  options: WorkflowJobReconciliationOptions = {},
): WorkflowJobReconciliationPlan {
  const { nowMs } = resolveNow(options.now);
  const staleAfterMinutes = positiveInteger(options.staleAfterMinutes) ?? workflowJobStaleAfterMinutesFromEnv();
  const staleAfterMs = staleAfterMinutes * 60 * 1000;
  const cutoffAt = new Date(nowMs - staleAfterMs).toISOString();
  const maxJobs = positiveInteger(options.maxJobs) ?? DEFAULT_WORKFLOW_JOB_RECONCILIATION_LIMIT;
  const items = jobs
    .filter((job) => activeJob(job.status) && timestampMs(workflowJobUpdatedAt(job)) <= nowMs - staleAfterMs)
    .sort((a, b) => timestampMs(workflowJobUpdatedAt(a)) - timestampMs(workflowJobUpdatedAt(b)))
    .slice(0, maxJobs)
    .map((job) => reconciliationItem(job, staleAfterMinutes));
  const plannedCancels = items.filter((item) => item.action === "cancel_stale_queued").length;
  const plannedFailures = items.filter((item) => item.action === "fail_stale_running").length;
  const approvalEscalations = items.filter((item) => item.action === "escalate_stale_approval").length;

  return {
    action: "reconcile_stale",
    scanned: jobs.length,
    selected: items.length,
    staleAfterMinutes,
    cutoffAt,
    maxJobs,
    plannedCancels,
    plannedFailures,
    approvalEscalations,
    plannedMutations: plannedCancels + plannedFailures,
    items,
  };
}

function applyWorkflowJobReconciliationItem(
  job: WorkflowJob,
  item: WorkflowJobReconciliationItem,
  nowIso: string,
): WorkflowJob {
  if (!item.mutates || !item.targetStatus) return job;
  return {
    ...job,
    status: item.targetStatus,
    error: item.reason,
    updatedAt: nowIso,
  };
}

export function reconcileWorkflowJobList(
  jobs: WorkflowJob[],
  options: WorkflowJobReconciliationOptions & { dryRun?: boolean } = {},
) {
  const { nowIso } = resolveNow(options.now);
  const dryRun = options.dryRun ?? true;
  const plan = deriveWorkflowJobReconciliationPlan(jobs, options);
  const itemByJobId = new Map(plan.items.map((item) => [item.jobId, item]));
  const projectedJobs = jobs.map((job) => {
    const item = itemByJobId.get(job.id);
    return item ? applyWorkflowJobReconciliationItem(job, item, nowIso) : job;
  });
  const result: WorkflowJobReconciliationResult = {
    ...plan,
    dryRun,
    mutationsApplied: dryRun ? 0 : plan.plannedMutations,
    summaryBefore: summarizeWorkflowJobs(jobs, options),
    projectedSummary: summarizeWorkflowJobs(projectedJobs, options),
  };

  return {
    jobs: dryRun ? jobs : projectedJobs,
    result,
  };
}

async function saveWorkflowJobs(organizationId: string, jobs: WorkflowJob[]) {
  await mkdir(path.dirname(jobPath(organizationId)), { recursive: true });
  await writeFile(jobPath(organizationId), JSON.stringify(jobs, null, 2));
}

export async function enqueueWorkflowJob(params: {
  organizationId: string;
  workflowId?: string;
  skillId?: string;
  input?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const job: WorkflowJob = {
    id: createWorkflowJobId(),
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    skillId: params.skillId,
    status: "queued",
    input: params.input ?? {},
    createdAt: now,
    updatedAt: now,
  };
  const pool = getDatabasePool();
  if (pool) {
    await ensureDatabaseSchema(pool);
    await withTenant(pool, job.organizationId, (client) =>
      client.query(
        `
        insert into workflow_jobs (id, organization_id, workflow_id, skill_id, status, input, created_at, updated_at)
        values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
        `,
        [
          job.id,
          job.organizationId,
          job.workflowId ?? null,
          job.skillId ?? null,
          job.status,
          JSON.stringify(job.input),
          new Date(job.createdAt),
          new Date(job.updatedAt),
        ],
      ),
    );
    return job;
  }

  const jobs = await listWorkflowJobs(params.organizationId);
  await saveWorkflowJobs(params.organizationId, [job, ...jobs]);
  return job;
}

export async function updateWorkflowJob(params: {
  organizationId: string;
  id: string;
  status: WorkflowJobStatus;
  output?: Record<string, unknown>;
  error?: string;
}): Promise<WorkflowJobUpdateResult> {
  const pool = getDatabasePool();
  if (pool) {
    await ensureDatabaseSchema(pool);
    return withTenant<WorkflowJobUpdateResult>(pool, params.organizationId, async (client) => {
    const existing = await client.query<{
      status: WorkflowJobStatus;
    }>("select status from workflow_jobs where organization_id = $1 and id = $2", [params.organizationId, params.id]);
    const currentStatus = existing.rows[0]?.status;
    if (!currentStatus) {
      return {
        ok: false,
        status: 404,
        reason: "not_found",
        detail: "Workflow job not found.",
      };
    }
    const transition = canTransitionWorkflowJobStatus(currentStatus, params.status);
    if (!transition.allowed) {
      return {
        ok: false,
        status: 409,
        reason: "invalid_transition",
        detail: transition.reason,
        currentStatus,
      };
    }

    const result = await client.query<{
      id: string;
      organization_id: string;
      workflow_id: string | null;
      skill_id: string | null;
      status: WorkflowJobStatus;
      input: Record<string, unknown>;
      output: Record<string, unknown> | null;
      error: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
      update workflow_jobs
      set status = $3, output = coalesce($4::jsonb, output), error = $5, updated_at = now()
      where organization_id = $1 and id = $2
      returning id, organization_id, workflow_id, skill_id, status, input, output, error, created_at, updated_at
      `,
      [
        params.organizationId,
        params.id,
        params.status,
        params.output ? JSON.stringify(params.output) : null,
        params.error ?? null,
      ],
    );
    const row = result.rows[0];
    return row
      ? {
          ok: true,
          job: {
            id: row.id,
            organizationId: row.organization_id,
            workflowId: row.workflow_id ?? undefined,
            skillId: row.skill_id ?? undefined,
            status: row.status,
            input: row.input,
            output: row.output ?? undefined,
            error: row.error ?? undefined,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
          },
        }
      : {
          ok: false,
          status: 404,
          reason: "not_found",
          detail: "Workflow job not found.",
        };
    });
  }

  const jobs = await listWorkflowJobs(params.organizationId);
  const current = jobs.find((job) => job.id === params.id);
  if (!current) {
    return {
      ok: false,
      status: 404,
      reason: "not_found",
      detail: "Workflow job not found.",
    };
  }

  const transition = canTransitionWorkflowJobStatus(current.status, params.status);
  if (!transition.allowed) {
    return {
      ok: false,
      status: 409,
      reason: "invalid_transition",
      detail: transition.reason,
      currentStatus: current.status,
    };
  }

  const updated = jobs.map((job) =>
    job.id === params.id
      ? {
          ...job,
          status: params.status,
          output: params.output ?? job.output,
          error: params.error,
          updatedAt: new Date().toISOString(),
        }
      : job,
  );
  await saveWorkflowJobs(params.organizationId, updated);
  return {
    ok: true,
    job: updated.find((job) => job.id === params.id) as WorkflowJob,
  };
}

export async function reconcileStaleWorkflowJobs(params: {
  organizationId: string;
  dryRun?: boolean;
  now?: Date | string;
  staleAfterMinutes?: number;
  maxJobs?: number;
}) {
  const jobs = await listWorkflowJobs(params.organizationId);
  const reconciliation = reconcileWorkflowJobList(jobs, {
    dryRun: params.dryRun,
    now: params.now,
    staleAfterMinutes: params.staleAfterMinutes,
    maxJobs: params.maxJobs,
  });

  if (!reconciliation.result.dryRun && reconciliation.result.mutationsApplied > 0) {
    const pool = getDatabasePool();
    if (pool) {
      await Promise.all(
        reconciliation.result.items
          .filter((item) => item.mutates && item.targetStatus)
          .map((item) =>
            updateWorkflowJob({
              organizationId: params.organizationId,
              id: item.jobId,
              status: item.targetStatus as WorkflowJobStatus,
              error: item.reason,
            }),
          ),
      );
    } else {
      await saveWorkflowJobs(params.organizationId, reconciliation.jobs);
    }
  }

  return reconciliation.result;
}
