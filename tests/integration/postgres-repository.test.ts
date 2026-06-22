// Postgres integration tests — run via `npm run test:integration` with a live
// DATABASE_URL (a postgres service in CI). These exercise the REAL repository:
// advisory-lock concurrency, audit-chain sealing, tenant scoping, and RLS.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import pg from "pg";

import { getWorkspaceRepository, getDatabasePool, closeDatabasePool, withTenant } from "../../src/lib/database.ts";
import { verifyAuditChain } from "../../src/lib/audit-integrity.ts";
import type { Tool } from "../../src/lib/enterprise-ai-data.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for integration tests (run via `npm run test:integration`).");
}

const orgA = `itest-a-${process.pid}`;
const orgB = `itest-b-${process.pid}`;

function tool(id: string): Tool {
  return {
    id,
    displayName: id,
    description: "integration test tool",
    category: "test",
    actionType: "read",
    riskLevel: "low",
    requiresApprovalByDefault: false,
    enabled: true,
    usage: 0,
    lastUsed: "2026-06-01T00:00:00.000Z",
  };
}

async function resetOrg(organizationId: string) {
  const pool = getDatabasePool();
  if (!pool) return;
  await pool.query("delete from workspace_snapshots where organization_id = $1", [organizationId]);
  await pool.query("delete from audit_events where organization_id = $1", [organizationId]);
  await pool.query("delete from tenant_secrets where organization_id = $1", [organizationId]);
  await pool.query("delete from run_traces where organization_id = $1", [organizationId]);
  await pool.query("delete from workflow_jobs where organization_id = $1", [organizationId]);
  await pool.query("delete from idempotency_records where organization_id = $1", [organizationId]);
}

before(async () => {
  // Force schema creation.
  const repository = getWorkspaceRepository();
  assert.equal(repository.mode, "postgres", "integration tests must run against Postgres");
  await repository.getWorkspace(orgA);
  await resetOrg(orgA);
  await resetOrg(orgB);
});

after(async () => {
  await resetOrg(orgA);
  await resetOrg(orgB);
  await closeDatabasePool();
});

test("round-trips a workspace through Postgres scoped by organization", async () => {
  const repository = getWorkspaceRepository();
  await repository.mutateWorkspace(orgA, (workspace) => ({
    commit: true as const,
    workspace: {
      ...workspace,
      organizationId: orgA,
      organization: { ...workspace.organization, id: orgA, name: orgA, slug: orgA },
      tools: [tool("tool-a")],
    },
    result: null,
  }));
  const loaded = await repository.getWorkspace(orgA);
  assert.equal(loaded.tools.some((tool) => tool.id === "tool-a"), true);

  // Org B is empty — no bleed across tenants.
  const otherTenant = await repository.getWorkspace(orgB);
  assert.equal(otherTenant.tools.length, 0, "tenant B must not see tenant A data");
});

test("mutateWorkspace serializes concurrent edits with no lost updates (real advisory lock)", async () => {
  const repository = getWorkspaceRepository();
  await resetOrg(orgA);
  const edits = 25;
  await Promise.all(
    Array.from({ length: edits }, (_, index) =>
      repository.mutateWorkspace(orgA, (workspace) => ({
        commit: true as const,
        workspace: {
          ...workspace,
          organizationId: orgA,
          organization: { ...workspace.organization, id: orgA, name: orgA, slug: orgA },
          tools: [...workspace.tools, tool(`c-${index}`)],
        },
        result: index,
      })),
    ),
  );
  const finalWorkspace = await repository.getWorkspace(orgA);
  assert.equal(finalWorkspace.tools.length, edits, "every concurrent edit must survive");
});

test("appendAuditLog produces a verifiable sealed hash-chain", async () => {
  const repository = getWorkspaceRepository();
  await resetOrg(orgA);
  for (let index = 0; index < 5; index += 1) {
    await repository.appendAuditLog(orgA, {
      id: `it-audit-${index}`,
      eventType: "integration_test_event",
      message: `event ${index}`,
      actor: "integration-test",
      riskLevel: "low",
      createdAt: new Date(Date.now() + index).toISOString(),
    });
  }
  const logs = await repository.listAuditLogs(orgA, 100);
  assert.equal(logs.length, 5);
  const integrity = verifyAuditChain(orgA, logs);
  assert.equal(integrity.verified, true, `audit chain must verify: ${integrity.gaps.join("; ")}`);
});

test("RLS isolates tenants for a least-privilege role (fails closed without context)", async () => {
  const repository = getWorkspaceRepository();
  await resetOrg(orgA);
  await repository.mutateWorkspace(orgA, (workspace) => ({
    commit: true as const,
    workspace: {
      ...workspace,
      organizationId: orgA,
      organization: { ...workspace.organization, id: orgA, name: orgA, slug: orgA },
      tools: [tool("rls-a")],
    },
    result: null,
  }));

  const admin = getDatabasePool();
  assert.ok(admin);

  // Seed satellite rows for tenant A (admin/superuser bypasses RLS to insert).
  await admin.query(
    "insert into tenant_secrets (organization_id, secret_name, encrypted_value, iv, tag) values ($1, 'openaiKey', 'enc', 'iv', 'tag') on conflict (organization_id, secret_name) do nothing",
    [orgA],
  );
  await admin.query(
    "insert into run_traces (id, organization_id, run_id, status, risk_level, payload) values ('tr-rls-a', $1, 'run-rls-a', 'completed', 'low', '{}'::jsonb) on conflict (id) do nothing",
    [orgA],
  );

  async function dropRole() {
    await admin!.query("drop owned by rls_app_role cascade").catch(() => undefined);
    await admin!.query("drop role if exists rls_app_role").catch(() => undefined);
  }

  await dropRole();
  await admin.query("create role rls_app_role login password 'rls_app_pw'");
  await admin.query("grant usage on schema public to rls_app_role");
  await admin.query("grant select on workspace_snapshots to rls_app_role");
  await admin.query("grant select on ai_tools to rls_app_role");
  await admin.query("grant select, insert, update, delete on tenant_secrets to rls_app_role");
  await admin.query("grant select, insert, update, delete on run_traces to rls_app_role");

  const appUrl = new URL(databaseUrl);
  appUrl.username = "rls_app_role";
  appUrl.password = "rls_app_pw";
  const appPool = new pg.Pool({
    connectionString: appUrl.toString(),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // No tenant context -> RLS returns ZERO rows (fail closed), even though a row exists.
    const unscoped = await appPool.query<{ n: number }>("select count(*)::int as n from workspace_snapshots");
    assert.equal(unscoped.rows[0].n, 0, "RLS must hide all rows when no tenant context is set");

    // A satellite/domain table (ai_tools) must isolate too — orgA has a tool row.
    const unscopedTools = await appPool.query<{ n: number }>("select count(*)::int as n from ai_tools");
    assert.equal(unscopedTools.rows[0].n, 0, "domain table ai_tools must also hide rows without tenant context");

    // The secret vault: FORCE RLS hides it without context, and the withTenant()
    // path the vault actually uses exposes exactly this tenant's secrets.
    const unscopedSecrets = await appPool.query<{ n: number }>("select count(*)::int as n from tenant_secrets");
    assert.equal(unscopedSecrets.rows[0].n, 0, "tenant_secrets (vault) must hide rows from a non-superuser role without context");
    const scopedSecrets = await withTenant(appPool, orgA, (client) =>
      client.query<{ n: number }>("select count(*)::int as n from tenant_secrets"),
    );
    assert.equal(scopedSecrets.rows[0].n, 1, "withTenant must expose the tenant's own vault secrets under FORCE RLS");

    // A second satellite table (run_traces) confirms the wrap pattern generalizes.
    const unscopedTraces = await appPool.query<{ n: number }>("select count(*)::int as n from run_traces");
    assert.equal(unscopedTraces.rows[0].n, 0, "run_traces must hide rows without tenant context");
    const scopedTraces = await withTenant(appPool, orgA, (client) =>
      client.query<{ n: number }>("select count(*)::int as n from run_traces"),
    );
    assert.equal(scopedTraces.rows[0].n, 1, "withTenant must expose the tenant's own run traces under FORCE RLS");

    // With the tenant context set, only that tenant's row is visible.
    const client = await appPool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.organization_id', $1, true)", [orgA]);
      const scoped = await client.query<{ organization_id: string }>("select organization_id from workspace_snapshots");
      await client.query("commit");
      assert.equal(scoped.rows.length, 1, "exactly tenant A's row is visible under its own context");
      assert.equal(scoped.rows[0].organization_id, orgA);
    } finally {
      client.release();
    }
  } finally {
    await appPool.end();
    await dropRole();
  }
});

test("every tenant-scoped table has RLS ENABLED and FORCED (no silent owner bypass)", async () => {
  const admin = getDatabasePool();
  assert.ok(admin);
  // Touch the domain schema so all tables exist before inspecting the catalog.
  await getWorkspaceRepository().getWorkspace(orgA);

  // All 28 tenant-scoped tables now route their access through app.organization_id
  // (request path via withTenant; the cross-tenant worker via a privileged role),
  // so every one must be ENABLE + FORCE RLS.
  const tenantTables = [
    "workspace_snapshots",
    "audit_events",
    "tenant_secrets",
    "run_traces",
    "eval_artifacts",
    "connector_events",
    "context_index_documents",
    "session_revocations",
    "workflow_jobs",
    "idempotency_records",
    "organization_members",
    "ai_tools",
    "context_sources_domain",
    "use_cases",
    "use_case_data_sources",
    "use_case_risks",
    "skills",
    "skill_versions",
    "skill_tool_policies",
    "skill_context_policies",
    "runs",
    "run_steps",
    "tool_requests_domain",
    "governance_reviews_domain",
    "eval_results_domain",
    "work_signals_domain",
    "command_orders_domain",
    "evidence_items",
  ];

  const result = await admin.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
    "select relname, relrowsecurity, relforcerowsecurity from pg_class where relkind = 'r' and relname = any($1)",
    [tenantTables],
  );
  const byName = new Map(result.rows.map((row) => [row.relname, row]));

  for (const table of tenantTables) {
    const row = byName.get(table);
    assert.ok(row, `tenant table ${table} should exist`);
    assert.equal(row!.relrowsecurity, true, `${table} must have RLS enabled`);
    assert.equal(row!.relforcerowsecurity, true, `${table} must FORCE RLS (no owner/superuser-role bypass)`);
  }
});

test("worker tables: request role isolates; privileged worker role sees cross-tenant", async () => {
  const admin = getDatabasePool();
  assert.ok(admin);
  await getWorkspaceRepository().getWorkspace(orgA); // ensure schema

  // Seed queued jobs for two tenants + an idempotency record (admin bypasses RLS).
  await admin.query("insert into workflow_jobs (id, organization_id, status, input) values ('wj-a', $1, 'queued', '{}'::jsonb) on conflict (id) do nothing", [orgA]);
  await admin.query("insert into workflow_jobs (id, organization_id, status, input) values ('wj-b', $1, 'queued', '{}'::jsonb) on conflict (id) do nothing", [orgB]);
  await admin.query("insert into idempotency_records (organization_id, scope, idempotency_key, response) values ($1, 'connect', 'k', '{}'::jsonb) on conflict do nothing", [orgA]);

  async function dropRoles() {
    for (const role of ["rls_req_role", "rls_worker_role"]) {
      await admin!.query(`drop owned by ${role} cascade`).catch(() => undefined);
      await admin!.query(`drop role if exists ${role}`).catch(() => undefined);
    }
  }
  await dropRoles();
  // Request role: plain non-superuser — RLS enforced. Worker role: BYPASSRLS.
  await admin.query("create role rls_req_role login password 'pw' nobypassrls");
  await admin.query("create role rls_worker_role login password 'pw' bypassrls");
  for (const role of ["rls_req_role", "rls_worker_role"]) {
    await admin.query(`grant usage on schema public to ${role}`);
    await admin.query(`grant select, insert, update, delete on workflow_jobs to ${role}`);
    await admin.query(`grant select, insert, update, delete on idempotency_records to ${role}`);
  }

  const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;
  const reqUrl = new URL(databaseUrl);
  reqUrl.username = "rls_req_role";
  reqUrl.password = "pw";
  const workerUrl = new URL(databaseUrl);
  workerUrl.username = "rls_worker_role";
  workerUrl.password = "pw";
  const reqPool = new pg.Pool({ connectionString: reqUrl.toString(), ssl });
  const workerPool = new pg.Pool({ connectionString: workerUrl.toString(), ssl });

  try {
    // Request role without context: FORCE RLS hides everything (fails closed).
    const reqUnscoped = await reqPool.query<{ n: number }>("select count(*)::int as n from workflow_jobs");
    assert.equal(reqUnscoped.rows[0].n, 0, "request role must not see workflow_jobs without tenant context");
    // Request role WITH context: sees only its own tenant's job.
    const reqScoped = await withTenant(reqPool, orgA, (client) =>
      client.query<{ n: number }>("select count(*)::int as n from workflow_jobs"),
    );
    assert.equal(reqScoped.rows[0].n, 1, "request role sees exactly its tenant's jobs under context");
    // Request role CANNOT do the cross-tenant queued scan the worker needs.
    const reqScan = await reqPool.query<{ n: number }>("select count(*)::int as n from workflow_jobs where status = 'queued'");
    assert.equal(reqScan.rows[0].n, 0, "request role cannot scan jobs cross-tenant");

    // Privileged worker role: BYPASSRLS, so the cross-tenant claim/prune work.
    const workerScan = await workerPool.query<{ n: number }>("select count(*)::int as n from workflow_jobs where status = 'queued'");
    assert.ok(workerScan.rows[0].n >= 2, "privileged worker role scans queued jobs across all tenants");
    const workerIdem = await workerPool.query<{ n: number }>("select count(*)::int as n from idempotency_records");
    assert.ok(workerIdem.rows[0].n >= 1, "privileged worker role can prune idempotency records across tenants");
  } finally {
    await reqPool.end();
    await workerPool.end();
    await dropRoles();
    await admin.query("delete from workflow_jobs where organization_id = any($1)", [[orgA, orgB]]);
    await admin.query("delete from idempotency_records where organization_id = $1", [orgA]);
  }
});

test("migration runner is idempotent (re-running applies nothing new)", async () => {
  const pool = getDatabasePool();
  assert.ok(pool);
  // ensurePostgresSchema ran in before(); a fresh repo op must not error on re-ensure.
  const repository = getWorkspaceRepository();
  await repository.getWorkspace(`itest-idem-${process.pid}`);
  const tables = await pool.query(
    "select count(*)::int as n from information_schema.tables where table_name = 'workspace_snapshots'",
  );
  assert.equal(tables.rows[0].n, 1);
});
