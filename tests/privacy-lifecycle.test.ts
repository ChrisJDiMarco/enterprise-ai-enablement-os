import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyPrivacyRetentionSweep,
  buildPrivacyExportPacket,
  createPrivacyRequestReceipt,
  derivePrivacyLifecycleOperations,
  derivePrivacyRetentionSweepPlan,
  privacyLifecycleConfigFromEnv,
} from "../src/lib/privacy-lifecycle.ts";
import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";
import type { WorkSignal } from "../src/lib/enterprise-ai-data.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";

function workSignal(overrides: Partial<WorkSignal> = {}): WorkSignal {
  return {
    id: "signal-1",
    source: "workflow",
    eventType: "workflow_delayed",
    department: "Operations",
    process: "Quarter close",
    summary: "Aggregated delay metadata without raw content.",
    metadata: { volume: 10, delayHours: 4, confidence: 0.9 },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: "system_metadata",
      retentionDays: 30,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel: "medium",
    createdAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

test("privacyLifecycleConfigFromEnv supports internal and external workflows", () => {
  assert.equal(
    privacyLifecycleConfigFromEnv({ DATA_RETENTION_DAYS: "365", PRIVACY_EXPORT_ENABLED: "true" }).mode,
    "internal-workflow",
  );
  assert.equal(
    privacyLifecycleConfigFromEnv({ DATA_RETENTION_DAYS: "365", PRIVACY_REQUEST_WORKFLOW_URL: "https://privacy.example" }).mode,
    "external-workflow",
  );
});

test("privacyLifecycleConfigFromEnv ignores malformed external workflow URLs", () => {
  const missing = privacyLifecycleConfigFromEnv({
    DATA_RETENTION_DAYS: "365",
    PRIVACY_REQUEST_WORKFLOW_URL: "http://privacy.example/workflow",
  });
  const fallback = privacyLifecycleConfigFromEnv({
    DATA_RETENTION_DAYS: "365",
    PRIVACY_REQUEST_WORKFLOW_URL: "not-a-url",
    DSR_WORKFLOW_URL: "https://privacy.example/dsr",
  });
  const internal = privacyLifecycleConfigFromEnv({
    DATA_RETENTION_DAYS: "365",
    PRIVACY_EXPORT_ENABLED: "true",
    PRIVACY_REQUEST_WORKFLOW_URL: "https://privacy.example/workflow?token=SECRET_TOKEN_123456789",
  });

  assert.equal(missing.configured, false);
  assert.equal(missing.mode, "missing");
  assert.equal(missing.requestWorkflowUrl, "");
  assert.match(missing.reason, /Privacy workflow configuration is invalid/i);
  assert.match(missing.reason, /must use HTTPS/i);

  assert.equal(fallback.configured, true);
  assert.equal(fallback.mode, "external-workflow");
  assert.equal(fallback.requestWorkflowUrl, "https://privacy.example/dsr");
  assert.match(fallback.reason, /PRIVACY_REQUEST_WORKFLOW_URL is ignored/i);

  assert.equal(internal.configured, true);
  assert.equal(internal.mode, "internal-workflow");
  assert.equal(internal.requestWorkflowUrl, "");
  assert.match(internal.reason, /query parameters/i);
  assert.equal(JSON.stringify(internal).includes("SECRET_TOKEN"), false);
});

test("buildPrivacyExportPacket returns redacted records and guardrails", () => {
  const workspace = buildDemoWorkspace("privacy-test");
  const packet = buildPrivacyExportPacket({
    workspace,
    subjectUserId: "u-david",
    now: new Date("2026-06-01T00:00:00.000Z"),
    env: { DATA_RETENTION_DAYS: "365", PRIVACY_EXPORT_ENABLED: "true" },
  });

  assert.equal(packet.schema, "enterprise-ai-enablement-os.privacy-export.v1");
  assert.equal(packet.scope, "subject");
  assert.ok(packet.subject.hash.length > 20);
  assert.ok(packet.guardrails.some((guardrail) => guardrail.includes("Raw employee message content")));
  for (const signal of packet.records.workSignals) {
    assert.equal(signal.privacy.rawContentStored, false);
    assert.equal(signal.privacy.individualScoringAllowed, false);
  }
});

test("buildPrivacyExportPacket sanitizes legacy audit and work-signal text at export time", () => {
  const workspace = {
    ...emptyWorkspace("privacy-legacy-export-test"),
    workSignals: [
      workSignal({
        id: "legacy-signal",
        userId: "u-legacy",
        process: "AP exception api_key=sk-live-sensitive1234567890",
        summary: "transcript=Employee payroll dispute and postgres://user:password@db.internal/app",
        metadata: {
          system: "payload={secret:true}",
          region: "NA",
        },
      }),
    ],
    auditLogs: [
      {
        id: "audit-legacy",
        eventType: "connector_payload_logged",
        message: "u-legacy triggered payload={secret:true} with api_key=sk-live-sensitive1234567890 and postgres://user:password@db.internal/app",
        actor: "privacy-reviewer",
        riskLevel: "high" as const,
        createdAt: "2026-06-01T12:00:00.000Z",
      },
    ],
  };

  const packet = buildPrivacyExportPacket({
    workspace,
    subjectUserId: "u-legacy",
    now: new Date("2026-06-01T00:00:00.000Z"),
    env: { DATA_RETENTION_DAYS: "365", PRIVACY_EXPORT_ENABLED: "true" },
  });
  const serialized = JSON.stringify(packet);

  assert.equal(packet.records.workSignals.length, 1);
  assert.equal(packet.records.auditEvents.length, 1);
  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("password@db.internal"), false);
  assert.equal(serialized.includes("secret:true"), false);
  assert.match(packet.records.workSignals[0]?.process ?? "", /api_key=\[redacted\]/);
  assert.match(packet.records.workSignals[0]?.summary ?? "", /transcript=\[redacted\]/);
  assert.match(String(packet.records.workSignals[0]?.metadata.system), /payload=\[redacted\]/);
  assert.match(packet.records.auditEvents[0]?.message ?? "", /payload=\[redacted\]/);
});

test("buildPrivacyExportPacket marks tenant-wide exports explicitly", () => {
  const workspace = buildDemoWorkspace("privacy-tenant-export-test");
  const packet = buildPrivacyExportPacket({
    workspace,
    now: new Date("2026-06-01T00:00:00.000Z"),
    env: { DATA_RETENTION_DAYS: "365", PRIVACY_EXPORT_ENABLED: "true" },
  });

  assert.equal(packet.scope, "tenant");
  assert.equal(packet.subject.userId, undefined);
  assert.equal(packet.subject.email, undefined);
  assert.ok(packet.records.userProfiles.length > 1);
});

test("createPrivacyRequestReceipt records forwarded request status", () => {
  const receipt = createPrivacyRequestReceipt({
    organizationId: "org-1",
    type: "delete",
    subjectEmail: "person@example.com",
    accepted: true,
    forwarded: true,
    reason: "Forwarded to workflow.",
    now: new Date("2026-06-01T00:00:00.000Z"),
  });

  assert.equal(receipt.status, "forwarded");
  assert.equal(receipt.type, "delete");
});

test("derivePrivacyRetentionSweepPlan identifies expired work signals without raw content", () => {
  const workspace = {
    ...emptyWorkspace("privacy-retention-test"),
    workSignals: [
      workSignal({ id: "expired", createdAt: "2026-04-01T00:00:00.000Z" }),
      workSignal({ id: "fresh", createdAt: "2026-05-25T00:00:00.000Z" }),
    ],
  };

  const plan = derivePrivacyRetentionSweepPlan({
    workspace,
    now: new Date("2026-06-01T00:00:00.000Z"),
    env: { DATA_RETENTION_DAYS: "45", PRIVACY_EXPORT_ENABLED: "true" },
  });

  assert.equal(plan.schema, "enterprise-ai-enablement-os.privacy-retention-sweep.v1");
  assert.equal(plan.scanned, 2);
  assert.equal(plan.expired, 1);
  assert.equal(plan.retained, 1);
  assert.equal(plan.items[0]?.id, "expired");
  assert.equal("summary" in (plan.items[0] ?? {}), false);
});

test("applyPrivacyRetentionSweep removes expired work signals only when not a dry run", () => {
  const workspace = {
    ...emptyWorkspace("privacy-retention-apply-test"),
    workSignals: [
      workSignal({ id: "expired", createdAt: "2026-04-01T00:00:00.000Z" }),
      workSignal({ id: "fresh", createdAt: "2026-05-25T00:00:00.000Z" }),
    ],
  };

  const preview = applyPrivacyRetentionSweep({
    workspace,
    dryRun: true,
    now: new Date("2026-06-01T00:00:00.000Z"),
    env: { DATA_RETENTION_DAYS: "45", PRIVACY_EXPORT_ENABLED: "true" },
  });
  const applied = applyPrivacyRetentionSweep({
    workspace,
    dryRun: false,
    now: new Date("2026-06-01T00:00:00.000Z"),
    env: { DATA_RETENTION_DAYS: "45", PRIVACY_EXPORT_ENABLED: "true" },
  });

  assert.equal(preview.workspace.workSignals.length, 2);
  assert.equal(preview.applied, false);
  assert.equal(applied.applied, true);
  assert.deepEqual(applied.workspace.workSignals.map((signal) => signal.id), ["fresh"]);
});

test("derivePrivacyLifecycleOperations summarizes export and request audit evidence", () => {
  const operations = derivePrivacyLifecycleOperations([
    {
      eventType: "privacy_request_received",
      message: "delete privacy request blocked.",
      createdAt: "2026-06-01T09:00:00.000Z",
    },
    {
      eventType: "privacy_request_received",
      message: "export privacy request forwarded.",
      createdAt: "2026-06-01T10:00:00.000Z",
    },
    {
      eventType: "privacy_request_received",
      message: "review privacy request accepted.",
      createdAt: "2026-06-01T11:00:00.000Z",
    },
    {
      eventType: "privacy_export_generated",
      message: "Privacy export generated for tenant scope.",
      createdAt: "2026-06-01T12:00:00.000Z",
    },
    {
      eventType: "privacy_retention_sweep",
      message: "Privacy retention sweep applied.",
      createdAt: "2026-06-01T13:00:00.000Z",
    },
  ]);

  assert.deepEqual(operations, {
    requestCount: 3,
    acceptedCount: 1,
    forwardedCount: 1,
    blockedCount: 1,
    exportCount: 1,
    retentionSweepCount: 1,
    latestAt: "2026-06-01T13:00:00.000Z",
  });
});
