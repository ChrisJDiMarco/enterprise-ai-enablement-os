import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_WORKFLOW_JOB_STALE_AFTER_MINUTES,
  canTransitionWorkflowJobStatus,
  createWorkflowJobId,
  deriveWorkflowJobReconciliationPlan,
  enqueueWorkflowJob,
  reconcileWorkflowJobList,
  summarizeWorkflowJobs,
  updateWorkflowJob,
  workflowJobStaleAfterMinutesFromEnv,
  type WorkflowJob,
} from "../src/lib/workflow-jobs.ts";

test("createWorkflowJobId generates collision-resistant job ids", () => {
  const ids = new Set(Array.from({ length: 1000 }, () => createWorkflowJobId()));
  const [sample] = ids;

  assert.equal(ids.size, 1000);
  assert.match(sample ?? "", /^job-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("workflowJobStaleAfterMinutesFromEnv parses positive integer thresholds", () => {
  assert.equal(workflowJobStaleAfterMinutesFromEnv({ WORKFLOW_JOB_STALE_AFTER_MINUTES: "15" }), 15);
  assert.equal(workflowJobStaleAfterMinutesFromEnv({ WORKFLOW_JOB_STALE_AFTER_MINUTES: "0" }), DEFAULT_WORKFLOW_JOB_STALE_AFTER_MINUTES);
  assert.equal(workflowJobStaleAfterMinutesFromEnv({ WORKFLOW_JOB_STALE_AFTER_MINUTES: "soon" }), DEFAULT_WORKFLOW_JOB_STALE_AFTER_MINUTES);
});

test("canTransitionWorkflowJobStatus protects terminal workflow jobs", () => {
  assert.equal(canTransitionWorkflowJobStatus("queued", "running").allowed, true);
  assert.equal(canTransitionWorkflowJobStatus("queued", "completed").allowed, true);
  assert.equal(canTransitionWorkflowJobStatus("running", "waiting_for_approval").allowed, true);
  assert.equal(canTransitionWorkflowJobStatus("waiting_for_approval", "completed").allowed, true);
  assert.equal(canTransitionWorkflowJobStatus("completed", "completed").allowed, true);
  assert.equal(canTransitionWorkflowJobStatus("completed", "running").allowed, false);
  assert.equal(canTransitionWorkflowJobStatus("failed", "queued").allowed, false);
  assert.equal(canTransitionWorkflowJobStatus("cancelled", "running").allowed, false);
});

test("summarizeWorkflowJobs counts statuses, active age, and latest update", () => {
  const jobs: WorkflowJob[] = [
    {
      id: "job-completed",
      organizationId: "org-1",
      status: "completed",
      input: {},
      createdAt: "2026-06-01T09:00:00.000Z",
      updatedAt: "2026-06-01T09:30:00.000Z",
    },
    {
      id: "job-running",
      organizationId: "org-1",
      status: "running",
      input: {},
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:15:00.000Z",
    },
    {
      id: "job-approval",
      organizationId: "org-1",
      status: "waiting_for_approval",
      input: {},
      createdAt: "2026-06-01T11:00:00.000Z",
      updatedAt: "2026-06-01T11:45:00.000Z",
    },
    {
      id: "job-failed",
      organizationId: "org-1",
      status: "failed",
      input: {},
      error: "Connector unavailable.",
      createdAt: "2026-06-01T12:00:00.000Z",
      updatedAt: "2026-06-01T12:05:00.000Z",
    },
  ];

  const summary = summarizeWorkflowJobs(jobs, {
    now: "2026-06-01T12:10:00.000Z",
    staleAfterMinutes: 30,
  });

  assert.deepEqual(summary, {
    total: 4,
    active: 2,
    queued: 0,
    running: 1,
    waitingForApproval: 1,
    completed: 1,
    failed: 1,
    cancelled: 0,
    staleActive: 1,
    staleAfterMinutes: 30,
    oldestActiveAt: "2026-06-01T10:15:00.000Z",
    latestUpdatedAt: "2026-06-01T12:05:00.000Z",
  });
});

test("deriveWorkflowJobReconciliationPlan classifies stale jobs by safe remediation", () => {
  const jobs: WorkflowJob[] = [
    {
      id: "job-queued-stale",
      organizationId: "org-1",
      status: "queued",
      input: {},
      createdAt: "2026-06-01T09:00:00.000Z",
      updatedAt: "2026-06-01T09:00:00.000Z",
    },
    {
      id: "job-running-stale",
      organizationId: "org-1",
      status: "running",
      input: {},
      createdAt: "2026-06-01T09:05:00.000Z",
      updatedAt: "2026-06-01T09:10:00.000Z",
    },
    {
      id: "job-approval-stale",
      organizationId: "org-1",
      status: "waiting_for_approval",
      input: {},
      createdAt: "2026-06-01T09:15:00.000Z",
      updatedAt: "2026-06-01T09:20:00.000Z",
    },
    {
      id: "job-queued-fresh",
      organizationId: "org-1",
      status: "queued",
      input: {},
      createdAt: "2026-06-01T10:50:00.000Z",
      updatedAt: "2026-06-01T10:50:00.000Z",
    },
  ];

  const plan = deriveWorkflowJobReconciliationPlan(jobs, {
    now: "2026-06-01T11:00:00.000Z",
    staleAfterMinutes: 30,
  });

  assert.equal(plan.scanned, 4);
  assert.equal(plan.selected, 3);
  assert.equal(plan.plannedCancels, 1);
  assert.equal(plan.plannedFailures, 1);
  assert.equal(plan.approvalEscalations, 1);
  assert.equal(plan.plannedMutations, 2);
  assert.deepEqual(plan.items.map((item) => item.action), [
    "cancel_stale_queued",
    "fail_stale_running",
    "escalate_stale_approval",
  ]);
});

test("reconcileWorkflowJobList previews changes in dry-run and applies mutable stale jobs", () => {
  const jobs: WorkflowJob[] = [
    {
      id: "job-queued-stale",
      organizationId: "org-1",
      status: "queued",
      input: {},
      createdAt: "2026-06-01T09:00:00.000Z",
      updatedAt: "2026-06-01T09:00:00.000Z",
    },
    {
      id: "job-running-stale",
      organizationId: "org-1",
      status: "running",
      input: {},
      createdAt: "2026-06-01T09:10:00.000Z",
      updatedAt: "2026-06-01T09:10:00.000Z",
    },
    {
      id: "job-approval-stale",
      organizationId: "org-1",
      status: "waiting_for_approval",
      input: {},
      createdAt: "2026-06-01T09:20:00.000Z",
      updatedAt: "2026-06-01T09:20:00.000Z",
    },
  ];

  const options = {
    now: "2026-06-01T11:00:00.000Z",
    staleAfterMinutes: 30,
  };
  const preview = reconcileWorkflowJobList(jobs, { ...options, dryRun: true });
  const applied = reconcileWorkflowJobList(jobs, { ...options, dryRun: false });

  assert.equal(preview.result.mutationsApplied, 0);
  assert.equal(preview.jobs.find((job) => job.id === "job-queued-stale")?.status, "queued");
  assert.equal(preview.result.projectedSummary.staleActive, 1);
  assert.equal(applied.result.mutationsApplied, 2);
  assert.equal(applied.jobs.find((job) => job.id === "job-queued-stale")?.status, "cancelled");
  assert.equal(applied.jobs.find((job) => job.id === "job-running-stale")?.status, "failed");
  assert.equal(applied.jobs.find((job) => job.id === "job-approval-stale")?.status, "waiting_for_approval");
  assert.equal(applied.result.projectedSummary.staleActive, 1);
});

test("updateWorkflowJob rejects attempts to reopen terminal jobs", async () => {
  const organizationId = `org-workflow-transition-${Date.now()}`;
  const job = await enqueueWorkflowJob({
    organizationId,
    workflowId: "workflow-terminal-guard",
    input: { test: true },
  });

  const running = await updateWorkflowJob({
    organizationId,
    id: job.id,
    status: "running",
  });
  assert.equal(running.ok, true);
  if (!running.ok) throw new Error("workflow job should transition to running");
  assert.equal(running.job.status, "running");

  const completed = await updateWorkflowJob({
    organizationId,
    id: job.id,
    status: "completed",
    output: { ok: true },
  });
  assert.equal(completed.ok, true);
  if (!completed.ok) throw new Error("workflow job should transition to completed");
  assert.equal(completed.job.status, "completed");

  const reopened = await updateWorkflowJob({
    organizationId,
    id: job.id,
    status: "running",
  });
  assert.equal(reopened.ok, false);
  assert.equal(reopened.status, 409);
  assert.equal(reopened.reason, "invalid_transition");
  assert.match(reopened.detail, /terminal/);

  const missing = await updateWorkflowJob({
    organizationId,
    id: "job-missing",
    status: "completed",
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
});
