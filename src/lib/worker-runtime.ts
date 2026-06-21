import type { Pool } from "pg";

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
  errors: { organizationId: string; error: string }[];
};

/** Every organization with persisted state (no separate tenant registry needed). */
export async function listTenantOrganizationIds(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ organization_id: string }>(
    "select distinct organization_id from workspace_snapshots order by organization_id",
  );
  return result.rows.map((row) => row.organization_id);
}

/** Applies the non-dry-run retention sweep for one tenant, sealing an audit record. */
export async function runRetentionSweepForTenant(repository: WorkspaceRepository, organizationId: string) {
  const outcome = await repository.mutateWorkspace<ReturnType<typeof applyPrivacyRetentionSweep>>(
    organizationId,
    (current) => {
      const sweep = applyPrivacyRetentionSweep({ workspace: current, dryRun: false });
      return {
        commit: true as const,
        workspace: sweep.applied ? sweep.workspace : current,
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

  summary.finishedAt = new Date().toISOString();
  return summary;
}
