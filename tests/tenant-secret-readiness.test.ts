import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildTenantSecretReadinessImpact,
  deriveTenantSecretOperationScope,
  isKnownTenantSecretName,
  unknownTenantSecretNames,
} from "../src/lib/tenant-secret-readiness.ts";

test("tenant secret impact reports newly ready model providers without secret values", () => {
  const impact = buildTenantSecretReadinessImpact({
    beforeConfiguredSecretNames: [],
    configuredSecretNames: ["OPENAI_API_KEY"],
    changedNames: ["OPENAI_API_KEY"],
    env: {},
  });

  assert.equal(impact.schema, "enterprise-ai-enablement-os.tenant-secret-impact.v1");
  assert.equal(impact.categorySummary.provider, 1);
  assert.equal(impact.changedSummary.provider, 1);
  assert.equal(impact.providers.readyExternalCount, 1);
  assert.deepEqual(impact.providers.newlyReady.map((provider) => provider.id), ["openai"]);
  assert.match(impact.providers.nextAction, /OpenAI/);
  assert.equal(JSON.stringify(impact).includes("sk-"), false);
});

test("tenant secret impact detects a connector becoming natively ready", () => {
  const impact = buildTenantSecretReadinessImpact({
    beforeConfiguredSecretNames: ["SLACK_BOT_TOKEN"],
    configuredSecretNames: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
    changedNames: ["SLACK_SIGNING_SECRET"],
    env: {},
  });

  assert.equal(impact.changedSummary.connector, 1);
  assert.deepEqual(impact.connectors.newlyReady.map((connector) => connector.id), ["slack"]);
  assert.equal(impact.connectors.incompleteAffected.length, 0);
  assert.match(impact.connectors.nextAction, /Slack/);
  assert.match(impact.connectors.nextAction, /capture proof/i);
});

test("tenant secret impact detects an external broker route becoming ready", () => {
  const impact = buildTenantSecretReadinessImpact({
    beforeConfiguredSecretNames: ["MCP_BROKER_URL"],
    configuredSecretNames: ["MCP_BROKER_URL", "MCP_BROKER_TOKEN"],
    changedNames: ["MCP_BROKER_TOKEN"],
    env: {},
  });

  assert.equal(impact.categorySummary.tenant, 2);
  assert.equal(impact.changedSummary.tenant, 1);
  assert.equal(impact.connectors.brokerMode, "mcp-broker");
  assert.equal(impact.connectors.brokerUrlConfigured, true);
  assert.equal(impact.connectors.brokerAuthenticated, true);
  assert.equal(impact.connectors.brokerConfigured, true);
  assert.equal(impact.connectors.productionReady, true);
  assert.match(impact.connectors.nextAction, /production-ready/i);
});

test("tenant secret impact does not mark stored provider names ready when values are not runtime-verified", () => {
  const impact = buildTenantSecretReadinessImpact({
    beforeConfiguredSecretNames: [],
    configuredSecretNames: ["OPENAI_API_KEY"],
    runtimeSecretNames: [],
    changedNames: ["OPENAI_API_KEY"],
    env: {},
  });

  assert.equal(impact.categorySummary.provider, 1);
  assert.equal(impact.providers.readyExternalCount, 0);
  assert.deepEqual(impact.providers.newlyReady.map((provider) => provider.id), []);
  assert.deepEqual(impact.providers.incompleteAffected.map((provider) => provider.id), ["openai"]);
  assert.match(impact.providers.nextAction, /OPENAI_API_KEY/);
});

test("tenant secret impact does not mark stored broker names ready when values are not runtime-verified", () => {
  const impact = buildTenantSecretReadinessImpact({
    beforeConfiguredSecretNames: [],
    configuredSecretNames: ["MCP_BROKER_URL", "MCP_BROKER_TOKEN"],
    runtimeSecretNames: [],
    changedNames: ["MCP_BROKER_URL", "MCP_BROKER_TOKEN"],
    env: {},
  });

  assert.equal(impact.categorySummary.tenant, 2);
  assert.equal(impact.connectors.brokerMode, "policy-only");
  assert.equal(impact.connectors.brokerUrlConfigured, false);
  assert.equal(impact.connectors.brokerAuthenticated, false);
  assert.equal(impact.connectors.productionReady, false);
  assert.match(impact.connectors.nextAction, /Connect an MCP or connector broker/);
});

test("tenant secret impact points admins at missing fields for partial connections", () => {
  const impact = buildTenantSecretReadinessImpact({
    beforeConfiguredSecretNames: [],
    configuredSecretNames: ["AZURE_OPENAI_API_KEY", "SERVICENOW_INSTANCE_URL"],
    changedNames: ["AZURE_OPENAI_API_KEY", "SERVICENOW_INSTANCE_URL"],
    env: {},
  });

  const azure = impact.providers.incompleteAffected.find((provider) => provider.id === "azure_openai");
  const serviceNow = impact.connectors.incompleteAffected.find((connector) => connector.id === "service_now");

  assert.deepEqual(azure?.missing, ["AZURE_OPENAI_ENDPOINT"]);
  assert.deepEqual(serviceNow?.missingSecrets, ["SERVICENOW_CLIENT_ID", "SERVICENOW_CLIENT_SECRET"]);
  assert.match(impact.nextAction, /Azure OpenAI/);
  assert.match(impact.connectors.nextAction, /ServiceNow/);
});

test("tenant secret allowlist covers cataloged provider, connector, and control-plane names", () => {
  assert.equal(isKnownTenantSecretName("OPENAI_API_KEY"), true);
  assert.equal(isKnownTenantSecretName(" openai_api_key "), true);
  assert.equal(isKnownTenantSecretName("SLACK_SIGNING_SECRET"), true);
  assert.equal(isKnownTenantSecretName("OIDC_CLIENT_SECRET"), true);
  assert.deepEqual(
    unknownTenantSecretNames([
      "OPENAI_API_KEY",
      " openai_api_key ",
      "RANDOM_SECRET",
      "SLACK_BOT_TOKEN",
      "OPENAI_API_KEY=sk-live-sensitive1234567890",
      "person@example.com",
      "../SECRET",
    ]),
    ["RANDOM_SECRET"],
  );
});

test("tenant secret impact reports unsupported legacy vault names for cleanup", () => {
  const impact = buildTenantSecretReadinessImpact({
    configuredSecretNames: [
      "openai_api_key",
      "OLD_VENDOR_SECRET",
      "OPENAI_API_KEY=sk-live-sensitive1234567890",
      "person@example.com",
    ],
    changedNames: ["person@example.com", "OLD_VENDOR_SECRET"],
    env: {},
  });
  const serialized = JSON.stringify(impact);

  assert.deepEqual(impact.unsupportedSecretNames, ["OLD_VENDOR_SECRET"]);
  assert.equal(impact.categorySummary.provider, 1);
  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("person@example.com"), false);
  assert.match(impact.nextAction, /unsupported tenant vault secret name/);
});

test("tenant secret operation scope is derived from secret names, not only the client label", () => {
  assert.equal(
    deriveTenantSecretOperationScope({
      requestedScope: "provider",
      secretNames: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
    }),
    "connector",
  );
  assert.equal(
    deriveTenantSecretOperationScope({
      requestedScope: "connector",
      secretNames: ["MCP_BROKER_URL", "MCP_BROKER_TOKEN"],
    }),
    "connector",
  );
  assert.equal(
    deriveTenantSecretOperationScope({
      requestedScope: "connector",
      secretNames: ["OPENAI_API_KEY"],
    }),
    "provider",
  );
  assert.equal(
    deriveTenantSecretOperationScope({
      requestedScope: "provider",
      secretNames: ["OPENAI_API_KEY", "SLACK_BOT_TOKEN"],
    }),
    "tenant",
  );
  assert.equal(
    deriveTenantSecretOperationScope({
      requestedScope: "connector",
      secretNames: ["OLD_VENDOR_SECRET"],
    }),
    "tenant",
  );
});
