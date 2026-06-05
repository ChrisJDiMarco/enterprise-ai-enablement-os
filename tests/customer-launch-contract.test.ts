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
    workflowMode: "external-engine-ready",
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
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com" }),
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
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com" }),
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
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com" }),
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
  assert.equal(context?.evidence.includes("context 8 document(s) / 2 enabled source(s) / 1 stale / 1 unindexed"), true);
  assert.match(context?.nextAction ?? "", /Refresh stale sources/);
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
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com" }),
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
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com" }),
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
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com" }),
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
    connectors: getEnterpriseConnectorReadiness({ ...env, MCP_BROKER_URL: "https://broker.example.com" }),
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
      AUTH_SECRET: "secret",
      OIDC_ISSUER: "https://idp.example.com",
      OIDC_CLIENT_ID: "client",
      OIDC_CLIENT_SECRET: "secret",
      TENANT_SECRET_KEY: "tenant-secret",
      PROVISIONING_API_TOKEN: "provisioning-token",
      API_TRUSTED_ORIGINS: "https://app.example.com",
      API_RATE_LIMIT_KEY_SALT: "salt",
      DB_MIGRATIONS_APPLIED: "true",
      MANAGED_DATABASE_BACKUPS: "true",
      DATABASE_RESTORE_DRILL_AT: "2026-06-01T00:00:00.000Z",
      OPENAI_API_KEY: "key",
      MCP_BROKER_URL: "https://broker.example.com",
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

      assert.equal(readiness.customerLaunchContract.status, "ready");
      assert.equal(checkIds.has("model-cost-controls"), true);
      assert.equal(checkIds.has("context-ingestion"), true);
      assert.equal(checkIds.has("continuous-evals"), true);
      assert.equal(checkIds.has("observability"), true);
      assert.equal(checkIds.has("privacy-lifecycle"), true);
    },
  ));
