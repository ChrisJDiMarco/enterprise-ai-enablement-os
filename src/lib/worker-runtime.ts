import type { Pool } from "pg";

import { fireAlertOnce } from "./alerts.ts";
import { getDatabasePool, getWorkspaceRepository, type WorkspaceRepository } from "./database.ts";
import { applyPrivacyRetentionSweep } from "./privacy-lifecycle.ts";
import { reconcileStaleWorkflowJobs } from "./workflow-jobs.ts";

/**
 * Durable background worker, Postgres-native (no external queue/cron service —
 * runs anywhere a Postgres + a Node process can run). It performs the scheduled
 * maintenance that the request path can't: privacy/GDPR retention sweeps and
 * stale-workflow-job reconciliation, fanned out across EVERY tenant. Run it as a
 * separate process (`npm run worker`) on an interval.
 */

const WORKER_ACTOR = "Maintenance Worker";

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
  errors: { organizationId: string; error: string }[];
};

/** Resolves a non-negative retention-days env value; <= 0 / unset / invalid means keep forever. */
export function retentionDaysFromEnv(env: NodeJS.ProcessEnv, key: string, fallbackDays: number): number {
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
