import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { getWorkspaceRepository, getDatabasePool, closeDatabasePool } from "../../src/lib/database.ts";
import {
  claimQueuedWorkflowJobs,
  listTenantOrganizationIds,
  pruneIdempotencyRecords,
  runRetentionSweepForTenant,
  runWorkerTick,
} from "../../src/lib/worker-runtime.ts";
import type { WorkSignal } from "../../src/lib/enterprise-ai-data.ts";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for integration tests (run via `npm run test:integration`).");
}

const org = `wtest-${process.pid}`;

function expiredSignal(id: string): WorkSignal {
  return {
    id,
    source: "workflow",
    eventType: "workflow_delayed",
    department: "Operations",
    process: "Quarter close",
    summary: "Aggregated delay metadata, no raw content.",
    metadata: { volume: 10, delayHours: 4, confidence: 0.9 },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: "aggregated",
      retentionDays: 1,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel: "medium",
    createdAt: "2020-01-01T00:00:00.000Z",
  } as WorkSignal;
}

async function cleanup() {
  const pool = getDatabasePool();
  if (!pool) return;
  await pool.query("delete from workspace_snapshots where organization_id = $1", [org]);
  await pool.query("delete from audit_events where organization_id = $1", [org]);
  await pool.query("delete from workflow_jobs where organization_id = $1", [org]);
  await pool.query("delete from idempotency_records where organization_id = $1", [org]);
}

before(async () => {
  const repository = getWorkspaceRepository();
  assert.equal(repository.mode, "postgres", "worker integration tests must run against Postgres");
  await repository.getWorkspace(org);
  await cleanup();
});

after(async () => {
  await cleanup();
  await closeDatabasePool();
});

test("worker retention sweep removes a tenant's expired work signals + seals an audit record", async () => {
  const repository = getWorkspaceRepository();
  await repository.mutateWorkspace(org, (workspace) => ({
    commit: true as const,
    workspace: {
      ...workspace,
      organizationId: org,
      organization: { ...workspace.organization, id: org, name: org, slug: org },
      workSignals: [expiredSignal("ws-expired")],
    },
    result: null,
  }));
  const seeded = await repository.getWorkspace(org);
  assert.equal(seeded.workSignals.length, 1, "one expired signal seeded");

  const sweep = await runRetentionSweepForTenant(repository, org);
  assert.ok(sweep.expired >= 1, "the expired signal is detected");

  const after = await repository.getWorkspace(org);
  assert.equal(after.workSignals.length, 0, "expired signal removed by the worker");
  const audit = await repository.listAuditLogs(org, 20);
  assert.ok(audit.some((log) => log.eventType === "privacy_retention_sweep"), "retention sweep is audited");
});

test("listTenantOrganizationIds includes every tenant with persisted state", async () => {
  const pool = getDatabasePool();
  assert.ok(pool);
  const ids = await listTenantOrganizationIds(pool);
  assert.equal(ids.includes(org), true);
});

test("claimQueuedWorkflowJobs uses FOR UPDATE SKIP LOCKED — concurrent workers never double-claim", async () => {
  const pool = getDatabasePool();
  assert.ok(pool);
  await pool.query("delete from workflow_jobs where organization_id = $1", [org]);
  for (const id of [`${org}-job-1`, `${org}-job-2`, `${org}-job-3`, `${org}-job-4`]) {
    await pool.query(
      "insert into workflow_jobs (id, organization_id, status, input) values ($1, $2, 'queued', '{}'::jsonb)",
      [id, org],
    );
  }

  const [a, b] = await Promise.all([claimQueuedWorkflowJobs(pool, 2), claimQueuedWorkflowJobs(pool, 2)]);
  const claimedA = a.map((row) => row.id);
  const claimedB = b.map((row) => row.id);
  const overlap = claimedA.filter((id) => claimedB.includes(id));

  assert.equal(overlap.length, 0, "no job was claimed by both workers");
  assert.equal(new Set([...claimedA, ...claimedB]).size, 4, "all four jobs claimed exactly once");
});

test("retention sweep with nothing expired is a no-op — no audit spam, no write", async () => {
  const repository = getWorkspaceRepository();
  const cleanOrg = `${org}-clean`;
  const before = await repository.listAuditLogs(cleanOrg, 50);

  const sweep = await runRetentionSweepForTenant(repository, cleanOrg);
  assert.equal(sweep.expired, 0, "nothing to expire");

  const after = await repository.listAuditLogs(cleanOrg, 50);
  assert.equal(after.length, before.length, "no audit event is written when nothing expired");

  const pool = getDatabasePool();
  if (pool) {
    const row = await pool.query("select count(*)::int as n from workspace_snapshots where organization_id = $1", [cleanOrg]);
    assert.equal(row.rows[0].n, 0, "no workspace row is written for a no-op sweep");
  }
});

test("pruneIdempotencyRecords removes only records older than the window", async () => {
  const pool = getDatabasePool();
  assert.ok(pool);
  await pool.query("delete from idempotency_records where organization_id = $1", [org]);
  await pool.query(
    "insert into idempotency_records (organization_id, scope, idempotency_key, response, created_at) values ($1, 'prune', 'old', '{}'::jsonb, now() - interval '30 days')",
    [org],
  );
  await pool.query(
    "insert into idempotency_records (organization_id, scope, idempotency_key, response) values ($1, 'prune', 'fresh', '{}'::jsonb)",
    [org],
  );

  const pruned = await pruneIdempotencyRecords(pool, 7);
  assert.ok(pruned >= 1, "at least the old record is pruned");

  const remaining = await pool.query<{ idempotency_key: string }>(
    "select idempotency_key from idempotency_records where organization_id = $1 and scope = 'prune'",
    [org],
  );
  const keys = remaining.rows.map((r) => r.idempotency_key);
  assert.equal(keys.includes("fresh"), true, "recent record retained");
  assert.equal(keys.includes("old"), false, "old record pruned");
  await pool.query("delete from idempotency_records where organization_id = $1", [org]);
});

test("runWorkerTick completes across tenants without throwing", async () => {
  const summary = await runWorkerTick();
  assert.equal(typeof summary.tenants, "number");
  assert.equal(Array.isArray(summary.errors), true);
});
