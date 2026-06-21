import test from "node:test";
import assert from "node:assert/strict";

import { sealAuditLog } from "../src/lib/audit-integrity.ts";
import type { ConnectorEvent } from "../src/lib/connector-events.ts";
import type { WorkspaceRepository } from "../src/lib/database.ts";
import type { AuditLog, Skill } from "../src/lib/enterprise-ai-data.ts";
import type { Session } from "../src/lib/auth.ts";
import { loadTenantReadinessContext } from "../src/lib/tenant-readiness-context.ts";
import type { HarnessTraceRecord } from "../src/lib/trace-store.ts";
import type { WorkflowJob } from "../src/lib/workflow-jobs.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";

function auditLog(id: string, eventType: string, message: string, createdAt: string): AuditLog {
  return {
    id,
    eventType,
    message,
    actor: "Readiness Admin",
    riskLevel: "low",
    createdAt,
  };
}

function testSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-readiness",
    name: "Readiness Skill",
    slug: "readiness-skill",
    description: "Tests tenant readiness context evidence.",
    department: "Operations",
    ownerId: "admin-1",
    status: "production",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_2_prepare_action",
    modelProvider: "openai",
    model: "gpt-4.1",
    temperature: 0.2,
    maxTokens: 1200,
    fallbackModel: "local",
    costLimit: 5,
    systemPrompt: "Prepare launch readiness analysis.",
    allowedTools: [],
    blockedTools: [],
    contextSources: ["src-policy"],
    evalPassRate: 0,
    adoptionCount: 0,
    valueDelivered: 0,
    runs: 0,
    updatedAt: "2026-06-01",
    ...overrides,
  };
}

function fakeRepository(organizationId: string, workspace = emptyWorkspace(organizationId), logs: AuditLog[] = []): WorkspaceRepository {
  return {
    mode: "file",
    async getWorkspace(requestedOrganizationId) {
      assert.equal(requestedOrganizationId, organizationId);
      return workspace;
    },
    async saveWorkspace(input) {
      return input;
    },
    async appendAuditLog(_requestedOrganizationId, log) {
      return log;
    },
    async listAuditLogs(requestedOrganizationId) {
      assert.equal(requestedOrganizationId, organizationId);
      return logs;
    },
    async sealLegacyAuditChain() {
      throw new Error("not used in tenant readiness context tests");
    },
    readiness() {
      return {
        mode: "file",
        configured: true,
        durable: false,
        reason: "test repository",
      };
    },
  };
}

test("loadTenantReadinessContext loads the tenant evidence used by readiness probes", async () => {
  const organizationId = "tenant-readiness-test";
  const workspace = emptyWorkspace(organizationId);
  workspace.aiSettings = { monthlyBudgetUsd: 1200 };
  workspace.contextSources = [
    {
      id: "src-policy",
      name: "Policy Library",
      type: "uploaded_docs",
      classification: "internal",
      ownerDepartment: "Operations",
      enabled: true,
      lastIndexedAt: "2026-06-01T00:00:00.000Z",
      documentCount: 2,
      skillsUsing: 1,
      health: "healthy",
    },
  ];
  workspace.skills = [testSkill()];
  const first = sealAuditLog({
    organizationId,
    log: auditLog("audit-1", "workspace_saved", "Workspace saved.", "2026-06-01T00:00:00.000Z"),
    existingLogs: [],
    sealedAt: "2026-06-01T00:00:00.000Z",
  });
  const drill = sealAuditLog({
    organizationId,
    log: auditLog(
      "audit-2",
      "database_restore_drill_verified",
      "Database restore drill verified.",
      "2026-06-01T01:00:00.000Z",
    ),
    existingLogs: [first],
    sealedAt: "2026-06-01T01:00:00.000Z",
  });
  const privacy = sealAuditLog({
    organizationId,
    log: auditLog("audit-3", "privacy_request_received", "Privacy request accepted.", "2026-06-01T02:00:00.000Z"),
    existingLogs: [first, drill],
    sealedAt: "2026-06-01T02:00:00.000Z",
  });
  const session: Session = {
    user: {
      id: "admin-1",
      organizationId,
      name: "Readiness Admin",
      email: "readiness@example.com",
      role: "admin",
      department: "AI Enablement",
    },
    issuedAt: Date.parse("2026-06-01T00:00:00.000Z"),
    expiresAt: Date.parse("2026-06-02T00:00:00.000Z"),
  };
  const workflowJob: WorkflowJob = {
    id: "job-readiness",
    organizationId,
    status: "completed",
    input: {},
    output: {},
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:05:00.000Z",
  };
  const connectorEvent: ConnectorEvent = {
    id: "connector-event-readiness",
    organizationId,
    skillId: "skill-readiness",
    toolId: "sharepoint.search",
    status: "executed",
    decision: {
      status: "approved",
      reason: "Approved by connector policy.",
      policyId: "sharepoint.search-policy-v1",
      riskLevel: "medium",
    },
    payload: {
      query: "AI implementation policy",
      token: "[redacted]",
    },
    envelope: {
      schema: "enterprise-ai-enablement-os.connector-execution-envelope.v1",
      executionId: "exec-readiness",
      idempotencyKey: "idem-readiness",
      organizationId,
      actor: "Readiness Admin",
      skill: {
        id: "skill-readiness",
        name: "Readiness Skill",
        riskLevel: "medium",
        autonomyTier: "tier_2_prepare_action",
        version: "1.0.0",
      },
      toolId: "sharepoint.search",
      payloadDigest: "sha256:test-digest",
      payloadSizeBytes: 74,
      payloadPreview: {
        query: "AI implementation policy",
        token: "[redacted]",
      },
      approval: {
        approved: true,
        approvedBy: "Readiness Admin",
        approvedAt: "2026-06-01T00:10:00.000Z",
      },
      policy: {
        status: "approved",
        reason: "Approved by connector policy.",
        policyId: "sharepoint.search-policy-v1",
        riskLevel: "medium",
      },
      controls: ["payload_digest", "redacted_evidence", "human_approval_gate"],
      createdAt: "2026-06-01T00:10:00.000Z",
    },
    createdAt: "2026-06-01T00:10:00.000Z",
  };
  const harnessTrace: HarnessTraceRecord = {
    id: "trace-readiness",
    organizationId,
    runId: "run-readiness",
    skillId: "skill-readiness",
    status: "completed",
    riskLevel: "medium",
    run: {
      id: "run-readiness",
      skillId: "skill-readiness",
      triggeredBy: "Readiness Admin",
      status: "completed",
      riskLevel: "medium",
      currentStage: "Response Delivered",
      costUsd: 0.02,
      latencyMs: 320,
      startedAt: "2026-06-01T00:12:00.000Z",
      output: "Readiness response delivered.",
      trace: [
        {
          label: "Prompt contract assembled",
          status: "completed",
          detail: "Prompt quality 95/100.",
          latencyMs: 80,
        },
      ],
    },
    route: {
      provider: "local",
      model: "local-enterprise-reasoner",
      modelRef: "local/local-enterprise-reasoner",
      fallbackUsed: false,
      reason: "Tenant test route.",
    },
    policy: {
      context: {
        status: "approved",
        reason: "Context source approved.",
        policyId: "context-policy-v1",
        riskLevel: "medium",
      },
      tool: {
        status: "approved",
        reason: "Tool is allowlisted.",
        policyId: "tool-policy-v1",
        riskLevel: "medium",
      },
      output: {
        status: "approved",
        reason: "Output policy approved.",
        policyId: "output-policy-v1",
        riskLevel: "medium",
      },
    },
    model: {
      inputTokens: 120,
      outputTokens: 36,
      localFallback: true,
      providerError: false,
      finishReason: "stop",
      estimatedCostUsd: 0.02,
    },
    prompt: {
      contractId: "readiness-skill-contract",
      contractVersion: "2026.05",
      quality: {
        score: 95,
        grade: "excellent",
        passedChecks: 8,
        totalChecks: 8,
        missingCritical: [],
        findings: [],
      },
    },
    createdAt: "2026-06-01T00:12:00.000Z",
  };

  const context = await loadTenantReadinessContext({
    session,
    deps: {
      repository: fakeRepository(organizationId, workspace, [first, drill, privacy]),
      async listTenantSecrets(requestedOrganizationId) {
        assert.equal(requestedOrganizationId, organizationId);
        return [{ name: "OPENAI_API_KEY", updatedAt: "2026-06-01T00:00:00.000Z" }];
      },
      async readTenantSecretValues(requestedOrganizationId, requestedNames) {
        assert.equal(requestedOrganizationId, organizationId);
        assert.deepEqual(requestedNames, ["OPENAI_API_KEY"]);
        return { OPENAI_API_KEY: "sk-test" };
      },
      async getContextIndexStats(requestedOrganizationId) {
        assert.equal(requestedOrganizationId, organizationId);
        return {
          totalDocuments: 2,
          indexedDocuments: 2,
          failedDocuments: 0,
          quarantinedDocuments: 0,
          manualDocuments: 0,
          automatedDocuments: 2,
          sources: [
            {
              sourceId: "src-policy",
              sourceName: "Policy Library",
              documents: 2,
              indexedDocuments: 2,
              failedDocuments: 0,
              quarantinedDocuments: 0,
              manualDocuments: 0,
              automatedDocuments: 2,
              ingestionMethods: ["sync_worker"],
              latestStatus: "indexed",
              classification: "internal",
              lastUpdatedAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        };
      },
      async listWorkflowJobs(requestedOrganizationId) {
        assert.equal(requestedOrganizationId, organizationId);
        return [workflowJob];
      },
      async listConnectorEvents(requestedOrganizationId) {
        assert.equal(requestedOrganizationId, organizationId);
        return [connectorEvent];
      },
      async listHarnessTraces(requestedOrganizationId) {
        assert.equal(requestedOrganizationId, organizationId);
        return [harnessTrace];
      },
    },
  });

  assert.equal(context.organizationId, organizationId);
  assert.equal(context.tenantEvidenceLoaded, true);
  assert.deepEqual(context.evidenceErrors, []);
  assert.deepEqual(context.options.configuredSecretNames, ["OPENAI_API_KEY"]);
  assert.equal(context.options.secretEvidence?.tenantVaultNamesApplied, true);
  assert.equal(context.options.secretEvidence?.configuredSecretCount, 1);
  assert.equal(context.options.auditIntegrity?.configured, true);
  assert.equal(context.options.backupDrillOperations?.drillCount, 1);
  assert.equal(context.options.privacyOperations?.acceptedCount, 1);
  assert.equal(context.options.contextReadiness?.totalDocuments, 2);
  assert.equal(context.options.contextReadiness?.unindexedEnabledSources, 0);
  assert.equal(context.options.evalSchedulePlan?.dueCount, 1);
  assert.equal(context.options.workflowJobSummary?.completed, 1);
  assert.equal(context.options.connectorEventSummary?.envelopeCount, 1);
  assert.equal(context.options.connectorEventSummary?.redactedPayloadCount, 1);
  assert.equal(context.options.harnessTraceSummary?.promptQualityAverage, 95);
  assert.equal(context.options.aiSettings?.monthlyBudgetUsd, 1200);
});

test("loadTenantReadinessContext skips tenant evidence when no session or fallback is available", async () => {
  const context = await loadTenantReadinessContext({ session: null });

  assert.equal(context.organizationId, undefined);
  assert.equal(context.tenantEvidenceLoaded, false);
  assert.deepEqual(context.evidenceErrors, []);
  assert.deepEqual(context.options.configuredSecretNames, []);
  assert.equal(context.options.auditIntegrity, undefined);
  assert.equal(context.options.secretEvidence, undefined);
});

test("loadTenantReadinessContext can load fallback tenant evidence for readiness probes", async () => {
  const organizationId = "fallback-readiness-test";
  const context = await loadTenantReadinessContext({
    session: null,
    includeFallbackTenant: true,
    fallbackOrganizationId: organizationId,
    deps: {
      repository: fakeRepository(organizationId),
      async listTenantSecrets() {
        return [];
      },
      async getContextIndexStats() {
        return {
          totalDocuments: 0,
          indexedDocuments: 0,
          failedDocuments: 0,
          quarantinedDocuments: 0,
          manualDocuments: 0,
          automatedDocuments: 0,
          sources: [],
        };
      },
      async listWorkflowJobs() {
        return [];
      },
      async listConnectorEvents() {
        return [];
      },
      async listHarnessTraces() {
        return [];
      },
    },
  });

  assert.equal(context.organizationId, organizationId);
  assert.equal(context.tenantEvidenceLoaded, true);
  assert.equal(context.options.auditIntegrity?.configured, true);
  assert.equal(context.options.workflowJobSummary?.total, 0);
  assert.equal(context.options.connectorEventSummary?.total, 0);
  assert.equal(context.options.harnessTraceSummary?.total, 0);
});
