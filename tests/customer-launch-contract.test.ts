import test from "node:test";
import assert from "node:assert/strict";

import { deriveCustomerLaunchContract } from "../src/lib/customer-launch-contract.ts";
import { getEnterpriseConnectorReadiness } from "../src/lib/enterprise-connectors.ts";
import { getProductionReadiness } from "../src/lib/production-readiness.ts";
import type { OperationsReadiness } from "../src/lib/production-ops-readiness.ts";
import type { ProviderReadiness } from "../src/lib/provider-registry.ts";

const readyOps: OperationsReadiness = {
  configured: true,
  mode: "ready",
  reason: "ready",
  evidence: ["ready"],
};

const freshEvidenceTimestamp = new Date().toISOString();

const readyConnectorEvidence = {
  total: 2,
  executed: 2,
  simulated: 0,
  requiresApproval: 0,
  blocked: 0,
  envelopeCount: 2,
  missingEnvelopeCount: 0,
  redactedPayloadCount: 2,
  latestAt: freshEvidenceTimestamp,
};

const readyHarnessEvidence = {
  total: 2,
  completed: 2,
  waitingForApproval: 0,
  blocked: 0,
  failed: 0,
  promptQualityAverage: 94,
  promptQualityUnsafe: 0,
  policyBlocked: 0,
  approvalGated: 0,
  latestAt: freshEvidenceTimestamp,
};

function providers(configured = true): ProviderReadiness[] {
  return [
    {
      id: "openai",
      label: "OpenAI",
      protocol: "native",
      configured,
      missing: configured ? [] : ["OPENAI_API_KEY"],
      recommendedFor: ["primary reasoning"],
    },
  ];
}

function withEnv<T>(overrides: Record<string, string | undefined>, callback: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("deriveCustomerLaunchContract: blocks production launch when core execution planes are missing", () => {
  const contract = deriveCustomerLaunchContract({
    env: { NODE_ENV: "production" },
    auth: { authRequired: false, oidcConfigured: false },
    database: { configured: false, durable: false },
    apiProtection: { configured: false, salted: false },
    secretVault: { configured: false, encrypted: false, mode: "missing" },
    provisioningConfigured: false,
    providers: providers(false),
    connectors: getEnterpriseConnectorReadiness({ NODE_ENV: "production" }),
    workflowMode: "local-job-ledger",
    operations: {
      backup: { ...readyOps, configured: false, reason: "missing backup" },
      migrations: { ...readyOps, configured: false, reason: "missing migrations" },
      traceStore: { ...readyOps, configured: false, reason: "missing traces" },
      evalRunner: { ...readyOps, configured: false, reason: "missing evals" },
      auditIntegrity: { ...readyOps, configured: false, reason: "missing audit" },
    },
  });

  assert.equal(contract.status, "blocked");
  assert.equal(contract.domains.some((domain) => domain.id === "connector-activation" && domain.status === "blocked"), true);
  assert.equal(contract.domains.some((domain) => domain.id === "workflow-runtime" && domain.status === "blocked"), true);
  assert.ok(contract.score < 60);
});

test("deriveCustomerLaunchContract: reaches ready when launch capabilities are configured", () => {
  const env = {
    NODE_ENV: "production",
    MCP_BROKER_URL: "https://broker.example.com",
    MCP_BROKER_TOKEN: "broker-token",
    OPENAI_API_KEY: "key",
    TENANT_MONTHLY_BUDGET_USD: "2500",
    VECTOR_STORE_URL: "postgres://vector",
    WORKFLOW_ENGINE_URL: "https://workflow.example.com",
    EVAL_SCHEDULE_ENABLED: "true",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com",
    DATA_RETENTION_DAYS: "365",
    PRIVACY_EXPORT_ENABLED: "true",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness(env),
    connectorEventSummary: readyConnectorEvidence,
    workflowMode: "external-engine-ready",
    harnessTraceSummary: readyHarnessEvidence,
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });

  assert.equal(contract.status, "ready");
  assert.equal(contract.readyCount, contract.domains.length);
  assert.equal(contract.nextActions.length, 0);
});

test("deriveCustomerLaunchContract: configured connectors still need execution evidence", () => {
  const env = {
    NODE_ENV: "production",
    MCP_BROKER_URL: "https://broker.example.com",
    MCP_BROKER_TOKEN: "broker-token",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness(env),
    connectorEventSummary: {
      total: 1,
      executed: 1,
      simulated: 0,
      requiresApproval: 0,
      blocked: 0,
      envelopeCount: 0,
      missingEnvelopeCount: 1,
      redactedPayloadCount: 0,
    },
    workflowMode: "external-engine-ready",
    harnessTraceSummary: readyHarnessEvidence,
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });
  const connectors = contract.domains.find((domain) => domain.id === "connector-activation");

  assert.equal(connectors?.status, "needs-work");
  assert.equal(connectors?.evidence.some((item) => item.includes("1 legacy")), true);
  assert.match(connectors?.nextAction ?? "", /legacy connector events/);
});

test("deriveCustomerLaunchContract: connector execution evidence must be fresh", () => {
  const env = {
    NODE_ENV: "production",
    MCP_BROKER_URL: "https://broker.example.com",
    MCP_BROKER_TOKEN: "broker-token",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness(env),
    connectorEventSummary: {
      ...readyConnectorEvidence,
      latestAt: "2025-01-01T00:00:00.000Z",
    },
    workflowMode: "external-engine-ready",
    harnessTraceSummary: readyHarnessEvidence,
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });
  const connectors = contract.domains.find((domain) => domain.id === "connector-activation");

  assert.equal(connectors?.status, "needs-work");
  assert.equal(connectors?.evidence.some((item) => item.includes("freshness window")), true);
  assert.match(connectors?.nextAction ?? "", /Rerun one governed connector path/);
});

test("deriveCustomerLaunchContract: evidence ops requires clean Harness trace evidence", () => {
  const env = {
    NODE_ENV: "production",
    MCP_BROKER_URL: "https://broker.example.com",
    MCP_BROKER_TOKEN: "broker-token",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness(env),
    connectorEventSummary: readyConnectorEvidence,
    workflowMode: "external-engine-ready",
    harnessTraceSummary: {
      total: 1,
      completed: 0,
      waitingForApproval: 0,
      blocked: 0,
      failed: 1,
      promptQualityAverage: 38,
      promptQualityUnsafe: 1,
      policyBlocked: 0,
      approvalGated: 0,
    },
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });
  const evidenceOps = contract.domains.find((domain) => domain.id === "evidence-ops");

  assert.equal(evidenceOps?.status, "needs-work");
  assert.equal(evidenceOps?.evidence.some((item) => item.includes("1 failed / 1 unsafe prompt")), true);
  assert.match(evidenceOps?.nextAction ?? "", /Resolve failed Harness traces/);
});

test("deriveCustomerLaunchContract: Harness trace evidence must be fresh", () => {
  const env = {
    NODE_ENV: "production",
    MCP_BROKER_URL: "https://broker.example.com",
    MCP_BROKER_TOKEN: "broker-token",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness(env),
    connectorEventSummary: readyConnectorEvidence,
    workflowMode: "external-engine-ready",
    harnessTraceSummary: {
      ...readyHarnessEvidence,
      latestAt: "2025-01-01T00:00:00.000Z",
    },
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });
  const evidenceOps = contract.domains.find((domain) => domain.id === "evidence-ops");

  assert.equal(evidenceOps?.status, "needs-work");
  assert.equal(evidenceOps?.evidence.some((item) => item.includes("freshness window")), true);
  assert.match(evidenceOps?.nextAction ?? "", /Rerun one governed Skill/);
});

test("deriveCustomerLaunchContract: uses shared privacy lifecycle config", () => {
  const env = {
    NODE_ENV: "production",
    PRIVACY_REQUEST_WORKFLOW_URL: "https://privacy.example/workflow",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com", MCP_BROKER_TOKEN: "broker-token" }),
    workflowMode: "external-engine-ready",
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });
  const privacy = contract.domains.find((domain) => domain.id === "privacy-lifecycle");

  assert.equal(privacy?.status, "ready");
  assert.equal(privacy?.evidence.includes("external-workflow configured"), true);
  assert.equal(privacy?.evidence.includes("retention 365 days"), true);
});

test("deriveCustomerLaunchContract: blocked privacy requests keep privacy lifecycle needs-work", () => {
  const env = {
    NODE_ENV: "production",
    PRIVACY_EXPORT_ENABLED: "true",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com", MCP_BROKER_TOKEN: "broker-token" }),
    workflowMode: "external-engine-ready",
    privacyOperations: {
      requestCount: 2,
      acceptedCount: 1,
      forwardedCount: 0,
      blockedCount: 1,
      exportCount: 1,
      retentionSweepCount: 1,
      latestAt: "2026-06-01T12:00:00.000Z",
    },
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });
  const privacy = contract.domains.find((domain) => domain.id === "privacy-lifecycle");

  assert.equal(privacy?.status, "needs-work");
  assert.equal(privacy?.evidence.includes("privacy ops 2 request(s) / 1 blocked / 1 export(s) / 1 retention sweep(s)"), true);
  assert.match(privacy?.nextAction ?? "", /Resolve blocked privacy requests/);
});

test("deriveCustomerLaunchContract: context source gaps keep context ingestion needs-work", () => {
  const env = {
    NODE_ENV: "production",
    VECTOR_STORE_URL: "postgres://vector",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com", MCP_BROKER_TOKEN: "broker-token" }),
    workflowMode: "external-engine-ready",
    contextReadiness: {
      totalDocuments: 8,
      indexedSources: 1,
      catalogSources: 2,
      enabledSources: 2,
      healthySources: 1,
      attentionSources: 0,
      staleSources: 1,
      sensitiveSources: 1,
      unindexedEnabledSources: 1,
      indexedDocuments: 7,
      failedDocuments: 1,
      quarantinedDocuments: 0,
      manualDocuments: 0,
      automatedDocuments: 8,
      staleAfterDays: 30,
      latestIndexedAt: "2026-06-01T00:00:00.000Z",
    },
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });
  const context = contract.domains.find((domain) => domain.id === "context-ingestion");

  assert.equal(context?.status, "needs-work");
  assert.equal(
    context?.evidence.some((item) =>
      item.includes("context 7 indexed document(s) / 8 total record(s) / 2 enabled source(s) / 1 stale / 1 unindexed"),
    ),
    true,
  );
  assert.match(context?.nextAction ?? "", /Refresh stale sources/);
  assert.match(context?.nextAction ?? "", /failed or quarantined/);
});

test("deriveCustomerLaunchContract: uses shared observability config", () => {
  const env = {
    NODE_ENV: "production",
    LOG_DRAIN_URL: "https://logs.example.com/events",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com", MCP_BROKER_TOKEN: "broker-token" }),
    workflowMode: "external-engine-ready",
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });
  const observability = contract.domains.find((domain) => domain.id === "observability");

  assert.equal(observability?.status, "ready");
  assert.equal(observability?.evidence.includes("external-log-drain"), true);
  assert.equal(observability?.evidence.includes("sinks log-drain"), true);
});

test("deriveCustomerLaunchContract: blocked eval suites keep continuous evals needs-work", () => {
  const env = {
    NODE_ENV: "production",
    EVAL_SCHEDULE_ENABLED: "true",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com", MCP_BROKER_TOKEN: "broker-token" }),
    workflowMode: "external-engine-ready",
    evalSchedulePlan: {
      schema: "enterprise-ai-enablement-os.eval-schedule.v1",
      generatedAt: "2026-06-02T00:00:00.000Z",
      cadenceDays: 30,
      dueCount: 0,
      blockedCount: 1,
      healthyCount: 4,
      items: [],
    },
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });
  const continuous = contract.domains.find((domain) => domain.id === "continuous-evals");

  assert.equal(continuous?.status, "needs-work");
  assert.equal(continuous?.evidence.includes("scheduled-runner configured"), true);
  assert.equal(continuous?.evidence.includes("schedule 4 healthy / 0 due / 1 blocked"), true);
  assert.match(continuous?.nextAction ?? "", /Resolve blocked eval suites/);
});

test("deriveCustomerLaunchContract: failed workflow jobs keep workflow runtime needs-work", () => {
  const env = {
    NODE_ENV: "production",
    WORKFLOW_ENGINE_URL: "https://workflow.example.com",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com", MCP_BROKER_TOKEN: "broker-token" }),
    workflowMode: "external-engine-ready",
    workflowJobSummary: {
      total: 3,
      active: 1,
      queued: 0,
      running: 1,
      waitingForApproval: 0,
      completed: 1,
      failed: 1,
      cancelled: 0,
      staleActive: 0,
      staleAfterMinutes: 60,
      oldestActiveAt: "2026-06-01T12:00:00.000Z",
      latestUpdatedAt: "2026-06-01T12:05:00.000Z",
    },
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });
  const workflow = contract.domains.find((domain) => domain.id === "workflow-runtime");

  assert.equal(workflow?.status, "needs-work");
  assert.equal(workflow?.evidence.includes("jobs 3 total / 1 active / 1 failed / 0 stale active"), true);
  assert.match(workflow?.nextAction ?? "", /Investigate failed workflow jobs/);
});

test("deriveCustomerLaunchContract: stale active workflow jobs keep workflow runtime needs-work", () => {
  const env = {
    NODE_ENV: "production",
    WORKFLOW_ENGINE_URL: "https://workflow.example.com",
  };
  const contract = deriveCustomerLaunchContract({
    env,
    auth: { authRequired: true, oidcConfigured: true },
    database: { configured: true, durable: true },
    apiProtection: { configured: true, salted: true },
    secretVault: { configured: true, encrypted: true, mode: "encrypted" },
    provisioningConfigured: true,
    providers: providers(true),
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com", MCP_BROKER_TOKEN: "broker-token" }),
    workflowMode: "external-engine-ready",
    workflowJobSummary: {
      total: 4,
      active: 2,
      queued: 1,
      running: 1,
      waitingForApproval: 0,
      completed: 2,
      failed: 0,
      cancelled: 0,
      staleActive: 1,
      staleAfterMinutes: 30,
      oldestActiveAt: "2026-06-01T09:00:00.000Z",
      latestUpdatedAt: "2026-06-01T09:30:00.000Z",
    },
    operations: {
      backup: readyOps,
      migrations: readyOps,
      traceStore: readyOps,
      evalRunner: readyOps,
      auditIntegrity: readyOps,
    },
  });
  const workflow = contract.domains.find((domain) => domain.id === "workflow-runtime");

  assert.equal(workflow?.status, "needs-work");
  assert.equal(workflow?.evidence.includes("jobs 4 total / 2 active / 0 failed / 1 stale active"), true);
  assert.match(workflow?.nextAction ?? "", /Investigate stale active workflow jobs/);
});

test("getProductionReadiness exposes customer launch contract and new readiness controls", () =>
  withEnv(
    {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://example",
      AUTH_REQUIRED: "true",
      AUTH_SECRET: "Zx9Z7tq2Vn4pWm8sLk6Rj3Hd1Gf5Yb0Qa2Ue7Ic",
      OIDC_ISSUER: "https://idp.example.com",
      OIDC_CLIENT_ID: "client",
      OIDC_CLIENT_SECRET: "secret",
      OIDC_REDIRECT_URI: "https://app.example.com/api/auth/oidc/callback",
      TENANT_SECRET_KEY: "Mk4Pq8Zx2Vn6Wm9sLk3Rj7Hd5Gf1Yb8Qa0Ue4Ic",
      PROVISIONING_API_TOKEN: "provisioning-token",
      API_TRUSTED_ORIGINS: "https://app.example.com",
      API_RATE_LIMIT_KEY_SALT: "Rj7Hd5Gf1Yb8Qa0Uv",
      DB_MIGRATIONS_APPLIED: "true",
      MANAGED_DATABASE_BACKUPS: "true",
      DATABASE_RESTORE_DRILL_AT: "2026-06-01T00:00:00.000Z",
      OPENAI_API_KEY: "key",
      MCP_BROKER_URL: "https://broker.example.com",
      MCP_BROKER_TOKEN: "broker-token",
      WORKFLOW_ENGINE_URL: "https://workflow.example.com",
      TENANT_MONTHLY_BUDGET_USD: "2500",
      VECTOR_STORE_URL: "postgres://vector",
      EVAL_SCHEDULE_ENABLED: "true",
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com",
      DATA_RETENTION_DAYS: "365",
      PRIVACY_EXPORT_ENABLED: "true",
    },
    () => {
      const readiness = getProductionReadiness();
      const checkIds = new Set(readiness.checks.map((item) => item.id));

      const readinessWithEvidence = getProductionReadiness({
        connectorEventSummary: readyConnectorEvidence,
        harnessTraceSummary: readyHarnessEvidence,
      });

      assert.equal(readiness.customerLaunchContract.status, "needs-work");
      assert.equal(readinessWithEvidence.customerLaunchContract.status, "ready");
      assert.equal(checkIds.has("model-cost-controls"), true);
      assert.equal(checkIds.has("context-ingestion"), true);
      assert.equal(checkIds.has("continuous-evals"), true);
      assert.equal(checkIds.has("observability"), true);
      assert.equal(checkIds.has("privacy-lifecycle"), true);
    },
  ));
