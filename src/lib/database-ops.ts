import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { verifyAuditChain, type AuditIntegrityVerification } from "./audit-integrity.ts";
import type { AuditLog } from "./enterprise-ai-data.ts";
import { safeTenantFileStem } from "./tenant-file-storage.ts";
import { normalizeWorkspace, type EnterpriseWorkspace } from "./workspace-schema.ts";

export type BackupDrillOperations = {
  drillCount: number;
  latestAt?: string;
  latestStatus?: "verified" | "failed";
};

export type TenantBackupSnapshot = {
  schema: "enterprise-ai-enablement-os.tenant-backup-snapshot.v1";
  generatedAt: string;
  organizationId: string;
  repositoryMode: string;
  workspace: EnterpriseWorkspace;
  auditLogs: AuditLog[];
};

export type TenantBackupRestoreDrillManifest = {
  schema: "enterprise-ai-enablement-os.backup-restore-drill.v1";
  action: "backup_restore_drill";
  dryRun: boolean;
  generatedAt: string;
  organizationId: string;
  repositoryMode: string;
  artifactId: string;
  artifactPath?: string;
  digest: string;
  byteSize: number;
  source: {
    workspaceMode: EnterpriseWorkspace["workspaceMode"];
    users: number;
    useCases: number;
    skills: number;
    runs: number;
    workSignals: number;
    auditEvents: number;
  };
  verification: {
    workspaceNormalized: boolean;
    organizationMatches: boolean;
    auditIntegrity: AuditIntegrityVerification;
  };
  guardrails: string[];
};

export type TenantBackupRestoreDrillResult = TenantBackupRestoreDrillManifest & {
  snapshot?: TenantBackupSnapshot;
};

type BackupAuditEvent = Pick<AuditLog, "eventType" | "message" | "createdAt">;

const backupDrillDir = path.join(process.cwd(), ".data", "backup-drills");

function stableJson(value: unknown) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortKeys(entry)]),
  );
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function artifactId(organizationId: string, generatedAt: string, digest: string) {
  const timestamp = generatedAt.replace(/[^0-9A-Za-z]/g, "-");
  return `backup-drill-${organizationId}-${timestamp}-${digest.slice(0, 12)}`;
}

function latestTimestamp(current: string | undefined, candidate: string) {
  const currentMs = Date.parse(current ?? "");
  const candidateMs = Date.parse(candidate);
  if (!Number.isFinite(candidateMs)) return current;
  return !Number.isFinite(currentMs) || candidateMs >= currentMs ? candidate : current;
}

export function deriveBackupDrillOperations(auditLogs: BackupAuditEvent[]): BackupDrillOperations {
  const operations: BackupDrillOperations = {
    drillCount: 0,
  };

  for (const log of auditLogs) {
    if (log.eventType !== "database_restore_drill_verified") continue;
    operations.drillCount += 1;
    operations.latestAt = latestTimestamp(operations.latestAt, log.createdAt);
    operations.latestStatus = log.message.toLowerCase().includes("failed") ? "failed" : "verified";
  }

  return operations;
}

export function buildTenantBackupSnapshot(params: {
  workspace: EnterpriseWorkspace;
  auditLogs: AuditLog[];
  repositoryMode: string;
  now?: Date;
}): TenantBackupSnapshot {
  const generatedAt = (params.now ?? new Date()).toISOString();
  return {
    schema: "enterprise-ai-enablement-os.tenant-backup-snapshot.v1",
    generatedAt,
    organizationId: params.workspace.organizationId,
    repositoryMode: params.repositoryMode,
    workspace: params.workspace,
    auditLogs: params.auditLogs,
  };
}

export function buildTenantBackupRestoreDrillManifest(params: {
  snapshot: TenantBackupSnapshot;
  dryRun?: boolean;
  artifactPath?: string;
}): TenantBackupRestoreDrillManifest {
  const snapshotJson = stableJson(params.snapshot);
  const digest = sha256(snapshotJson);
  const restoredWorkspace = normalizeWorkspace(params.snapshot.workspace, params.snapshot.organizationId);
  const auditIntegrity = verifyAuditChain(params.snapshot.organizationId, params.snapshot.auditLogs);

  return {
    schema: "enterprise-ai-enablement-os.backup-restore-drill.v1",
    action: "backup_restore_drill",
    dryRun: params.dryRun ?? true,
    generatedAt: params.snapshot.generatedAt,
    organizationId: params.snapshot.organizationId,
    repositoryMode: params.snapshot.repositoryMode,
    artifactId: artifactId(params.snapshot.organizationId, params.snapshot.generatedAt, digest),
    artifactPath: params.artifactPath,
    digest,
    byteSize: Buffer.byteLength(snapshotJson, "utf8"),
    source: {
      workspaceMode: params.snapshot.workspace.workspaceMode,
      users: params.snapshot.workspace.users.length,
      useCases: params.snapshot.workspace.useCases.length,
      skills: params.snapshot.workspace.skills.length,
      runs: params.snapshot.workspace.runs.length,
      workSignals: params.snapshot.workspace.workSignals.length,
      auditEvents: params.snapshot.auditLogs.length,
    },
    verification: {
      workspaceNormalized: restoredWorkspace.organizationId === params.snapshot.organizationId,
      organizationMatches: restoredWorkspace.organizationId === params.snapshot.workspace.organizationId,
      auditIntegrity,
    },
    guardrails: [
      "The drill verifies snapshot readability and tenant normalization without restoring over live data.",
      "The backup artifact includes workspace state and sealed audit evidence for one tenant.",
      "Production launches still require managed backup storage and an out-of-band restore drill.",
    ],
  };
}

export async function runTenantBackupRestoreDrill(params: {
  workspace: EnterpriseWorkspace;
  auditLogs: AuditLog[];
  repositoryMode: string;
  dryRun?: boolean;
  now?: Date;
  writeArtifact?: boolean;
}): Promise<TenantBackupRestoreDrillResult> {
  const dryRun = params.dryRun ?? true;
  const snapshot = buildTenantBackupSnapshot(params);
  const writeArtifact = params.writeArtifact ?? !dryRun;
  let artifactPath: string | undefined;

  if (writeArtifact) {
    const preview = buildTenantBackupRestoreDrillManifest({ snapshot, dryRun });
    artifactPath = path.join(backupDrillDir, safeTenantFileStem(snapshot.organizationId), `${preview.artifactId}.json`);
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, `${stableJson(snapshot)}\n`, "utf8");
  }

  const manifest = buildTenantBackupRestoreDrillManifest({ snapshot, dryRun, artifactPath });
  return {
    ...manifest,
    snapshot: dryRun ? snapshot : undefined,
  };
}
