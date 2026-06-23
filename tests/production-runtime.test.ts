import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apiProtectionReadinessFromEnv,
  databaseReadinessFromEnv,
  secretVaultReadinessFromEnv,
} from "../src/lib/runtime-readiness-policy.ts";
import { authReadiness } from "../src/lib/auth-readiness.ts";
import { auditIntegrityReadinessFromEnv, evalRunnerReadinessFromEnv, traceStoreReadinessFromEnv } from "../src/lib/production-ops-readiness.ts";
import { getProductionReadiness } from "../src/lib/production-readiness.ts";
import { tenantProvisioningReadinessFromEnv } from "../src/lib/tenant-provisioning-readiness.ts";
import { harnessTraceFreshness } from "../src/lib/trace-store.ts";

async function withEnv<T>(overrides: Record<string, string | undefined>, callback: () => T | Promise<T>) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("database readiness blocks production when DATABASE_URL is missing", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      DATABASE_URL: undefined,
      ALLOW_FILE_DATABASE_IN_PRODUCTION: undefined,
    },
    async () => {
      const readiness = databaseReadinessFromEnv(process.env);
      assert.equal(readiness.mode, "unconfigured");
      assert.equal(readiness.configured, false);
      assert.equal(readiness.durable, false);
    },
  );
});

test("database readiness blocks production when DATABASE_URL is malformed", () =>
  withEnv(
    {
      NODE_ENV: "production",
      DATABASE_URL: "not-a-database-url",
      ALLOW_FILE_DATABASE_IN_PRODUCTION: "true",
    },
    () => {
      const readiness = databaseReadinessFromEnv(process.env);

      assert.equal(readiness.mode, "unconfigured");
      assert.equal(readiness.configured, false);
      assert.equal(readiness.durable, false);
      assert.match(readiness.reason, /valid postgres/);
    },
  ));

test("database readiness allows explicit emergency file fallback", () =>
  withEnv(
    {
      NODE_ENV: "production",
      DATABASE_URL: undefined,
      ALLOW_FILE_DATABASE_IN_PRODUCTION: "true",
    },
    () => {
      const readiness = databaseReadinessFromEnv(process.env);
      assert.equal(readiness.mode, "file");
      assert.equal(readiness.configured, true);
      assert.equal(readiness.durable, false);
      assert.match(readiness.reason, /Emergency file persistence/);
    },
  ));

test("production readiness treats emergency file persistence as degraded private-beta runtime", () =>
  withEnv(
    {
      NODE_ENV: "production",
      DATABASE_URL: undefined,
      ALLOW_FILE_DATABASE_IN_PRODUCTION: "true",
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
      DATABASE_RESTORE_DRILL_AT: "2026-05-29T00:00:00.000Z",
      EVAL_RUNNER_URL: "https://eval.example.com",
      PRIVACY_EXPORT_ENABLED: "true",
      OPENAI_API_KEY: undefined,
      MCP_BROKER_URL: undefined,
      CONNECTOR_BROKER_URL: undefined,
      TEMPORAL_ADDRESS: undefined,
      WORKFLOW_ENGINE_URL: undefined,
      ALLOW_LOCAL_MODEL_RUNTIME_IN_PRODUCTION: "true",
      ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION: "true",
      ALLOW_LOCAL_WORKFLOW_ENGINE_IN_PRODUCTION: "true",
      ALLOW_UNVERIFIED_CONNECTOR_EVIDENCE_IN_PRODUCTION: "true",
      ALLOW_UNVERIFIED_HARNESS_TRACE_IN_PRODUCTION: "true",
    },
    () => {
      const readiness = getProductionReadiness();
      const checks = new Map(readiness.checks.map((item) => [item.id, item]));
      const traceStore = traceStoreReadinessFromEnv(process.env);
      const auditIntegrity = auditIntegrityReadinessFromEnv(process.env);

      assert.equal(readiness.status, "degraded");
      assert.equal(readiness.blockers.length, 0);
      assert.equal(checks.get("database")?.status, "warn");
      assert.equal(checks.get("trace-store")?.status, "warn");
      assert.equal(checks.get("audit-integrity")?.status, "warn");
      assert.equal(readiness.database?.configured, true);
      assert.equal(readiness.database?.durable, false);
      assert.equal(traceStore.mode, "emergency-file-trace-store");
      assert.equal(auditIntegrity.mode, "emergency-file-hash-chain");
      assert.equal(readiness.customerLaunchContract.status, "blocked");
    },
  ));

test("production readiness rejects malformed runtime operation URLs", () =>
  withEnv(
    {
      NODE_ENV: "production",
      EVAL_RUNNER_URL: "not-a-url",
      VECTOR_STORE_URL: "not-a-url",
      CONTEXT_INDEX_JOB_URL: "http://index.example.com/job",
      CONTEXT_SYNC_WORKER_URL: "https://worker.example.com/sync?api_key=secret",
      WORKFLOW_ENGINE_URL: "not-a-url",
      TEMPORAL_ADDRESS: undefined,
      DATABASE_URL: undefined,
      ALLOW_FILE_DATABASE_IN_PRODUCTION: undefined,
      EVAL_SCHEDULE_ENABLED: undefined,
      EVAL_SCHEDULE_CRON: undefined,
      CONTEXT_SYNC_ENABLED: undefined,
      ALLOW_MANUAL_CONTEXT_INDEXING_IN_PRODUCTION: undefined,
      ALLOW_LOCAL_WORKFLOW_ENGINE_IN_PRODUCTION: undefined,
    },
    () => {
      const evalRunner = evalRunnerReadinessFromEnv(process.env);
      const readiness = getProductionReadiness();
      const checks = new Map(readiness.checks.map((item) => [item.id, item]));
      const workflowDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "workflow-runtime");
      const contextDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "context-ingestion");

      assert.equal(evalRunner.configured, false);
      assert.equal(evalRunner.mode, "missing-eval-runner");
      assert.match(evalRunner.reason, /EVAL_RUNNER_URL is invalid/);
      assert.equal(readiness.evalCadence.configured, false);
      assert.match(readiness.evalCadence.reason, /EVAL_RUNNER_URL is invalid/);
      assert.equal(checks.get("context-ingestion")?.status, "warn");
      assert.match(checks.get("context-ingestion")?.detail ?? "", /Configure VECTOR_STORE_URL/);
      assert.equal(contextDomain?.status, "needs-work");
      assert.equal(checks.get("workflow-engine")?.status, "fail");
      assert.match(checks.get("workflow-engine")?.detail ?? "", /Local workflow job ledger is active/);
      assert.equal(workflowDomain?.status, "blocked");
    },
  ));

test("secret vault readiness requires a tenant key in production", () =>
  withEnv(
    {
      NODE_ENV: "production",
      TENANT_SECRET_KEY: undefined,
      SECRET_VAULT_KEY: undefined,
    },
    () => {
      const readiness = secretVaultReadinessFromEnv(process.env);
      assert.equal(readiness.configured, false);
      assert.equal(readiness.mode, "missing");
    },
  ));

test("production readiness does not count unusable tenant-vault secret names as live providers or connectors", () =>
  withEnv(
    {
      NODE_ENV: "production",
      OPENAI_API_KEY: undefined,
      SLACK_BOT_TOKEN: undefined,
      SLACK_SIGNING_SECRET: undefined,
      TENANT_SECRET_KEY: undefined,
      SECRET_VAULT_KEY: undefined,
      ALLOW_LOCAL_MODEL_RUNTIME_IN_PRODUCTION: undefined,
      ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        configuredSecretNames: ["OPENAI_API_KEY", "SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
        secretEvidence: {
          schema: "enterprise-ai-enablement-os.tenant-secret-evidence.v1",
          readable: true,
          usableForRuntime: false,
          tenantVaultNamesApplied: false,
          configuredSecretCount: 3,
          decryptableSecretCount: 0,
          undecryptableSecretCount: 3,
          invalidSecretCount: 0,
          invalidSecretNames: [],
          unsupportedSecretNames: [],
          vault: secretVaultReadinessFromEnv(process.env),
          warning: "TENANT_SECRET_KEY is required in production before tenant secrets can be used.",
        },
      });
      const checks = new Map(readiness.checks.map((item) => [item.id, item]));

      assert.equal(readiness.providers.find((provider) => provider.id === "openai")?.configured, false);
      assert.equal(readiness.connectors.catalog.connectors.find((connector) => connector.id === "slack")?.status, "missing");
      assert.equal(checks.get("tenant-secret-evidence")?.status, "fail");
      assert.equal(checks.get("providers")?.status, "fail");
      assert.equal(checks.get("connectors")?.status, "fail");
      assert.equal(readiness.secretEvidence?.tenantVaultNamesApplied, false);
      const tenantDataDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "tenant-data");
      assert.equal(tenantDataDomain?.status, "blocked");
      assert.equal(
        tenantDataDomain?.evidence.some((item) => item === "3/3 tenant secret value(s) need verification"),
        true,
      );
      assert.match(tenantDataDomain?.nextAction ?? "", /TENANT_SECRET_KEY/);
    },
  ));

test("production readiness blocks tenant launch when tenant vault contains unsupported secret drift", () =>
  withEnv(
    {
      NODE_ENV: "production",
      OPENAI_API_KEY: undefined,
      TENANT_SECRET_KEY: "Mk4Pq8Zx2Vn6Wm9sLk3Rj7Hd5Gf1Yb8Qa0Ue4Ic",
      ALLOW_LOCAL_MODEL_RUNTIME_IN_PRODUCTION: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        configuredSecretNames: ["OPENAI_API_KEY"],
        secretEvidence: {
          schema: "enterprise-ai-enablement-os.tenant-secret-evidence.v1",
          readable: true,
          usableForRuntime: true,
          tenantVaultNamesApplied: true,
          configuredSecretCount: 2,
          decryptableSecretCount: 2,
          undecryptableSecretCount: 0,
          invalidSecretCount: 0,
          invalidSecretNames: [],
          unsupportedSecretNames: ["OLD_VENDOR_SECRET"],
          vault: secretVaultReadinessFromEnv(process.env),
          warning: "Tenant vault contains unsupported secret names.",
        },
      });
      const checks = new Map(readiness.checks.map((item) => [item.id, item]));
      const tenantDataDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "tenant-data");

      assert.equal(readiness.providers.find((provider) => provider.id === "openai")?.configured, true);
      assert.equal(checks.get("tenant-secret-evidence")?.status, "fail");
      assert.match(checks.get("tenant-secret-evidence")?.detail ?? "", /unsupported secret names/i);
      assert.equal(tenantDataDomain?.status, "blocked");
      assert.match(tenantDataDomain?.nextAction ?? "", /unsupported secret names/i);
    },
  ));

test("api protection readiness blocks production without trusted origins", () =>
  withEnv(
    {
      NODE_ENV: "production",
      API_TRUSTED_ORIGINS: undefined,
      API_RATE_LIMIT_KEY_SALT: undefined,
    },
    () => {
      const readiness = apiProtectionReadinessFromEnv(process.env);
      assert.equal(readiness.configured, false);
      assert.equal(readiness.mode, "missing-trusted-origins");
    },
  ));

test("api protection readiness rejects malformed trusted origins", () =>
  withEnv(
    {
      NODE_ENV: "production",
      API_TRUSTED_ORIGINS: "https://app.example.com/path,not-a-url",
      API_RATE_LIMIT_KEY_SALT: "Rj7Hd5Gf1Yb8Qa0Uv",
    },
    () => {
      const readiness = apiProtectionReadinessFromEnv(process.env);

      assert.equal(readiness.configured, false);
      assert.equal(readiness.mode, "missing-trusted-origins");
      assert.match(readiness.reason, /valid HTTP\(S\) origins/);
    },
  ));

test("api protection readiness blocks production when rate keys are unsalted", () =>
  withEnv(
    {
      NODE_ENV: "production",
      API_TRUSTED_ORIGINS: "https://app.example.com",
      API_RATE_LIMIT_KEY_SALT: undefined,
      ALLOW_UNSALTED_RATE_LIMITS_IN_PRODUCTION: undefined,
    },
    () => {
      const readiness = apiProtectionReadinessFromEnv(process.env);
      assert.equal(readiness.configured, false);
      assert.equal(readiness.salted, false);
      assert.equal(readiness.mode, "missing-rate-limit-salt");
      assert.match(readiness.reason, /API_RATE_LIMIT_KEY_SALT/);
    },
  ));

test("api protection readiness allows unsalted production rate keys behind an explicit override", () =>
  withEnv(
    {
      NODE_ENV: "production",
      API_TRUSTED_ORIGINS: "https://app.example.com",
      API_RATE_LIMIT_KEY_SALT: undefined,
      ALLOW_UNSALTED_RATE_LIMITS_IN_PRODUCTION: "true",
    },
    () => {
      const readiness = apiProtectionReadinessFromEnv(process.env);
      assert.equal(readiness.configured, true);
      assert.equal(readiness.salted, false);
      assert.equal(readiness.mode, "production-origin-guard");
    },
  ));

test("auth readiness rejects malformed OIDC issuer and callback URLs", () =>
  withEnv(
    {
      NODE_ENV: "production",
      AUTH_REQUIRED: "true",
      AUTH_SECRET: "Zx9Z7tq2Vn4pWm8sLk6Rj3Hd1Gf5Yb0Qa2Ue7Ic",
      OIDC_ISSUER: "not-a-url",
      OIDC_CLIENT_ID: "client",
      OIDC_CLIENT_SECRET: "secret",
      OIDC_REDIRECT_URI: "https://app.example.com/callback#debug",
    },
    () => {
      const readiness = authReadiness(process.env);

      assert.equal(readiness.oidcConfigured, false);
      assert.notEqual(readiness.mode, "oidc-ready");
      assert.equal(readiness.issues.some((issue) => issue.includes("OIDC_ISSUER")), true);
      assert.equal(readiness.issues.some((issue) => issue.includes("OIDC_REDIRECT_URI")), true);
    },
  ));

test("auth readiness requires the exact OIDC callback URI before marking SSO configured", () =>
  withEnv(
    {
      NODE_ENV: "production",
      AUTH_REQUIRED: "true",
      AUTH_SECRET: "Zx9Z7tq2Vn4pWm8sLk6Rj3Hd1Gf5Yb0Qa2Ue7Ic",
      OIDC_ISSUER: "https://idp.example.com?tenant=acme",
      OIDC_CLIENT_ID: "client",
      OIDC_CLIENT_SECRET: "secret",
      OIDC_REDIRECT_URI: undefined,
    },
    () => {
      const readiness = authReadiness(process.env);

      assert.equal(readiness.oidcConfigured, false);
      assert.notEqual(readiness.mode, "oidc-ready");
      assert.equal(readiness.issues.some((issue) => issue.includes("OIDC_ISSUER")), true);
      assert.equal(readiness.issues.some((issue) => issue.includes("OIDC_REDIRECT_URI")), true);
    },
  ));

test("audit integrity readiness blocks production when explicitly disabled", () =>
  withEnv(
    {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://example",
      AUDIT_INTEGRITY_ENABLED: "false",
    },
    () => {
      const readiness = auditIntegrityReadinessFromEnv(process.env);
      assert.equal(readiness.configured, false);
      assert.equal(readiness.mode, "audit-chain-disabled");
    },
  ));

test("production readiness includes audit chain operations in the launch contract", () =>
  withEnv(
    {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://example",
      AUDIT_INTEGRITY_ENABLED: "true",
    },
    () => {
      const readiness = getProductionReadiness();
      assert.equal(readiness.operations.auditIntegrity?.configured, true);
      assert.equal(readiness.checks.some((item) => item.id === "audit-integrity"), true);
    },
  ));

test("production readiness surfaces tenant backup drill evidence without overstating backup infrastructure", () =>
  withEnv(
    {
      NODE_ENV: "development",
      DATABASE_BACKUP_URL: undefined,
      PG_BACKUP_BUCKET: undefined,
      S3_BACKUP_BUCKET: undefined,
      MANAGED_DATABASE_BACKUPS: undefined,
      DATABASE_BACKUP_SCHEDULE: undefined,
      DATABASE_RESTORE_DRILL_AT: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        backupDrillOperations: {
          drillCount: 1,
          latestAt: "2026-06-01T12:00:00.000Z",
          latestStatus: "verified",
        },
      });
      const backupCheck = readiness.checks.find((item) => item.id === "database-ops");
      const evidenceDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "evidence-ops");

      assert.equal(backupCheck?.status, "warn");
      assert.match(backupCheck?.detail ?? "", /1 verified drill/);
      assert.equal(readiness.backupDrillOperations?.drillCount, 1);
      assert.equal(evidenceDomain?.evidence.some((item) => item.includes("1 verified drill")), true);
    },
  ));

test("production readiness accepts tenant AI settings as model budget guardrail evidence", () =>
  withEnv(
    {
      TENANT_MONTHLY_BUDGET_USD: undefined,
      MODEL_BUDGET_USD: undefined,
      MODEL_BUDGET_ENFORCEMENT_ENABLED: undefined,
      OPENAI_API_KEY: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        configuredSecretNames: ["OPENAI_API_KEY"],
        aiSettings: { monthlyBudgetUsd: 2500 },
      });
      const budgetCheck = readiness.checks.find((item) => item.id === "model-cost-controls");
      const modelOps = readiness.customerLaunchContract.domains.find((domain) => domain.id === "model-ops");

      assert.equal(budgetCheck?.status, "pass");
      assert.match(budgetCheck?.detail ?? "", /workspace settings/);
      assert.equal(modelOps?.status, "ready");
      assert.equal(modelOps?.evidence.includes("budget control configured"), true);
    },
  ));

test("production readiness uses connector and Harness evidence quality in launch checks", () => {
  const readiness = getProductionReadiness({
    connectorEventSummary: {
      total: 2,
      executed: 1,
      simulated: 0,
      requiresApproval: 1,
      blocked: 0,
      envelopeCount: 2,
      missingEnvelopeCount: 0,
      redactedPayloadCount: 2,
      latestAt: new Date().toISOString(),
    },
    harnessTraceSummary: {
      total: 1,
      completed: 1,
      waitingForApproval: 0,
      blocked: 0,
      failed: 0,
      promptQualityAverage: 96,
      promptQualityUnsafe: 0,
      policyBlocked: 0,
      approvalGated: 0,
      latestAt: new Date().toISOString(),
    },
  });
  const checks = new Map(readiness.checks.map((item) => [item.id, item]));

  assert.equal(checks.get("connector-execution-evidence")?.status, "pass");
  assert.match(checks.get("connector-execution-evidence")?.detail ?? "", /2 with execution envelopes/);
  assert.equal(checks.get("harness-trace-evidence")?.status, "pass");
  assert.match(checks.get("harness-trace-evidence")?.detail ?? "", /average prompt quality 96\/100/);
  assert.equal(readiness.connectors.eventSummary?.total, 2);
  assert.equal(readiness.harnessTraceSummary?.promptQualityAverage, 96);
});

test("production readiness warns when connector execution evidence is stale", () => {
  const readiness = getProductionReadiness({
    connectorEventSummary: {
      total: 1,
      executed: 1,
      simulated: 0,
      requiresApproval: 0,
      blocked: 0,
      envelopeCount: 1,
      missingEnvelopeCount: 0,
      redactedPayloadCount: 1,
      latestAt: "2025-01-01T00:00:00.000Z",
    },
  });
  const checks = new Map(readiness.checks.map((item) => [item.id, item]));

  assert.equal(checks.get("connector-execution-evidence")?.status, "warn");
  assert.match(checks.get("connector-execution-evidence")?.detail ?? "", /freshness window/);
  assert.match(checks.get("connector-execution-evidence")?.detail ?? "", /Rerun one governed connector path/);
});

test("production readiness blocks production launch when connector execution evidence is stale", () =>
  withEnv(
    {
      NODE_ENV: "production",
      ALLOW_UNVERIFIED_CONNECTOR_EVIDENCE_IN_PRODUCTION: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        connectorEventSummary: {
          total: 1,
          executed: 1,
          simulated: 0,
          requiresApproval: 0,
          blocked: 0,
          envelopeCount: 1,
          missingEnvelopeCount: 0,
          redactedPayloadCount: 1,
          latestAt: "2025-01-01T00:00:00.000Z",
        },
      });
      const checks = new Map(readiness.checks.map((item) => [item.id, item]));

      assert.equal(readiness.status, "blocked");
      assert.equal(checks.get("connector-execution-evidence")?.status, "fail");
      assert.match(checks.get("connector-execution-evidence")?.detail ?? "", /ALLOW_UNVERIFIED_CONNECTOR_EVIDENCE_IN_PRODUCTION/);
    },
  ));

test("harnessTraceFreshness applies the configured freshness window", () => {
  const now = new Date("2026-06-19T12:00:00.000Z");
  const fresh = harnessTraceFreshness(
    {
      total: 1,
      completed: 1,
      waitingForApproval: 0,
      blocked: 0,
      failed: 0,
      promptQualityAverage: 95,
      promptQualityUnsafe: 0,
      policyBlocked: 0,
      approvalGated: 0,
      latestAt: "2026-06-12T12:00:00.000Z",
    },
    { HARNESS_TRACE_MAX_AGE_DAYS: "14" },
    now,
  );
  const stale = harnessTraceFreshness(
    {
      total: 1,
      completed: 1,
      waitingForApproval: 0,
      blocked: 0,
      failed: 0,
      promptQualityAverage: 95,
      promptQualityUnsafe: 0,
      policyBlocked: 0,
      approvalGated: 0,
      latestAt: "2026-05-01T12:00:00.000Z",
    },
    { HARNESS_TRACE_MAX_AGE_DAYS: "14" },
    now,
  );

  assert.equal(fresh.fresh, true);
  assert.equal(fresh.ageDays, 7);
  assert.equal(stale.fresh, false);
  assert.equal(stale.maxAgeDays, 14);
  assert.match(stale.reason, /outside the 14-day freshness window/);
});

test("production readiness warns when Harness trace evidence is stale", () => {
  const readiness = getProductionReadiness({
    harnessTraceSummary: {
      total: 1,
      completed: 1,
      waitingForApproval: 0,
      blocked: 0,
      failed: 0,
      promptQualityAverage: 96,
      promptQualityUnsafe: 0,
      policyBlocked: 0,
      approvalGated: 0,
      latestAt: "2025-01-01T00:00:00.000Z",
    },
  });
  const checks = new Map(readiness.checks.map((item) => [item.id, item]));

  assert.equal(checks.get("harness-trace-evidence")?.status, "warn");
  assert.match(checks.get("harness-trace-evidence")?.detail ?? "", /freshness window/);
  assert.match(checks.get("harness-trace-evidence")?.detail ?? "", /Rerun one governed Skill/);
});

test("production readiness blocks production launch when Harness trace evidence is stale", () =>
  withEnv(
    {
      NODE_ENV: "production",
      ALLOW_UNVERIFIED_HARNESS_TRACE_IN_PRODUCTION: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        harnessTraceSummary: {
          total: 1,
          completed: 1,
          waitingForApproval: 0,
          blocked: 0,
          failed: 0,
          promptQualityAverage: 96,
          promptQualityUnsafe: 0,
          policyBlocked: 0,
          approvalGated: 0,
          latestAt: "2025-01-01T00:00:00.000Z",
        },
      });
      const checks = new Map(readiness.checks.map((item) => [item.id, item]));

      assert.equal(readiness.status, "blocked");
      assert.equal(checks.get("harness-trace-evidence")?.status, "fail");
      assert.match(checks.get("harness-trace-evidence")?.detail ?? "", /ALLOW_UNVERIFIED_HARNESS_TRACE_IN_PRODUCTION/);
    },
  ));

test("production readiness warns when connector or Harness evidence is incomplete", () => {
  const readiness = getProductionReadiness({
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
    harnessTraceSummary: {
      total: 1,
      completed: 0,
      waitingForApproval: 0,
      blocked: 0,
      failed: 1,
      promptQualityAverage: 42,
      promptQualityUnsafe: 1,
      policyBlocked: 0,
      approvalGated: 0,
    },
  });
  const checks = new Map(readiness.checks.map((item) => [item.id, item]));

  assert.equal(checks.get("connector-execution-evidence")?.status, "warn");
  assert.match(checks.get("connector-execution-evidence")?.detail ?? "", /legacy event\(s\) without envelopes/);
  assert.match(checks.get("connector-execution-evidence")?.detail ?? "", /preserve the execution envelope/);
  assert.equal(checks.get("harness-trace-evidence")?.status, "warn");
  assert.match(checks.get("harness-trace-evidence")?.detail ?? "", /1 unsafe prompt contract/);
  assert.match(checks.get("harness-trace-evidence")?.detail ?? "", /Resolve unsafe prompt quality or failed trace evidence/);
});

test("production readiness accepts automated tenant context index stats as ingestion evidence", () =>
  withEnv(
    {
      VECTOR_STORE_URL: undefined,
      CONTEXT_INDEX_JOB_URL: undefined,
      CONTEXT_SYNC_WORKER_URL: undefined,
      CONTEXT_SYNC_ENABLED: undefined,
      ALLOW_MANUAL_CONTEXT_INDEXING_IN_PRODUCTION: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        contextIndexStats: {
          totalDocuments: 3,
          indexedDocuments: 3,
          failedDocuments: 0,
          quarantinedDocuments: 0,
          manualDocuments: 0,
          automatedDocuments: 3,
          sources: [
            {
              sourceId: "src-policy",
              sourceName: "Policy Library",
              documents: 3,
              indexedDocuments: 3,
              failedDocuments: 0,
              quarantinedDocuments: 0,
              manualDocuments: 0,
              automatedDocuments: 3,
              ingestionMethods: ["sync_worker"],
              latestStatus: "indexed",
              classification: "internal",
              lastUpdatedAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        },
      });
      const contextCheck = readiness.checks.find((item) => item.id === "context-ingestion");
      const contextDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "context-ingestion");

      assert.equal(contextCheck?.status, "pass");
      assert.match(contextCheck?.detail ?? "", /3 indexed document\(s\).*1 approved source/);
      assert.equal(contextDomain?.status, "ready");
      assert.equal(contextDomain?.evidence.includes("automated context ingestion evidence"), true);
    },
  ));

test("production readiness warns when context index evidence is manual-only", () =>
  withEnv(
    {
      VECTOR_STORE_URL: undefined,
      CONTEXT_INDEX_JOB_URL: undefined,
      CONTEXT_SYNC_WORKER_URL: undefined,
      CONTEXT_SYNC_ENABLED: undefined,
      ALLOW_MANUAL_CONTEXT_INDEXING_IN_PRODUCTION: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        contextIndexStats: {
          totalDocuments: 2,
          indexedDocuments: 2,
          failedDocuments: 0,
          quarantinedDocuments: 0,
          manualDocuments: 2,
          automatedDocuments: 0,
          sources: [
            {
              sourceId: "src-policy",
              sourceName: "Policy Library",
              documents: 2,
              indexedDocuments: 2,
              failedDocuments: 0,
              quarantinedDocuments: 0,
              manualDocuments: 2,
              automatedDocuments: 0,
              ingestionMethods: ["manual"],
              latestStatus: "indexed",
              classification: "internal",
              lastUpdatedAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        },
      });
      const contextCheck = readiness.checks.find((item) => item.id === "context-ingestion");
      const contextDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "context-ingestion");

      assert.equal(contextCheck?.status, "warn");
      assert.match(contextCheck?.detail ?? "", /all ingestion evidence is manual/);
      assert.equal(contextDomain?.status, "needs-work");
      assert.equal(contextDomain?.evidence.includes("manual context ingestion evidence"), true);
    },
  ));

test("production readiness warns when context sources are stale or unindexed", () =>
  withEnv(
    {
      VECTOR_STORE_URL: "postgres://vector",
      CONTEXT_INDEX_JOB_URL: undefined,
      CONTEXT_SYNC_WORKER_URL: undefined,
      CONTEXT_SYNC_ENABLED: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        contextReadiness: {
          totalDocuments: 5,
          indexedSources: 1,
          catalogSources: 3,
          enabledSources: 3,
          healthySources: 1,
          attentionSources: 1,
          staleSources: 1,
          sensitiveSources: 1,
          unindexedEnabledSources: 1,
          indexedDocuments: 4,
          failedDocuments: 1,
          quarantinedDocuments: 0,
          manualDocuments: 0,
          automatedDocuments: 5,
          staleAfterDays: 30,
          latestIndexedAt: "2026-06-01T00:00:00.000Z",
        },
      });
      const contextCheck = readiness.checks.find((item) => item.id === "context-ingestion");
      const contextDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "context-ingestion");

      assert.equal(contextCheck?.status, "warn");
      assert.match(contextCheck?.detail ?? "", /1 needing attention, 1 stale/);
      assert.match(contextCheck?.detail ?? "", /1 enabled source\(s\) without indexed documents/);
      assert.match(contextCheck?.detail ?? "", /1 failed/);
      assert.equal(readiness.contextReadiness?.staleSources, 1);
      assert.equal(contextDomain?.status, "needs-work");
      assert.equal(
        contextDomain?.evidence.some((item) =>
          item.includes("context 4 indexed document(s) / 5 total record(s) / 3 enabled source(s) / 1 stale / 1 unindexed"),
        ),
        true,
      );
    },
  ));

test("production readiness uses privacy lifecycle config for privacy workflow evidence", () =>
  withEnv(
    {
      DATA_RETENTION_DAYS: undefined,
      PRIVACY_EXPORT_ENABLED: undefined,
      PRIVACY_REQUEST_WORKFLOW_URL: "https://privacy.example/workflow",
      DSR_WORKFLOW_URL: undefined,
    },
    () => {
      const readiness = getProductionReadiness();
      const privacyCheck = readiness.checks.find((item) => item.id === "privacy-lifecycle");
      const privacyDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "privacy-lifecycle");

      assert.equal(privacyCheck?.status, "pass");
      assert.match(privacyCheck?.detail ?? "", /External privacy request workflow is configured/);
      assert.match(privacyCheck?.detail ?? "", /365 day/);
      assert.equal(readiness.privacyLifecycle.mode, "external-workflow");
      assert.equal(privacyDomain?.status, "ready");
      assert.equal(privacyDomain?.evidence.includes("external-workflow configured"), true);
    },
  ));

test("production readiness includes privacy operation evidence and warns on blocked requests", () =>
  withEnv(
    {
      DATA_RETENTION_DAYS: "365",
      PRIVACY_EXPORT_ENABLED: "true",
      PRIVACY_REQUEST_WORKFLOW_URL: undefined,
      DSR_WORKFLOW_URL: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        privacyOperations: {
          requestCount: 3,
          acceptedCount: 1,
          forwardedCount: 1,
          blockedCount: 1,
          exportCount: 2,
          retentionSweepCount: 1,
          latestAt: "2026-06-01T12:00:00.000Z",
        },
      });
      const privacyCheck = readiness.checks.find((item) => item.id === "privacy-lifecycle");
      const privacyDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "privacy-lifecycle");

      assert.equal(privacyCheck?.status, "warn");
      assert.match(privacyCheck?.detail ?? "", /3 request\(s\)/);
      assert.match(privacyCheck?.detail ?? "", /1 blocked/);
      assert.match(privacyCheck?.detail ?? "", /Resolve blocked privacy requests/);
      assert.equal(readiness.privacyOperations?.blockedCount, 1);
      assert.equal(privacyDomain?.status, "needs-work");
      assert.equal(privacyDomain?.evidence.includes("privacy ops 3 request(s) / 1 blocked / 2 export(s) / 1 retention sweep(s)"), true);
    },
  ));

test("production readiness uses observability config for operational event evidence", () =>
  withEnv(
    {
      NODE_ENV: "development",
      LOG_DRAIN_URL: undefined,
      OTEL_EXPORTER_OTLP_ENDPOINT: undefined,
      SENTRY_DSN: undefined,
      ALLOW_LOCAL_OBSERVABILITY_IN_PRODUCTION: undefined,
    },
    () => {
      const readiness = getProductionReadiness();
      const observabilityCheck = readiness.checks.find((item) => item.id === "observability");
      const observabilityDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "observability");

      assert.equal(observabilityCheck?.status, "pass");
      assert.match(observabilityCheck?.detail ?? "", /local console output/);
      assert.equal(readiness.observability.mode, "local-console");
      assert.equal(observabilityDomain?.status, "ready");
      assert.equal(observabilityDomain?.evidence.includes("local-console"), true);
    },
  ));

test("production readiness includes tenant eval schedule evidence without overstating cadence", () =>
  withEnv(
    {
      EVAL_RUNNER_URL: undefined,
      EVAL_SCHEDULE_ENABLED: undefined,
      EVAL_SCHEDULE_CRON: undefined,
      EVAL_MAX_AGE_DAYS: "21",
    },
    () => {
      const readiness = getProductionReadiness({
        evalSchedulePlan: {
          schema: "enterprise-ai-enablement-os.eval-schedule.v1",
          generatedAt: "2026-06-02T00:00:00.000Z",
          cadenceDays: 21,
          dueCount: 2,
          blockedCount: 1,
          healthyCount: 3,
          items: [],
        },
      });
      const evalCheck = readiness.checks.find((item) => item.id === "continuous-evals");
      const evalDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "continuous-evals");

      assert.equal(evalCheck?.status, "warn");
      assert.match(evalCheck?.detail ?? "", /3 healthy, 2 due, 1 blocked/);
      assert.match(evalCheck?.detail ?? "", /Resolve blocked eval suites/);
      assert.equal(readiness.evalCadence.mode, "missing");
      assert.equal(evalDomain?.status, "needs-work");
      assert.equal(evalDomain?.evidence.includes("schedule 3 healthy / 2 due / 1 blocked"), true);
    },
  ));

test("production readiness includes workflow job ledger evidence without passing local execution", () =>
  withEnv(
    {
      NODE_ENV: "development",
      TEMPORAL_ADDRESS: undefined,
      WORKFLOW_ENGINE_URL: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        workflowJobSummary: {
          total: 4,
          active: 2,
          queued: 1,
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
      });
      const workflowCheck = readiness.checks.find((item) => item.id === "workflow-engine");
      const workflowDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "workflow-runtime");

      assert.equal(workflowCheck?.status, "warn");
      assert.match(workflowCheck?.detail ?? "", /Local workflow job ledger is active/);
      assert.match(workflowCheck?.detail ?? "", /4 total/);
      assert.match(workflowCheck?.detail ?? "", /1 failed/);
      assert.equal(readiness.workflows.jobSummary?.failed, 1);
      assert.equal(workflowDomain?.status, "needs-work");
      assert.equal(workflowDomain?.score, 48);
      assert.equal(workflowDomain?.evidence.includes("jobs 4 total / 2 active / 1 failed / 0 stale active"), true);
    },
  ));

test("production readiness warns on stale active workflow jobs even with an external engine", () =>
  withEnv(
    {
      WORKFLOW_ENGINE_URL: "https://workflow.example.com",
      TEMPORAL_ADDRESS: undefined,
    },
    () => {
      const readiness = getProductionReadiness({
        workflowJobSummary: {
          total: 2,
          active: 1,
          queued: 1,
          running: 0,
          waitingForApproval: 0,
          completed: 1,
          failed: 0,
          cancelled: 0,
          staleActive: 1,
          staleAfterMinutes: 30,
          oldestActiveAt: "2026-06-01T09:00:00.000Z",
          latestUpdatedAt: "2026-06-01T09:00:00.000Z",
        },
        workflowReconciliationPlan: {
          action: "reconcile_stale",
          scanned: 2,
          selected: 1,
          staleAfterMinutes: 30,
          cutoffAt: "2026-06-01T09:30:00.000Z",
          maxJobs: 50,
          plannedCancels: 1,
          plannedFailures: 0,
          approvalEscalations: 0,
          plannedMutations: 1,
          items: [],
        },
      });
      const workflowCheck = readiness.checks.find((item) => item.id === "workflow-engine");
      const workflowDomain = readiness.customerLaunchContract.domains.find((domain) => domain.id === "workflow-runtime");

      assert.equal(workflowCheck?.status, "warn");
      assert.match(workflowCheck?.detail ?? "", /1 stale active after 30 minute/);
      assert.match(workflowCheck?.detail ?? "", /1 queued cancellation/);
      assert.match(workflowCheck?.detail ?? "", /Investigate stale active workflow jobs/);
      assert.equal(readiness.workflows.reconciliationPlan?.plannedCancels, 1);
      assert.equal(workflowDomain?.status, "needs-work");
      assert.equal(workflowDomain?.evidence.includes("jobs 2 total / 1 active / 0 failed / 1 stale active"), true);
    },
  ));

test("production readiness blocks customer launch without providers, connector broker, and workflow engine", () =>
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
      DB_SCHEMA_VERSION: "2026.05.29",
      DB_MIGRATIONS_APPLIED: "true",
      MANAGED_DATABASE_BACKUPS: "true",
      DATABASE_RESTORE_DRILL_AT: "2026-05-29T00:00:00.000Z",
      EVAL_RUNNER_URL: "https://eval.example.com",
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      GOOGLE_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
      KIMI_API_KEY: undefined,
      GLM_API_KEY: undefined,
      DEEPSEEK_API_KEY: undefined,
      OPENROUTER_API_KEY: undefined,
      MCP_BROKER_URL: undefined,
      CONNECTOR_BROKER_URL: undefined,
      TEMPORAL_ADDRESS: undefined,
      WORKFLOW_ENGINE_URL: undefined,
      ALLOW_LOCAL_MODEL_RUNTIME_IN_PRODUCTION: undefined,
      ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION: undefined,
      ALLOW_LOCAL_WORKFLOW_ENGINE_IN_PRODUCTION: undefined,
    },
    () => {
      const readiness = getProductionReadiness();
      const blockers = new Set(readiness.blockers.map((item) => item.id));

      assert.equal(readiness.status, "blocked");
      assert.equal(blockers.has("providers"), true);
      assert.equal(blockers.has("connectors"), true);
      assert.equal(blockers.has("workflow-engine"), true);
    },
  ));

test("production readiness permits explicit private-beta runtime overrides", () =>
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
      DB_SCHEMA_VERSION: "2026.05.29",
      DB_MIGRATIONS_APPLIED: "true",
      MANAGED_DATABASE_BACKUPS: "true",
      DATABASE_RESTORE_DRILL_AT: "2026-05-29T00:00:00.000Z",
      EVAL_RUNNER_URL: undefined,
      OPENAI_API_KEY: undefined,
      MCP_BROKER_URL: undefined,
      MCP_BROKER_TOKEN: undefined,
      CONNECTOR_BROKER_URL: undefined,
      CONNECTOR_BROKER_TOKEN: undefined,
      TEMPORAL_ADDRESS: undefined,
      WORKFLOW_ENGINE_URL: undefined,
      ALLOW_LOCAL_MODEL_RUNTIME_IN_PRODUCTION: "true",
      ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION: "true",
      ALLOW_LOCAL_WORKFLOW_ENGINE_IN_PRODUCTION: "true",
      ALLOW_UNVERIFIED_CONNECTOR_EVIDENCE_IN_PRODUCTION: "true",
      ALLOW_UNVERIFIED_HARNESS_TRACE_IN_PRODUCTION: "true",
    },
    () => {
      const readiness = getProductionReadiness();
      const warnings = new Set(readiness.warnings.map((item) => item.id));

      assert.equal(readiness.status, "degraded");
      assert.equal(warnings.has("providers"), true);
      assert.equal(warnings.has("connectors"), true);
      assert.equal(warnings.has("workflow-engine"), true);
      assert.equal(warnings.has("connector-execution-evidence"), true);
      assert.equal(warnings.has("harness-trace-evidence"), true);
      assert.equal(readiness.blockers.length, 0);
    },
  ));

test("production readiness blocks broad launch without user lifecycle provisioning", () =>
  withEnv(
    {
      NODE_ENV: "production",
      PROVISIONING_API_TOKEN: undefined,
      SCIM_BEARER_TOKEN: undefined,
      ALLOW_MANUAL_USER_PROVISIONING_IN_PRODUCTION: undefined,
    },
    () => {
      const readiness = getProductionReadiness();
      assert.equal(readiness.userProvisioning.configured, false);
      assert.equal(readiness.checks.some((item) => item.id === "user-provisioning" && item.status === "fail"), true);
    },
  ));

test("tenant provisioning readiness keeps production self-serve closed by default", () =>
  withEnv(
    {
      NODE_ENV: "production",
      SELF_SERVE_SIGNUP_ENABLED: undefined,
      CUSTOMER_ONBOARDING_TERMS_URL: undefined,
    },
    () => {
      const tenantProvisioning = tenantProvisioningReadinessFromEnv(process.env);
      const readiness = getProductionReadiness({ tenantProvisioning });
      const check = readiness.checks.find((item) => item.id === "tenant-provisioning");

      assert.equal(tenantProvisioning.enabled, false);
      assert.equal(tenantProvisioning.configured, true);
      assert.equal(check?.status, "pass");
    },
  ));

test("tenant provisioning readiness blocks unsafe production self-serve", () =>
  withEnv(
    {
      NODE_ENV: "production",
      SELF_SERVE_SIGNUP_ENABLED: "true",
      AUTH_REQUIRED: "true",
      OIDC_ISSUER: "https://idp.example.com",
      OIDC_CLIENT_ID: "client",
      OIDC_CLIENT_SECRET: undefined,
      DATABASE_URL: undefined,
      TENANT_SECRET_KEY: undefined,
      SECRET_VAULT_KEY: undefined,
      API_TRUSTED_ORIGINS: "https://app.example.com",
      API_RATE_LIMIT_KEY_SALT: undefined,
      CUSTOMER_ONBOARDING_TERMS_URL: undefined,
      ONBOARDING_TERMS_URL: undefined,
      TERMS_OF_SERVICE_URL: undefined,
    },
    () => {
      const tenantProvisioning = tenantProvisioningReadinessFromEnv(process.env);
      const readiness = getProductionReadiness({ tenantProvisioning });
      const check = readiness.checks.find((item) => item.id === "tenant-provisioning");

      assert.equal(tenantProvisioning.requested, true);
      assert.equal(tenantProvisioning.enabled, false);
      assert.equal(tenantProvisioning.configured, false);
      assert.match(tenantProvisioning.reason, /SELF_SERVE_SIGNUP_ENABLED=true/);
      assert.equal(tenantProvisioning.missing.includes("DATABASE_URL"), true);
      assert.equal(check?.status, "fail");
      assert.equal(readiness.blockers.some((item) => item.id === "tenant-provisioning"), true);
    },
  ));

test("tenant provisioning readiness rejects malformed production self-serve prerequisites", () =>
  withEnv(
    {
      NODE_ENV: "production",
      SELF_SERVE_SIGNUP_ENABLED: "true",
      AUTH_REQUIRED: "true",
      OIDC_ISSUER: "not-a-url",
      OIDC_CLIENT_ID: "client",
      OIDC_CLIENT_SECRET: "secret",
      OIDC_REDIRECT_URI: "https://app.example.com/api/auth/oidc/callback",
      DATABASE_URL: "sqlite://local",
      TENANT_SECRET_KEY: "Mk4Pq8Zx2Vn6Wm9sLk3Rj7Hd5Gf1Yb8Qa0Ue4Ic",
      SECRET_VAULT_KEY: undefined,
      API_TRUSTED_ORIGINS: "https://app.example.com/path",
      API_RATE_LIMIT_KEY_SALT: "Rj7Hd5Gf1Yb8Qa0Uv",
      CUSTOMER_ONBOARDING_TERMS_URL: "http://terms.example.com",
      ONBOARDING_TERMS_URL: undefined,
      TERMS_OF_SERVICE_URL: undefined,
    },
    () => {
      const tenantProvisioning = tenantProvisioningReadinessFromEnv(process.env);

      assert.equal(tenantProvisioning.enabled, false);
      assert.equal(tenantProvisioning.configured, false);
      assert.equal(
        tenantProvisioning.missing.includes("AUTH_REQUIRED=true with OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_REDIRECT_URI"),
        true,
      );
      assert.equal(tenantProvisioning.missing.includes("DATABASE_URL"), true);
      assert.equal(tenantProvisioning.missing.includes("API_TRUSTED_ORIGINS and API_RATE_LIMIT_KEY_SALT"), true);
      assert.equal(
        tenantProvisioning.missing.includes("CUSTOMER_ONBOARDING_TERMS_URL, ONBOARDING_TERMS_URL, or TERMS_OF_SERVICE_URL with an HTTPS URL"),
        true,
      );
    },
  ));

test("tenant provisioning readiness permits production self-serve after onboarding prerequisites", () =>
  withEnv(
    {
      NODE_ENV: "production",
      SELF_SERVE_SIGNUP_ENABLED: "true",
      AUTH_REQUIRED: "true",
      OIDC_ISSUER: "https://idp.example.com",
      OIDC_CLIENT_ID: "client",
      OIDC_CLIENT_SECRET: "secret",
      OIDC_REDIRECT_URI: "https://app.example.com/api/auth/oidc/callback",
      DATABASE_URL: "postgres://example",
      TENANT_SECRET_KEY: "Mk4Pq8Zx2Vn6Wm9sLk3Rj7Hd5Gf1Yb8Qa0Ue4Ic",
      SECRET_VAULT_KEY: undefined,
      API_TRUSTED_ORIGINS: "https://app.example.com",
      API_RATE_LIMIT_KEY_SALT: "Rj7Hd5Gf1Yb8Qa0Uv",
      CUSTOMER_ONBOARDING_TERMS_URL: "https://app.example.com/legal/onboarding-terms",
    },
    () => {
      const tenantProvisioning = tenantProvisioningReadinessFromEnv(process.env);
      const readiness = getProductionReadiness({ tenantProvisioning });
      const check = readiness.checks.find((item) => item.id === "tenant-provisioning");

      assert.equal(tenantProvisioning.enabled, true);
      assert.equal(tenantProvisioning.configured, true);
      assert.equal(tenantProvisioning.missing.length, 0);
      assert.equal(check?.status, "pass");
    },
  ));

test("production readiness allows explicit manual provisioning for private beta", () =>
  withEnv(
    {
      NODE_ENV: "production",
      PROVISIONING_API_TOKEN: undefined,
      SCIM_BEARER_TOKEN: undefined,
      ALLOW_MANUAL_USER_PROVISIONING_IN_PRODUCTION: "true",
    },
    () => {
      const readiness = getProductionReadiness();
      assert.equal(readiness.userProvisioning.mode, "manual-admin");
      assert.equal(readiness.checks.some((item) => item.id === "user-provisioning" && item.status === "warn"), true);
    },
  ));
