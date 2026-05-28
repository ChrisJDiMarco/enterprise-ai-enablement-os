import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type { AuditLog } from "@/lib/enterprise-ai-data";
import { emptyWorkspace, EnterpriseWorkspace, normalizeWorkspace } from "@/lib/workspace-schema";

type DatabaseMode = "postgres" | "file";

export type DatabaseReadiness = {
  mode: DatabaseMode;
  configured: boolean;
  durable: boolean;
  reason: string;
};

export interface WorkspaceRepository {
  mode: DatabaseMode;
  getWorkspace(organizationId: string): Promise<EnterpriseWorkspace>;
  saveWorkspace(workspace: EnterpriseWorkspace): Promise<EnterpriseWorkspace>;
  appendAuditLog(organizationId: string, log: AuditLog): Promise<void>;
  listAuditLogs(organizationId: string, limit?: number): Promise<AuditLog[]>;
  readiness(): DatabaseReadiness;
}

let pool: Pool | null = null;

export function getDatabasePool() {
  if (!process.env.DATABASE_URL) return null;
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
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
      created_at timestamptz not null default now()
    );

    create index if not exists workflow_jobs_org_created_idx
      on workflow_jobs (organization_id, created_at desc);

    create index if not exists connector_events_org_created_idx
      on connector_events (organization_id, created_at desc);
  `);
}

export async function ensureDatabaseSchema(activePool: Pool) {
  await ensurePostgresSchema(activePool);
}

class PostgresWorkspaceRepository implements WorkspaceRepository {
  mode = "postgres" as const;

  constructor(private readonly activePool: Pool) {}

  async getWorkspace(organizationId: string) {
    await ensurePostgresSchema(this.activePool);
    const result = await this.activePool.query<{ data: EnterpriseWorkspace }>(
      "select data from workspace_snapshots where organization_id = $1",
      [organizationId],
    );
    return result.rows[0]?.data ? normalizeWorkspace(result.rows[0].data, organizationId) : emptyWorkspace(organizationId);
  }

  async saveWorkspace(workspace: EnterpriseWorkspace) {
    await ensurePostgresSchema(this.activePool);
    const normalized = normalizeWorkspace(workspace, workspace.organizationId);
    await this.activePool.query(
      `
      insert into workspace_snapshots (organization_id, data, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (organization_id)
      do update set data = excluded.data, updated_at = now()
      `,
      [normalized.organizationId, JSON.stringify(normalized)],
    );
    return normalized;
  }

  async appendAuditLog(organizationId: string, log: AuditLog) {
    await ensurePostgresSchema(this.activePool);
    await this.activePool.query(
      `
      insert into audit_events (id, organization_id, event_type, message, actor, risk_level, created_at, payload)
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      on conflict (id) do nothing
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

  async listAuditLogs(organizationId: string, limit = 100) {
    await ensurePostgresSchema(this.activePool);
    const result = await this.activePool.query<{ payload: AuditLog }>(
      "select payload from audit_events where organization_id = $1 order by created_at desc limit $2",
      [organizationId, limit],
    );
    return result.rows.map((row) => row.payload);
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
    return path.join(this.baseDir, "workspaces", `${organizationId}.json`);
  }

  private auditPath(organizationId: string) {
    return path.join(this.baseDir, "audit", `${organizationId}.json`);
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

  async appendAuditLog(organizationId: string, log: AuditLog) {
    const logs = await this.listAuditLogs(organizationId, 10000);
    const nextLogs = [log, ...logs.filter((item) => item.id !== log.id)];
    await mkdir(path.dirname(this.auditPath(organizationId)), { recursive: true });
    await writeFile(this.auditPath(organizationId), JSON.stringify(nextLogs, null, 2));
  }

  async listAuditLogs(organizationId: string, limit = 100) {
    try {
      const raw = await readFile(this.auditPath(organizationId), "utf8");
      const logs = JSON.parse(raw) as AuditLog[];
      return logs.slice(0, limit);
    } catch {
      return [];
    }
  }

  readiness(): DatabaseReadiness {
    return {
      mode: "file",
      configured: true,
      durable: false,
      reason: "DATABASE_URL is not configured. Using local file persistence under .data for development.",
    };
  }
}

export function getWorkspaceRepository(): WorkspaceRepository {
  const activePool = getDatabasePool();
  return activePool ? new PostgresWorkspaceRepository(activePool) : new FileWorkspaceRepository();
}

export function getDatabaseReadiness() {
  return getWorkspaceRepository().readiness();
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

  await mkdir(path.join(process.cwd(), ".data"), { recursive: true });
  return {
    ok: true,
    mode: "file" as const,
    detail: "Local file persistence directory is writable.",
  };
}
