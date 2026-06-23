import type { Pool } from "pg";

import { fireAlertOnce } from "./alerts.ts";
import { getDatabasePool, getWorkspaceRepository, type WorkspaceRepository } from "./database.ts";
import { generateWithModelProvider } from "./model-provider.ts";
import { recordOperationalEvent } from "./observability.ts";
import { applyPrivacyRetentionSweep } from "./privacy-lifecycle.ts";
import { buildDeterministicReport, buildReportMetrics } from "./report-generator.ts";
import { advanceReportScheduleAfterRun, selectDueReportSchedules } from "./report-schedule.ts";
import { buildServerAISettingsForOrganization } from "./server-ai-settings.ts";
import { outboundUrlIssue } from "./url-safety.ts";
import { interpretWorkflow } from "./workflow-interpreter.ts";
import { reconcileStaleWorkflowJobs, updateWorkflowJob, type WorkflowJobStatus } from "./workflow-jobs.ts";

/**
 * Durable background worker, Postgres-native (no external queue/cron service —
 * runs anywhere a Postgres + a Node process can run). It performs the scheduled
 * maintenance that the request path can't: privacy/GDPR retention sweeps and
 * stale-workflow-job reconciliation, fanned out across EVERY tenant. Run it as a
 * separate process (`npm run worker`) on an interval.
 */

const WORKER_ACTOR = "Maintenance Worker";

// Local status→label map for worker-generated reports (mirrors the reports route;
// kept here so the worker avoids the @/lib alias, which the test runner can't resolve).
const reportStatusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  triage: "Triage",
  discovery: "Discovery",
  scored: "Scored",
  governance_review: "Governance Review",
  approved_for_pilot: "Approved for Pilot",
  in_pilot: "In Pilot",
  measuring: "Measuring",
  scaled: "Scaled",
  parked: "Parked",
  rejected: "Rejected",
  in_review: "In Review",
  approved: "Approved",
  pilot: "Pilot",
  production: "Production",
  deprecated: "Deprecated",
  archived: "Archived",
  changes_requested: "Changes Requested",
  approved_with_conditions: "Approved with Conditions",
  not_submitted: "Not Submitted",
};

export type WorkerTickSummary = {
  startedAt: string;
  finishedAt: string;
  tenants: number;
  expiredWorkSignals: number;
  staleJobsReconciled: number;
  idempotencyRecordsPruned: number;
  runTracesPruned: number;
  evalArtifactsPruned: number;
  connectorEventsPruned: number;
  workflowJobsPruned: number;
  workflowJobsProcessed: number;
  reportsDelivered: number;
  errors: { organizationId: string; error: string }[];
};

/** Resolves a non-negative retention-days env value; <= 0 / unset / invalid means keep forever. */
export function retentionDaysFromEnv(env: Record<string, string | undefined>, key: string, fallbackDays: number): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return fallbackDays;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackDays;
}

/** Every organization with persisted state (no separate tenant registry needed). */
export async function listTenantOrganizationIds(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ organization_id: string }>(
    "select distinct organization_id from workspace_snapshots order by organization_id",
  );
  return result.rows.map((row) => row.organization_id);
}

/**
 * Applies the non-dry-run retention sweep for one tenant. Only writes + seals an
 * audit record when something actually expired — otherwise it's a no-op, so a
 * frequent worker cadence can't amplify writes or spam the audit log across every
 * tenant on every tick.
 */
export async function runRetentionSweepForTenant(repository: WorkspaceRepository, organizationId: string) {
  const outcome = await repository.mutateWorkspace<ReturnType<typeof applyPrivacyRetentionSweep>>(
    organizationId,
    (current) => {
      const sweep = applyPrivacyRetentionSweep({ workspace: current, dryRun: false });
      if (!sweep.applied) {
        return { commit: false as const, result: sweep };
      }
      return {
        commit: true as const,
        workspace: sweep.workspace,
        result: sweep,
        auditLog: {
          id: `privacy-retention-sweep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          eventType: "privacy_retention_sweep",
          message: `Automated privacy retention sweep: ${sweep.expired} expired work signal(s) removed, ${sweep.retained} retained.`,
          actor: WORKER_ACTOR,
          riskLevel: sweep.expired > 0 ? "medium" : "low",
          createdAt: sweep.generatedAt,
        },
      };
    },
  );
  return outcome.result;
}

/**
 * Fires due, active report schedules for one tenant: generates the report from
 * the workspace, delivers it to REPORT_WEBHOOK_URL when configured (SSRF-checked,
 * best-effort), records a durable operational event, and stamps lastRunAt +
 * rolls nextRunAt forward. Previously schedules toggled "active" but nothing ever
 * ran them.
 */
export async function deliverDueReportSchedules(
  repository: WorkspaceRepository,
  organizationId: string,
  now: Date = new Date(),
): Promise<number> {
  const workspace = await repository.getWorkspace(organizationId);
  const due = selectDueReportSchedules(workspace.reportSchedules ?? [], now);
  if (!due.length) return 0;

  const metrics = buildReportMetrics({
    useCases: workspace.useCases,
    skills: workspace.skills,
    governanceReviews: workspace.governanceReviews,
  });
  const webhook = process.env.REPORT_WEBHOOK_URL?.trim();

  for (const schedule of due) {
    const report = buildDeterministicReport({
      templateId: schedule.templateId,
      useCases: workspace.useCases,
      skills: workspace.skills,
      governanceReviews: workspace.governanceReviews,
      workSignals: workspace.workSignals,
      metrics,
      statusLabels: reportStatusLabels,
    });
    if (webhook && !outboundUrlIssue(webhook)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        await fetch(webhook, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(process.env.REPORT_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.REPORT_WEBHOOK_TOKEN}` } : {}),
          },
          body: JSON.stringify({
            schema: "enterprise-ai-enablement-os.scheduled-report.v1",
            organizationId,
            scheduleId: schedule.id,
            title: schedule.title,
            audience: schedule.audience,
            cadence: schedule.cadence,
            report,
            deliveredAt: now.toISOString(),
          }),
        });
      } catch {
        // Best-effort: a webhook failure still records the run + advances the schedule.
      } finally {
        clearTimeout(timeout);
      }
    }
    await recordOperationalEvent({
      organizationId,
      name: "report.schedule.delivered",
      level: "info",
      metadata: { scheduleId: schedule.id, title: schedule.title, cadence: schedule.cadence, delivered: Boolean(webhook), reportChars: report.length },
    });
  }

  // Persist lastRunAt + the rolled-forward nextRunAt against the freshest state.
  const dueIds = new Set(due.map((schedule) => schedule.id));
  await repository.mutateWorkspace(organizationId, (current) => ({
    commit: true as const,
    workspace: {
      ...current,
      reportSchedules: current.reportSchedules.map((schedule) =>
        dueIds.has(schedule.id) ? advanceReportScheduleAfterRun(schedule, now) : schedule,
      ),
    },
    result: due.length,
    auditLog: {
      id: `report-schedule-run-${now.getTime()}-${organizationId}`,
      eventType: "report_schedule_delivered",
      message: `Delivered ${due.length} scheduled report(s)${webhook ? " to the configured webhook" : " (recorded; no REPORT_WEBHOOK_URL configured)"}.`,
      actor: WORKER_ACTOR,
      riskLevel: "low",
      createdAt: now.toISOString(),
    },
  }));

  return due.length;
}

/** Prunes idempotency records older than `olderThanDays` so the table can't grow unbounded. */
export async function pruneIdempotencyRecords(pool: Pool, olderThanDays = 7): Promise<number> {
  const result = await pool.query("delete from idempotency_records where created_at < now() - make_interval(days => $1)", [
    olderThanDays,
  ]);
  return result.rowCount ?? 0;
}

/** Prunes harness run traces older than `days`. `days <= 0` keeps them indefinitely. */
export async function pruneRunTraces(pool: Pool, days: number): Promise<number> {
  if (days <= 0) return 0;
  const result = await pool.query("delete from run_traces where created_at < now() - make_interval(days => $1)", [days]);
  return result.rowCount ?? 0;
}

/** Prunes eval artifacts older than `days`. Evidence — defaults to keep (opt-in). */
export async function pruneEvalArtifacts(pool: Pool, days: number): Promise<number> {
  if (days <= 0) return 0;
  const result = await pool.query("delete from eval_artifacts where created_at < now() - make_interval(days => $1)", [days]);
  return result.rowCount ?? 0;
}

/** Prunes connector execution events older than `days`. Evidence — defaults to keep (opt-in). */
export async function pruneConnectorEvents(pool: Pool, days: number): Promise<number> {
  if (days <= 0) return 0;
  const result = await pool.query("delete from connector_events where created_at < now() - make_interval(days => $1)", [days]);
  return result.rowCount ?? 0;
}

/** Prunes terminal (completed/failed/blocked) workflow jobs older than `days`; active jobs are kept. */
export async function pruneTerminalWorkflowJobs(pool: Pool, days: number): Promise<number> {
  if (days <= 0) return 0;
  const result = await pool.query(
    `delete from workflow_jobs
     where status in ('completed', 'failed', 'blocked')
       and updated_at < now() - make_interval(days => $1)`,
    [days],
  );
  return result.rowCount ?? 0;
}

/**
 * Claims up to `limit` queued workflow jobs using FOR UPDATE SKIP LOCKED so that
 * multiple worker instances never double-claim a job. This is the durable-queue
 * primitive; job EXECUTION semantics (running the referenced Skill, or delegating
 * to an external workflow engine) are layered on top of it.
 */
export async function claimQueuedWorkflowJobs(pool: Pool, limit = 10) {
  const result = await pool.query<{ id: string; organization_id: string; skill_id: string | null }>(
    `update workflow_jobs
     set status = 'running', updated_at = now()
     where id in (
       select id from workflow_jobs
       where status = 'queued'
       order by created_at
       for update skip locked
       limit $1
     )
     returning id, organization_id, skill_id`,
    [limit],
  );
  return result.rows;
}

/**
 * Drains queued workflow jobs: claims them (FOR UPDATE SKIP LOCKED so instances
 * don't double-claim), runs each through the workflow interpreter against its
 * org's published spec, and writes the execution result back to the job. LLM
 * analysis steps run via the model provider (local fallback when none is
 * configured); a human-approval block leaves the job waiting_for_approval; tool
 * calls are recorded for connector-broker execution, not auto-run.
 */
export async function drainWorkflowJobs(pool: Pool, limit = 10) {
  const claimed = await claimQueuedWorkflowJobs(pool, limit);
  const tally = { processed: 0, completed: 0, waiting: 0, failed: 0 };
  const repository = getWorkspaceRepository();

  for (const claim of claimed) {
    tally.processed += 1;
    try {
      const workspace = await repository.getWorkspace(claim.organization_id);
      const settings = await buildServerAISettingsForOrganization(claim.organization_id, {});
      const result = await interpretWorkflow({
        nodes: workspace.workflow.nodes,
        edges: workspace.workflow.edges,
        input: { jobId: claim.id, skillId: claim.skill_id ?? undefined },
        executeStep: async (node, input) => {
          if (node.blockType === "tool_call") {
            return {
              status: "completed",
              detail: `Tool "${node.toolId ?? "unspecified"}" recorded — requires connector-broker execution + approval, not auto-run by the worker.`,
              output: { toolId: node.toolId, requiresConnectorExecution: true },
            };
          }
          if (node.blockType === "llm_analysis" || node.blockType === "extract_data" || node.blockType === "retrieve_documents") {
            const generated = await generateWithModelProvider({
              settings,
              lane: "workflow",
              system:
                node.systemPrompt ||
                `Execute the "${node.title}" step of an enterprise workflow. Use only the provided input; do not claim a tool ran, a message was sent, or an approval was granted.`,
              user: `Workflow step input: ${JSON.stringify(input).slice(0, 1500)}`,
              temperature: 0.2,
              maxTokens: 1024,
            });
            return {
              status: "completed",
              detail: `${node.title} executed via ${generated.localFallback ? "local runtime (no provider configured)" : `${generated.route.provider}/${generated.route.model}`}.`,
              output: generated.text.slice(0, 4000),
            };
          }
          return { status: "completed", detail: `${node.blockType} step processed.` };
        },
      });

      const status: WorkflowJobStatus =
        result.status === "completed" ? "completed" : result.status === "waiting_for_approval" ? "waiting_for_approval" : "failed";
      await updateWorkflowJob({
        organizationId: claim.organization_id,
        id: claim.id,
        status,
        output: {
          schema: "enterprise-ai-enablement-os.workflow-run.v1",
          status: result.status,
          steps: result.steps,
          pendingNodeId: result.pendingNodeId,
          finishedAt: new Date().toISOString(),
        },
        error: result.error,
      });
      if (status === "completed") tally.completed += 1;
      else if (status === "waiting_for_approval") tally.waiting += 1;
      else tally.failed += 1;
    } catch (error) {
      tally.failed += 1;
      await updateWorkflowJob({
        organizationId: claim.organization_id,
        id: claim.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Workflow execution failed.",
      }).catch(() => undefined);
    }
  }

  return tally;
}

/** One maintenance pass across all tenants, with per-tenant error isolation. */
export async function runWorkerTick(): Promise<WorkerTickSummary> {
  const startedAt = new Date().toISOString();
  const summary: WorkerTickSummary = {
    startedAt,
    finishedAt: startedAt,
    tenants: 0,
    expiredWorkSignals: 0,
    staleJobsReconciled: 0,
    idempotencyRecordsPruned: 0,
    runTracesPruned: 0,
    evalArtifactsPruned: 0,
    connectorEventsPruned: 0,
    workflowJobsPruned: 0,
    workflowJobsProcessed: 0,
    reportsDelivered: 0,
    errors: [],
  };

  const pool = getDatabasePool();
  if (!pool) {
    summary.finishedAt = new Date().toISOString();
    return summary;
  }

  const repository = getWorkspaceRepository();
  const organizationIds = await listTenantOrganizationIds(pool);
  summary.tenants = organizationIds.length;

  for (const organizationId of organizationIds) {
    try {
      const sweep = await runRetentionSweepForTenant(repository, organizationId);
      summary.expiredWorkSignals += sweep.expired;
      const reconcile = await reconcileStaleWorkflowJobs({ organizationId });
      summary.staleJobsReconciled += reconcile.mutationsApplied ?? 0;
      summary.reportsDelivered += await deliverDueReportSchedules(repository, organizationId);
    } catch (error) {
      summary.errors.push({
        organizationId,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  try {
    summary.idempotencyRecordsPruned = await pruneIdempotencyRecords(pool);
  } catch (error) {
    summary.errors.push({
      organizationId: "(global)",
      error: error instanceof Error ? error.message : "idempotency prune failed",
    });
  }

  // Drain the durable workflow-job queue: queued jobs were previously never
  // executed (the queue grew forever); now they run through the interpreter.
  try {
    summary.workflowJobsProcessed = (await drainWorkflowJobs(pool)).processed;
  } catch (error) {
    summary.errors.push({
      organizationId: "(global)",
      error: error instanceof Error ? error.message : "workflow job drain failed",
    });
  }

  // Bound otherwise-unbounded growth tables. High-volume/operational tables prune
  // by default; evidence tables (evals, connector events) default to keep-forever
  // and only prune when an operator sets an explicit retention window.
  try {
    const env = process.env;
    summary.runTracesPruned = await pruneRunTraces(pool, retentionDaysFromEnv(env, "RUN_TRACES_RETENTION_DAYS", 90));
    summary.evalArtifactsPruned = await pruneEvalArtifacts(pool, retentionDaysFromEnv(env, "EVAL_ARTIFACTS_RETENTION_DAYS", 0));
    summary.connectorEventsPruned = await pruneConnectorEvents(pool, retentionDaysFromEnv(env, "CONNECTOR_EVENTS_RETENTION_DAYS", 0));
    summary.workflowJobsPruned = await pruneTerminalWorkflowJobs(pool, retentionDaysFromEnv(env, "WORKFLOW_JOBS_RETENTION_DAYS", 30));
  } catch (error) {
    summary.errors.push({
      organizationId: "(global)",
      error: error instanceof Error ? error.message : "growth-table prune failed",
    });
  }

  summary.finishedAt = new Date().toISOString();

  if (summary.errors.length > 0) {
    // The maintenance worker runs GDPR retention + stale-job reconciliation; a
    // silent failure here is a compliance/SLA risk. Page on-call (debounced).
    await fireAlertOnce({
      key: "worker.tick_errors",
      organizationId: "platform",
      severity: "warning",
      title: "Maintenance worker tick reported errors",
      detail: `${summary.errors.length} error(s); first: ${summary.errors[0]?.error ?? "unknown"}`,
    });
  }

  return summary;
}
