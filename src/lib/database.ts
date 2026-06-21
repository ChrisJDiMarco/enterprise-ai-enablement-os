import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import type { AuditLog } from "./enterprise-ai-data.ts";
import {
  resealAuditLogs,
  sealAuditLog,
  sortAuditLogsChronologically,
  verifyAuditChain,
  type AuditIntegrityVerification,
} from "./audit-integrity.ts";
import {
  databaseReadinessFromEnv,
  missingProductionDatabaseReason,
  productionDatabaseFallbackAllowed,
  type DatabaseReadiness,
  type DatabaseMode,
} from "./runtime-readiness-policy.ts";
import { ensureDomainSchema, syncWorkspaceDomainProjectionClient } from "./domain-repository.ts";
import { tenantScopedJsonPath } from "./tenant-file-storage.ts";
import { emptyWorkspace, type EnterpriseWorkspace, normalizeWorkspace } from "./workspace-schema.ts";

/**
 * The result a {@link WorkspaceMutator} returns. `commit: true` persists the new
 * workspace (and optionally seals one audit log) atomically; `commit: false`
 * leaves storage untouched (used for validation failures / no-ops).
 */
export type WorkspaceMutation<T> =
  | { commit: true; workspace: EnterpriseWorkspace; result: T; auditLog?: AuditLog }
  | { commit: false; result: T };

export type WorkspaceMutator<T> = (
  workspace: EnterpriseWorkspace,
) => WorkspaceMutation<T> | Promise<WorkspaceMutation<T>>;

export type WorkspaceMutationOutcome<T> = {
  committed: boolean;
  workspace: EnterpriseWorkspace;
  result: T;
  auditLog?: AuditLog;
};

export interface WorkspaceRepository {
  mode: DatabaseMode;
  getWorkspace(organizationId: string): Promise<EnterpriseWorkspace>;
  saveWorkspace(workspace: EnterpriseWorkspace): Promise<EnterpriseWorkspace>;
  /**
   * Atomic read-modify-write. The current workspace is read INSIDE a per-tenant
   * lock, handed to `mutator`, and the result persisted before the lock releases —
   * so concurrent editors in the same org can never silently clobber each other
   * (no lost updates). Prefer this over getWorkspace + saveWorkspace.
   */
  mutateWorkspace<T>(organizationId: string, mutator: WorkspaceMutator<T>): Promise<WorkspaceMutationOutcome<T>>;
  appendAuditLog(organizationId: string, log: AuditLog): Promise<AuditLog>;
  listAuditLogs(organizationId: string, limit?: number): Promise<AuditLog[]>;
  sealLegacyAuditChain(organizationId: string): Promise<AuditChainMaintenanceResult>;
  readiness(): DatabaseReadiness;
}

/** Serializes async work per key within a single process (file-mode fallback). */
function createKeyedSerializer() {
  const chains = new Map<string, Promise<unknown>>();
  return function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = chains.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    chains.set(
      key,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  };
}

export type AuditChainMaintenanceResult = {
  action: "seal_legacy_chain";
  changed: boolean;
  resealed: number;
  migrationLog?: AuditLog;
  integrity: AuditIntegrityVerification;
  note: string;
};

let pool: Pool | null = null;

// File-mode repositories are constructed per request, so the lock map must be
// module-scoped to serialize read-modify-write across requests in one process.
const fileWorkspaceSerializer = createKeyedSerializer();

function poolMax() {
  const parsed = Number(process.env.DATABASE_POOL_MAX);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 100 ? parsed : 10;
}

export function getDatabasePool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: poolMax(),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // An unhandled 'error' on an idle client crashes the process. Log instead so a
    // transient backend drop can't take the whole server down.
    pool.on("error", (error) => {
      if (process.env.NODE_ENV !== "test") {
        console.error("[database] idle client error", error.message);
      }
    });
  }
  return pool;
}

/** Closes the pool (for tests / explicit shutdown hooks). */
export async function closeDatabasePool() {
  if (pool) {
    const closing = pool;
    pool = null;
    await closing.end();
  }
}

async function ensurePostgresSchema(activePool: Pool) {
  await activePool.query(`
    create table if not exists workspace_snapshots (
      organization_id text primary key,
      data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists audit_events (
      id text primary key,
      organization_id text not null,
      event_type text not null,
      message text not null,
      actor text not null,
      risk_level text not null,
      created_at timestamptz not null default now(),
      payload jsonb not null default '{}'::jsonb
    );

    create index if not exists audit_events_org_created_idx
      on audit_events (organization_id, created_at desc);

    create table if not exists workflow_jobs (
      id text primary key,
      organization_id text not null,
      workflow_id text,
      skill_id text,
      status text not null,
      input jsonb not null default '{}'::jsonb,
      output jsonb,
      error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists connector_events (
      id text primary key,
      organization_id text not null,
      skill_id text,
      tool_id text not null,
      status text not null,
      decision jsonb not null,
      payload jsonb not null default '{}'::jsonb,
      envelope jsonb,
      created_at timestamptz not null default now()
    );

    create index if not exists workflow_jobs_org_created_idx
      on workflow_jobs (organization_id, created_at desc);

    create index if not exists connector_events_org_created_idx
      on connector_events (organization_id, created_at desc);

    create table if not exists tenant_secrets (
      organization_id text not null,
      secret_name text not null,
      encrypted_value text not null,
      iv text not null,
      tag text not null,
      updated_at timestamptz not null default now(),
      primary key (organization_id, secret_name)
    );

    create index if not exists tenant_secrets_org_updated_idx
      on tenant_secrets (organization_id, updated_at desc);

    create table if not exists run_traces (
      id text primary key,
      organization_id text not null,
      run_id text not null,
      skill_id text,
      status text not null,
      risk_level text not null,
      payload jsonb not null,
      created_at timestamptz not null default now()
    );

    create index if not exists run_traces_org_created_idx
      on run_traces (organization_id, created_at desc);

    create index if not exists run_traces_org_run_idx
      on run_traces (organization_id, run_id);

    create table if not exists eval_artifacts (
      id text primary key,
      organization_id text not null,
      skill_id text not null,
      suite_id text not null,
      score integer not null,
      passed boolean not null,
      payload jsonb not null,
      created_at timestamptz not null default now()
    );

    create index if not exists eval_artifacts_org_created_idx
      on eval_artifacts (organization_id, created_at desc);

    create index if not exists eval_artifacts_org_skill_idx
      on eval_artifacts (organization_id, skill_id);

    create table if not exists context_index_documents (
      id text primary key,
      organization_id text not null,
      source_id text not null,
      source_name text not null,
      title text not null,
      classification text not null,
      owner_department text not null,
      payload jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists context_index_documents_org_updated_idx
      on context_index_documents (organization_id, updated_at desc);

    create index if not exists context_index_documents_org_source_idx
      on context_index_documents (organization_id, source_id);

    create table if not exists session_revocations (
      organization_id text not null,
      user_id text not null,
      revoked_after timestamptz not null default now(),
      primary key (organization_id, user_id)
    );
  `);
  await activePool.query("alter table connector_events add column if not exists envelope jsonb");
  await ensureDomainSchema(activePool);
}

function legacyOnlyGaps(integrity: AuditIntegrityVerification) {
  return integrity.gaps.every((gap) => gap.includes("legacy audit log"));
}

function createAuditChainMigrationLog(resealedCount: number): AuditLog {
  return {
    id: `audit-chain-migration-${Date.now()}`,
    eventType: "audit_chain_resealed",
    message: `Legacy audit chain sealed for ${resealedCount} stored record${resealedCount === 1 ? "" : "s"}. This migration proves current stored state from this point forward; it does not claim historical immutability before the migration time.`,
    actor: "Audit Integrity Migrator",
    riskLevel: "low",
    createdAt: new Date().toISOString(),
  };
}

function assertSafeAuditChainMigration(integrity: AuditIntegrityVerification) {
  if (integrity.verified || legacyOnlyGaps(integrity)) return;
  throw new Error(
    `Audit chain has non-legacy integrity gaps and cannot be resealed automatically: ${integrity.gaps[0] ?? "unknown gap"}`,
  );
}

function noAuditChainMigrationNeeded(integrity: AuditIntegrityVerification): AuditChainMaintenanceResult {
  return {
    action: "seal_legacy_chain",
    changed: false,
    resealed: 0,
    integrity,
    note: "Audit chain already verifies without legacy gaps.",
  };
}

function isAuditLogRecord(value: unknown): value is AuditLog {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.eventType === "string" &&
    typeof record.message === "string" &&
    typeof record.actor === "string" &&
    typeof record.riskLevel === "string" &&
    typeof record.createdAt === "string"
  );
}

function completeAuditChainMigration(
  organizationId: string,
  existingLogs: AuditLog[],
): { descendingLogs: AuditLog[]; result: AuditChainMaintenanceResult } {
  const initialIntegrity = verifyAuditChain(organizationId, existingLogs);
  assertSafeAuditChainMigration(initialIntegrity);
  if (initialIntegrity.legacy === 0 && initialIntegrity.verified) {
    return {
      descendingLogs: sortAuditLogsChronologically(existingLogs).reverse(),
      result: noAuditChainMigrationNeeded(initialIntegrity),
    };
  }

  const sealedAt = new Date().toISOString();
  const resealed = resealAuditLogs({
    organizationId,
    logs: existingLogs,
    sealedAt,
  }).logs;
  const migrationLog = sealAuditLog({
    organizationId,
    log: createAuditChainMigrationLog(existingLogs.length),
    existingLogs: resealed,
    sealedAt,
  });
  const fullChain = [...resealed, migrationLog];
  const integrity = verifyAuditChain(organizationId, fullChain);

  if (!integrity.verified) {
    throw new Error(`Audit chain migration did not produce a verifiable chain: ${integrity.gaps[0] ?? "unknown gap"}`);
  }

  return {
    descendingLogs: sortAuditLogsChronologically(fullChain).reverse(),
    result: {
      action: "seal_legacy_chain",
      changed: true,
      resealed: existingLogs.length,
      migrationLog,
      integrity,
      note: "Legacy records were sealed as migration evidence from their current stored state. Future records extend this chain.",
    },
  };
}

export async function ensureDatabaseSchema(activePool: Pool) {
  await ensurePostgresSchema(activePool);
}

class PostgresWorkspaceRepository implements WorkspaceRepository {
  mode = "postgres" as const;
  private readonly activePool: Pool;

  constructor(activePool: Pool) {
    this.activePool = activePool;
  }

  async getWorkspace(organizationId: string) {
    await ensurePostgresSchema(this.activePool);
    const result = await this.activePool.query<{ data: EnterpriseWorkspace }>(
      "select data from workspace_snapshots where organization_id = $1",
      [organizationId],
    );
    return result.rows[0]?.data ? normalizeWorkspace(result.rows[0].data, organizationId) : emptyWorkspace(organizationId);
  }

  private async readWorkspaceRow(client: PoolClient, organizationId: string) {
    const result = await client.query<{ data: EnterpriseWorkspace }>(
      "select data from workspace_snapshots where organization_id = $1",
      [organizationId],
    );
    return result.rows[0]?.data ? normalizeWorkspace(result.rows[0].data, organizationId) : emptyWorkspace(organizationId);
  }

  private async writeWorkspaceRow(client: PoolClient, normalized: EnterpriseWorkspace) {
    await client.query(
      `
      insert into workspace_snapshots (organization_id, data, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (organization_id)
      do update set data = excluded.data, updated_at = now()
      `,
      [normalized.organizationId, JSON.stringify(normalized)],
    );
    await syncWorkspaceDomainProjectionClient(client, normalized);
  }

  private async sealAndInsertAuditLog(client: PoolClient, organizationId: string, log: AuditLog) {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`audit:${organizationId}`]);
    const existing = await client.query<{ payload: AuditLog }>(
      "select payload from audit_events where organization_id = $1 order by created_at desc limit 10000",
      [organizationId],
    );
    const sealedLog = sealAuditLog({
      organizationId,
      log,
      existingLogs: existing.rows.map((row) => row.payload),
    });
    await client.query(
      `
      insert into audit_events (id, organization_id, event_type, message, actor, risk_level, created_at, payload)
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      on conflict (id) do nothing
      `,
      [
        sealedLog.id,
        organizationId,
        sealedLog.eventType,
        sealedLog.message,
        sealedLog.actor,
        sealedLog.riskLevel,
        new Date(sealedLog.createdAt),
        JSON.stringify(sealedLog),
      ],
    );
    return sealedLog;
  }

  async saveWorkspace(workspace: EnterpriseWorkspace) {
    await ensurePostgresSchema(this.activePool);
    const normalized = normalizeWorkspace(workspace, workspace.organizationId);
    const client = await this.activePool.connect();
    try {
      await client.query("begin");
      await this.writeWorkspaceRow(client, normalized);
      await client.query("commit");
      return normalized;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async mutateWorkspace<T>(organizationId: string, mutator: WorkspaceMutator<T>): Promise<WorkspaceMutationOutcome<T>> {
    await ensurePostgresSchema(this.activePool);
    const client = await this.activePool.connect();
    try {
      await client.query("begin");
      // Per-tenant lock acquired BEFORE the read so the whole read-modify-write
      // is serialized against other writers for this organization.
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [`workspace:${organizationId}`]);
      const current = await this.readWorkspaceRow(client, organizationId);
      const mutation = await mutator(current);

      if (!mutation.commit) {
        await client.query("rollback").catch(() => undefined);
        return { committed: false, workspace: current, result: mutation.result };
      }

      let next = normalizeWorkspace({ ...mutation.workspace, updatedAt: new Date().toISOString() }, organizationId);
      let auditLog: AuditLog | undefined;
      if (mutation.auditLog) {
        auditLog = await this.sealAndInsertAuditLog(client, organizationId, mutation.auditLog);
        next = normalizeWorkspace(
          { ...next, auditLogs: [auditLog, ...next.auditLogs.filter((entry) => entry.id !== auditLog!.id)] },
          organizationId,
        );
      }
      await this.writeWorkspaceRow(client, next);
      await client.query("commit");
      return { committed: true, workspace: next, result: mutation.result, auditLog };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async appendAuditLog(organizationId: string, log: AuditLog) {
    await ensurePostgresSchema(this.activePool);
    const client = await this.activePool.connect();
    try {
      await client.query("begin");
      const sealedLog = await this.sealAndInsertAuditLog(client, organizationId, log);
      await client.query("commit");
      return sealedLog;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listAuditLogs(organizationId: string, limit = 100) {
    await ensurePostgresSchema(this.activePool);
    const result = await this.activePool.query<{ payload: AuditLog }>(
      "select payload from audit_events where organization_id = $1 order by created_at desc limit $2",
      [organizationId, limit],
    );
    return result.rows.map((row) => row.payload);
  }

  async sealLegacyAuditChain(organizationId: string) {
    await ensurePostgresSchema(this.activePool);
    const client = await this.activePool.connect();

    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [`audit:${organizationId}`]);
      const existing = await client.query<{ payload: AuditLog }>(
        "select payload from audit_events where organization_id = $1 order by created_at asc, id asc",
        [organizationId],
      );
      const existingLogs = existing.rows.map((row) => row.payload);
      const { result, descendingLogs } = completeAuditChainMigration(organizationId, existingLogs);

      if (!result.changed) {
        await client.query("commit");
        return result;
      }

      for (const log of descendingLogs) {
        await client.query(
          `
          insert into audit_events (id, organization_id, event_type, message, actor, risk_level, created_at, payload)
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          on conflict (id)
          do update set event_type = excluded.event_type,
            message = excluded.message,
            actor = excluded.actor,
            risk_level = excluded.risk_level,
            created_at = excluded.created_at,
            payload = excluded.payload
          `,
          [
            log.id,
            organizationId,
            log.eventType,
            log.message,
            log.actor,
            log.riskLevel,
            new Date(log.createdAt),
            JSON.stringify(log),
          ],
        );
      }

      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  readiness(): DatabaseReadiness {
    return {
      mode: "postgres",
      configured: true,
      durable: true,
      reason: "DATABASE_URL is configured. Workspace snapshots and audit events use Postgres.",
    };
  }
}

class FileWorkspaceRepository implements WorkspaceRepository {
  mode = "file" as const;
  private readonly baseDir = path.join(process.cwd(), ".data");

  private workspacePath(organizationId: string) {
    return tenantScopedJsonPath(path.join(this.baseDir, "workspaces"), organizationId);
  }

  private auditPath(organizationId: string) {
    return tenantScopedJsonPath(path.join(this.baseDir, "audit"), organizationId);
  }

  async getWorkspace(organizationId: string) {
    try {
      const raw = await readFile(this.workspacePath(organizationId), "utf8");
      return normalizeWorkspace(JSON.parse(raw) as Partial<EnterpriseWorkspace>, organizationId);
    } catch {
      return emptyWorkspace(organizationId);
    }
  }

  async saveWorkspace(workspace: EnterpriseWorkspace) {
    const normalized = normalizeWorkspace(workspace, workspace.organizationId);
    await mkdir(path.dirname(this.workspacePath(normalized.organizationId)), { recursive: true });
    await writeFile(this.workspacePath(normalized.organizationId), JSON.stringify(normalized, null, 2));
    return normalized;
  }

  async mutateWorkspace<T>(organizationId: string, mutator: WorkspaceMutator<T>): Promise<WorkspaceMutationOutcome<T>> {
    return fileWorkspaceSerializer(`workspace:${organizationId}`, async () => {
      const current = await this.getWorkspace(organizationId);
      const mutation = await mutator(current);
      if (!mutation.commit) {
        return { committed: false, workspace: current, result: mutation.result };
      }
      let next = normalizeWorkspace({ ...mutation.workspace, updatedAt: new Date().toISOString() }, organizationId);
      let auditLog: AuditLog | undefined;
      if (mutation.auditLog) {
        auditLog = await this.appendAuditLog(organizationId, mutation.auditLog);
        next = normalizeWorkspace(
          { ...next, auditLogs: [auditLog, ...next.auditLogs.filter((entry) => entry.id !== auditLog!.id)] },
          organizationId,
        );
      }
      const saved = await this.saveWorkspace(next);
      return { committed: true, workspace: saved, result: mutation.result, auditLog };
    });
  }

  async appendAuditLog(organizationId: string, log: AuditLog) {
    const logs = await this.listAuditLogs(organizationId, 10000);
    const sealedLog = sealAuditLog({ organizationId, log, existingLogs: logs });
    const nextLogs = [sealedLog, ...logs.filter((item) => item.id !== sealedLog.id)];
    await mkdir(path.dirname(this.auditPath(organizationId)), { recursive: true });
    await writeFile(this.auditPath(organizationId), JSON.stringify(nextLogs, null, 2));
    return sealedLog;
  }

  async listAuditLogs(organizationId: string, limit = 100) {
    try {
      const raw = await readFile(this.auditPath(organizationId), "utf8");
      const parsed: unknown = JSON.parse(raw);
      // The audit log is a tamper-evidence control: never trust the raw cast.
      // A corrupt file must not become a parsed string (slice-able) or a
      // malformed record that silently breaks downstream chain verification.
      if (!Array.isArray(parsed)) {
        console.error("[database] audit log file is not an array; refusing to trust it", { organizationId });
        return [];
      }
      const logs = parsed.filter(isAuditLogRecord);
      if (logs.length !== parsed.length) {
        console.error("[database] dropped malformed audit log entries", {
          organizationId,
          dropped: parsed.length - logs.length,
        });
      }
      return logs.slice(0, limit);
    } catch {
      return [];
    }
  }

  async sealLegacyAuditChain(organizationId: string) {
    const logs = await this.listAuditLogs(organizationId, 10000);
    const { result, descendingLogs } = completeAuditChainMigration(organizationId, logs);
    if (result.changed) {
      await mkdir(path.dirname(this.auditPath(organizationId)), { recursive: true });
      await writeFile(this.auditPath(organizationId), JSON.stringify(descendingLogs, null, 2));
    }
    return result;
  }

  readiness(): DatabaseReadiness {
    return databaseReadinessFromEnv(process.env);
  }
}

class UnconfiguredWorkspaceRepository implements WorkspaceRepository {
  mode = "unconfigured" as const;

  private unavailable(): never {
    throw new Error(missingProductionDatabaseReason);
  }

  async getWorkspace(): Promise<EnterpriseWorkspace> {
    return this.unavailable();
  }

  async saveWorkspace(): Promise<EnterpriseWorkspace> {
    return this.unavailable();
  }

  async mutateWorkspace<T>(): Promise<WorkspaceMutationOutcome<T>> {
    return this.unavailable();
  }

  async appendAuditLog(): Promise<AuditLog> {
    return this.unavailable();
  }

  async listAuditLogs(): Promise<AuditLog[]> {
    return this.unavailable();
  }

  async sealLegacyAuditChain(): Promise<AuditChainMaintenanceResult> {
    return this.unavailable();
  }

  readiness(): DatabaseReadiness {
    return databaseReadinessFromEnv(process.env);
  }
}

export function getWorkspaceRepository(): WorkspaceRepository {
  const activePool = getDatabasePool();
  if (!activePool && !productionDatabaseFallbackAllowed(process.env)) return new UnconfiguredWorkspaceRepository();
  return activePool ? new PostgresWorkspaceRepository(activePool) : new FileWorkspaceRepository();
}

export function getDatabaseReadiness() {
  return getWorkspaceRepository().readiness();
}

export function persistenceUnavailable(repository: WorkspaceRepository) {
  const readiness = repository.readiness();
  return readiness.configured
    ? null
    : {
        error: "Workspace persistence unavailable.",
        persistence: readiness,
      };
}

export async function checkDatabaseHealth() {
  const activePool = getDatabasePool();
  if (activePool) {
    await ensurePostgresSchema(activePool);
    await activePool.query("select 1");
    return {
      ok: true,
      mode: "postgres" as const,
      detail: "Postgres connection is healthy.",
    };
  }

  if (!productionDatabaseFallbackAllowed(process.env)) {
    return {
      ok: false,
      mode: "unconfigured" as const,
      detail: missingProductionDatabaseReason,
    };
  }

  await mkdir(path.join(process.cwd(), ".data"), { recursive: true });
  return {
    ok: true,
    mode: "file" as const,
    detail: "Local file persistence directory is writable.",
  };
}
