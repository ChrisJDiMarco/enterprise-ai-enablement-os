import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { sealAuditLog } from "../src/lib/audit-integrity.ts";
import {
  buildTenantBackupRestoreDrillManifest,
  buildTenantBackupSnapshot,
  deriveBackupDrillOperations,
  runTenantBackupRestoreDrill,
} from "../src/lib/database-ops.ts";
import type { AuditLog } from "../src/lib/enterprise-ai-data.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";

function auditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "audit-1",
    eventType: "workspace_saved",
    message: "Workspace saved.",
    actor: "Admin",
    riskLevel: "low",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

test("buildTenantBackupRestoreDrillManifest verifies workspace normalization and audit chain", () => {
  const organizationId = "backup-test";
  const workspace = emptyWorkspace(organizationId);
  const sealed = sealAuditLog({
    organizationId,
    log: auditLog(),
    existingLogs: [],
    sealedAt: "2026-06-01T00:00:00.000Z",
  });
  const snapshot = buildTenantBackupSnapshot({
    workspace,
    auditLogs: [sealed],
    repositoryMode: "file",
    now: new Date("2026-06-01T00:00:00.000Z"),
  });
  const manifest = buildTenantBackupRestoreDrillManifest({ snapshot });

  assert.equal(manifest.schema, "enterprise-ai-enablement-os.backup-restore-drill.v1");
  assert.equal(manifest.source.auditEvents, 1);
  assert.equal(manifest.verification.workspaceNormalized, true);
  assert.equal(manifest.verification.auditIntegrity.verified, true);
  assert.match(manifest.digest, /^[0-9a-f]{64}$/);
});

test("runTenantBackupRestoreDrill can apply without writing an artifact in tests", async () => {
  const organizationId = "backup-apply-test";
  const result = await runTenantBackupRestoreDrill({
    workspace: emptyWorkspace(organizationId),
    auditLogs: [],
    repositoryMode: "file",
    dryRun: false,
    writeArtifact: false,
    now: new Date("2026-06-01T00:00:00.000Z"),
  });

  assert.equal(result.dryRun, false);
  assert.equal(result.snapshot, undefined);
  assert.equal(result.artifactPath, undefined);
  assert.equal(result.verification.auditIntegrity.verified, true);
});

test("runTenantBackupRestoreDrill keeps unsafe tenant ids out of artifact paths", async () => {
  const organizationId = "../../../outside/customer.example.com";
  const result = await runTenantBackupRestoreDrill({
    workspace: emptyWorkspace(organizationId),
    auditLogs: [],
    repositoryMode: "file",
    dryRun: false,
    writeArtifact: true,
    now: new Date("2026-06-01T00:00:00.000Z"),
  });
  assert.ok(result.artifactPath);
  const baseDir = path.join(process.cwd(), ".data", "backup-drills");
  const relative = path.relative(baseDir, result.artifactPath);

  assert.equal(relative.startsWith(".."), false);
  assert.equal(path.isAbsolute(relative), false);
  assert.match(result.artifactId, /^backup-drill-tenant-[a-f0-9]{32}-/);
  assert.equal(result.artifactId.includes(".."), false);
  assert.equal(result.artifactId.includes("/"), false);
  assert.match(path.basename(result.artifactPath), /^backup-drill-tenant-[a-f0-9]{32}-.*\.json$/);
});

test("deriveBackupDrillOperations summarizes verified restore drill audit evidence", () => {
  const operations = deriveBackupDrillOperations([
    {
      eventType: "database_restore_drill_verified",
      message: "Database restore drill verified.",
      createdAt: "2026-06-01T12:00:00.000Z",
    },
    {
      eventType: "database_restore_drill_verified",
      message: "Database restore drill verified again.",
      createdAt: "2026-06-02T12:00:00.000Z",
    },
  ]);

  assert.deepEqual(operations, {
    drillCount: 2,
    latestAt: "2026-06-02T12:00:00.000Z",
    latestStatus: "verified",
  });
});
