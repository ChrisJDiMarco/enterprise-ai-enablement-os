import { test } from "node:test";
import assert from "node:assert/strict";
import { getEnterpriseConnectorReadiness } from "../src/lib/enterprise-connectors.ts";
import { getProviderReadiness } from "../src/lib/provider-registry.ts";
import { loadTenantSecretEvidence } from "../src/lib/tenant-secret-evidence.ts";

test("tenant secret evidence applies vault names when the vault is runtime-usable", async () => {
  const result = await loadTenantSecretEvidence({
    organizationId: "org-1",
    env: { NODE_ENV: "production", TENANT_SECRET_KEY: "Mk4Pq8Zx2Vn6Wm9sLk3Rj7Hd5Gf1Yb8Qa0Ue4Ic" },
    deps: {
      async listTenantSecrets() {
        return [{ name: "OPENAI_API_KEY", updatedAt: "2026-06-19T12:00:00.000Z" }];
      },
      async readTenantSecretValues() {
        return { OPENAI_API_KEY: "sk-test" };
      },
    },
  });

  const openai = getProviderReadiness({}, result.runtimeSecretNames).find((provider) => provider.id === "openai");

  assert.equal(result.evidence.readable, true);
  assert.equal(result.evidence.usableForRuntime, true);
  assert.equal(result.evidence.tenantVaultNamesApplied, true);
  assert.equal(result.evidence.configuredSecretCount, 1);
  assert.equal(result.evidence.decryptableSecretCount, 1);
  assert.equal(result.evidence.undecryptableSecretCount, 0);
  assert.deepEqual(result.evidence.unsupportedSecretNames, []);
  assert.deepEqual(result.runtimeSecretNames, ["OPENAI_API_KEY"]);
  assert.equal(openai?.configured, true);
});

test("tenant secret evidence filters unsupported vault names out of runtime readiness", async () => {
  const result = await loadTenantSecretEvidence({
    organizationId: "org-1",
    env: { NODE_ENV: "production", TENANT_SECRET_KEY: "Mk4Pq8Zx2Vn6Wm9sLk3Rj7Hd5Gf1Yb8Qa0Ue4Ic" },
    deps: {
      async listTenantSecrets() {
        return [
          { name: "OPENAI_API_KEY", updatedAt: "2026-06-19T12:00:00.000Z" },
          { name: "OLD_VENDOR_SECRET", updatedAt: "2026-06-19T12:00:00.000Z" },
        ];
      },
      async readTenantSecretValues() {
        return {
          OPENAI_API_KEY: "sk-test",
          OLD_VENDOR_SECRET: "legacy-secret",
        };
      },
    },
  });
  const openai = getProviderReadiness({}, result.runtimeSecretNames).find((provider) => provider.id === "openai");

  assert.equal(result.evidence.readable, true);
  assert.equal(result.evidence.usableForRuntime, true);
  assert.equal(result.evidence.tenantVaultNamesApplied, true);
  assert.equal(result.evidence.configuredSecretCount, 2);
  assert.equal(result.evidence.decryptableSecretCount, 2);
  assert.equal(result.evidence.undecryptableSecretCount, 0);
  assert.deepEqual(result.evidence.unsupportedSecretNames, ["OLD_VENDOR_SECRET"]);
  assert.deepEqual(result.runtimeSecretNames, ["OPENAI_API_KEY"]);
  assert.match(result.evidence.warning ?? "", /unsupported secret names/i);
  assert.equal(openai?.configured, true);
});

test("tenant secret evidence canonicalizes names and drops unsafe vault records", async () => {
  const result = await loadTenantSecretEvidence({
    organizationId: "org-1",
    env: { NODE_ENV: "production", TENANT_SECRET_KEY: "Mk4Pq8Zx2Vn6Wm9sLk3Rj7Hd5Gf1Yb8Qa0Ue4Ic" },
    deps: {
      async listTenantSecrets() {
        return [
          { name: " openai_api_key ", updatedAt: "2026-06-19T12:00:00.000Z" },
          { name: "SLACK_BOT_TOKEN=xoxb-sensitive1234567890", updatedAt: "2026-06-19T12:00:00.000Z" },
          { name: "person@example.com", updatedAt: "2026-06-19T12:00:00.000Z" },
        ];
      },
      async readTenantSecretValues() {
        return { OPENAI_API_KEY: "sk-test" };
      },
    },
  });
  const serialized = JSON.stringify(result);

  assert.deepEqual(result.configuredSecretNames, ["OPENAI_API_KEY"]);
  assert.deepEqual(result.runtimeSecretNames, ["OPENAI_API_KEY"]);
  assert.equal(result.evidence.configuredSecretCount, 1);
  assert.equal(serialized.includes("xoxb-sensitive"), false);
  assert.equal(serialized.includes("person@example.com"), false);
});

test("tenant secret evidence does not apply vault names when stored values cannot be decrypted", async () => {
  const result = await loadTenantSecretEvidence({
    organizationId: "org-1",
    env: { NODE_ENV: "production", TENANT_SECRET_KEY: "Mk4Pq8Zx2Vn6Wm9sLk3Rj7Hd5Gf1Yb8Qa0Ue4Ic" },
    deps: {
      async listTenantSecrets() {
        return [
          { name: "OPENAI_API_KEY", updatedAt: "2026-06-19T12:00:00.000Z" },
          { name: "SLACK_BOT_TOKEN", updatedAt: "2026-06-19T12:00:00.000Z" },
        ];
      },
      async readTenantSecretValues() {
        return { OPENAI_API_KEY: "sk-test" };
      },
    },
  });
  const openai = getProviderReadiness({}, result.runtimeSecretNames).find((provider) => provider.id === "openai");

  assert.equal(result.evidence.readable, true);
  assert.equal(result.evidence.usableForRuntime, false);
  assert.equal(result.evidence.tenantVaultNamesApplied, false);
  assert.equal(result.evidence.configuredSecretCount, 2);
  assert.equal(result.evidence.decryptableSecretCount, 1);
  assert.equal(result.evidence.undecryptableSecretCount, 1);
  assert.deepEqual(result.evidence.unsupportedSecretNames, []);
  assert.deepEqual(result.runtimeSecretNames, []);
  assert.match(result.evidence.warning ?? "", /could not be verified/);
  assert.equal(openai?.configured, false);
});

test("tenant secret evidence does not apply decrypted tenant values that fail runtime format checks", async () => {
  const result = await loadTenantSecretEvidence({
    organizationId: "org-1",
    env: { NODE_ENV: "production", TENANT_SECRET_KEY: "Mk4Pq8Zx2Vn6Wm9sLk3Rj7Hd5Gf1Yb8Qa0Ue4Ic" },
    deps: {
      async listTenantSecrets() {
        return [
          { name: "JIRA_BASE_URL", updatedAt: "2026-06-19T12:00:00.000Z" },
          { name: "JIRA_EMAIL", updatedAt: "2026-06-19T12:00:00.000Z" },
          { name: "JIRA_API_TOKEN", updatedAt: "2026-06-19T12:00:00.000Z" },
          { name: "SLACK_BOT_TOKEN", updatedAt: "2026-06-19T12:00:00.000Z" },
          { name: "SLACK_SIGNING_SECRET", updatedAt: "2026-06-19T12:00:00.000Z" },
        ];
      },
      async readTenantSecretValues() {
        return {
          JIRA_BASE_URL: "not-a-url",
          JIRA_EMAIL: "not-email",
          JIRA_API_TOKEN: "jira-token",
          SLACK_BOT_TOKEN: "xoxb-test-token",
          SLACK_SIGNING_SECRET: "signing-secret",
        };
      },
    },
  });
  const jira = getEnterpriseConnectorReadiness({}, result.runtimeSecretNames).connectors.find((connector) => connector.id === "jira");
  const slack = getEnterpriseConnectorReadiness({}, result.runtimeSecretNames).connectors.find((connector) => connector.id === "slack");

  assert.equal(result.evidence.readable, true);
  assert.equal(result.evidence.usableForRuntime, false);
  assert.equal(result.evidence.tenantVaultNamesApplied, false);
  assert.equal(result.evidence.configuredSecretCount, 5);
  assert.equal(result.evidence.decryptableSecretCount, 5);
  assert.equal(result.evidence.undecryptableSecretCount, 0);
  assert.equal(result.evidence.invalidSecretCount, 2);
  assert.deepEqual(result.evidence.invalidSecretNames, ["JIRA_BASE_URL", "JIRA_EMAIL"]);
  assert.deepEqual(result.runtimeSecretNames, []);
  assert.match(result.evidence.warning ?? "", /runtime format checks/i);
  assert.equal(jira?.status, "missing");
  assert.equal(slack?.status, "missing");
});

test("tenant secret evidence does not apply vault names when production vault encryption is missing", async () => {
  const result = await loadTenantSecretEvidence({
    organizationId: "org-1",
    env: { NODE_ENV: "production" },
    deps: {
      async listTenantSecrets() {
        return [
          { name: "OPENAI_API_KEY", updatedAt: "2026-06-19T12:00:00.000Z" },
          { name: "SLACK_BOT_TOKEN", updatedAt: "2026-06-19T12:00:00.000Z" },
          { name: "SLACK_SIGNING_SECRET", updatedAt: "2026-06-19T12:00:00.000Z" },
        ];
      },
    },
  });
  const openai = getProviderReadiness({}, result.runtimeSecretNames).find((provider) => provider.id === "openai");
  const slack = getEnterpriseConnectorReadiness({}, result.runtimeSecretNames).connectors.find((connector) => connector.id === "slack");

  assert.equal(result.evidence.readable, true);
  assert.equal(result.evidence.usableForRuntime, false);
  assert.equal(result.evidence.tenantVaultNamesApplied, false);
  assert.equal(result.evidence.configuredSecretCount, 3);
  assert.equal(result.evidence.decryptableSecretCount, 0);
  assert.equal(result.evidence.undecryptableSecretCount, 3);
  assert.deepEqual(result.evidence.unsupportedSecretNames, []);
  assert.deepEqual(result.runtimeSecretNames, []);
  assert.match(result.evidence.warning ?? "", /TENANT_SECRET_KEY/);
  assert.equal(openai?.configured, false);
  assert.equal(slack?.status, "missing");
});

test("tenant secret evidence sanitizes lookup failures and fails readiness closed", async () => {
  const result = await loadTenantSecretEvidence({
    organizationId: "org-1",
    env: { NODE_ENV: "production", TENANT_SECRET_KEY: "Mk4Pq8Zx2Vn6Wm9sLk3Rj7Hd5Gf1Yb8Qa0Ue4Ic" },
    deps: {
      async listTenantSecrets() {
        throw new Error("postgres://user:secret@internal.example.com/db failed");
      },
    },
  });

  assert.equal(result.evidence.readable, false);
  assert.equal(result.evidence.usableForRuntime, false);
  assert.equal(result.evidence.tenantVaultNamesApplied, false);
  assert.equal(result.evidence.configuredSecretCount, 0);
  assert.equal(result.evidence.decryptableSecretCount, 0);
  assert.equal(result.evidence.undecryptableSecretCount, 0);
  assert.deepEqual(result.evidence.unsupportedSecretNames, []);
  assert.deepEqual(result.configuredSecretNames, []);
  assert.deepEqual(result.runtimeSecretNames, []);
  assert.match(result.evidence.warning ?? "", /Tenant secret names could not be loaded/);
  assert.equal(JSON.stringify(result).includes("postgres://"), false);
  assert.equal(JSON.stringify(result).includes("secret@internal"), false);
});
