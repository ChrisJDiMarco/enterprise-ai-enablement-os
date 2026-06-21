import { test } from "node:test";
import assert from "node:assert/strict";
import { enterpriseConnectorRegistry, getEnterpriseConnectorReadiness } from "../src/lib/enterprise-connectors.ts";

test("connector catalog covers the major enterprise AI enablement surfaces", () => {
  const ids = new Set<string>(enterpriseConnectorRegistry.map((connector) => connector.id));
  [
    "confluence",
    "salesforce",
    "github",
    "azure_devops",
    "zendesk",
    "snowflake",
    "databricks",
    "sap",
    "netsuite",
    "hubspot",
    "gong",
    "langfuse",
    "langsmith",
    "arize_phoenix",
    "braintrust",
  ].forEach((id) => assert.equal(ids.has(id), true, `${id} should be in the connector catalog`));

  const categories = new Set<string>(enterpriseConnectorRegistry.map((connector) => connector.category));
  ["crm", "source_control", "support", "data_warehouse", "lakehouse", "erp", "revenue", "observability", "evals"].forEach((category) =>
    assert.equal(categories.has(category), true, `${category} should be represented in the connector catalog`),
  );
});

test("connector readiness treats an external MCP broker as broker-managed execution", () => {
  const readiness = getEnterpriseConnectorReadiness({
    MCP_BROKER_URL: "https://broker.example.com",
    MCP_BROKER_TOKEN: "broker-token",
  }, []);

  assert.equal(readiness.brokerConfigured, true);
  assert.equal(readiness.brokerUrlConfigured, true);
  assert.equal(readiness.brokerAuthenticated, true);
  assert.equal(readiness.brokerMode, "mcp-broker");
  assert.equal(readiness.productionReady, true);
  assert.equal(readiness.connectors.every((connector) => connector.executionMode === "external-broker"), true);
});

test("connector readiness treats tenant-vault broker URL and token names as broker-managed execution", () => {
  const readiness = getEnterpriseConnectorReadiness({}, [" mcp_broker_url ", "mcp_broker_token"]);

  assert.equal(readiness.brokerConfigured, true);
  assert.equal(readiness.brokerUrlConfigured, true);
  assert.equal(readiness.brokerAuthenticated, true);
  assert.equal(readiness.brokerMode, "mcp-broker");
  assert.equal(readiness.productionReady, true);
  assert.equal(readiness.connectors.every((connector) => connector.executionMode === "external-broker"), true);
});

test("connector readiness canonicalizes native tenant-vault secret names", () => {
  const readiness = getEnterpriseConnectorReadiness({}, [
    " slack_bot_token ",
    "slack_signing_secret",
    "SLACK_BOT_TOKEN=xoxb-sensitive1234567890",
    "person@example.com",
  ]);
  const slack = readiness.connectors.find((connector) => connector.id === "slack");
  const serialized = JSON.stringify(readiness);

  assert.equal(slack?.status, "ready");
  assert.deepEqual(slack?.missingSecrets, []);
  assert.equal(serialized.includes("xoxb-sensitive"), false);
  assert.equal(serialized.includes("person@example.com"), false);
});

test("connector readiness does not treat broker configuration as proof of connector smoke tests", () => {
  const readiness = getEnterpriseConnectorReadiness({
    MCP_BROKER_URL: "https://broker.example.com",
    MCP_BROKER_TOKEN: "broker-token",
  }, []);
  const slack = readiness.connectors.find((connector) => connector.id === "slack");

  assert.equal(slack?.status, "broker-managed");
  assert.equal(slack?.activationChecklist.find((item) => item.id === "integration-app")?.status, "complete");
  assert.equal(slack?.activationChecklist.find((item) => item.id === "secret-route")?.status, "complete");
  assert.equal(slack?.activationChecklist.find((item) => item.id === "read-test")?.status, "pending");
  assert.equal(slack?.activationChecklist.find((item) => item.id === "action-gate")?.status, "pending");
  assert.equal(slack?.activationChecklist.find((item) => item.id === "evidence")?.status, "pending");
  assert.match(slack?.nextActivationAction ?? "", /read-only connector smoke/);
});

test("connector readiness treats broker URL without token as incomplete", () => {
  const readiness = getEnterpriseConnectorReadiness({ MCP_BROKER_URL: "https://broker.example.com" }, []);
  const slack = readiness.connectors.find((connector) => connector.id === "slack");

  assert.equal(readiness.brokerConfigured, false);
  assert.equal(readiness.brokerUrlConfigured, true);
  assert.equal(readiness.brokerAuthenticated, false);
  assert.deepEqual(readiness.brokerMissingSecretNames, ["MCP_BROKER_TOKEN", "CONNECTOR_BROKER_TOKEN"]);
  assert.equal(readiness.productionReady, false);
  assert.equal(slack?.status, "missing");
  assert.equal(slack?.activationChecklist.find((item) => item.id === "integration-app")?.status, "complete");
  assert.equal(slack?.activationChecklist.find((item) => item.id === "secret-route")?.status, "pending");
  assert.match(slack?.nextActivationAction ?? "", /authentication is missing/i);
});

test("connector readiness ignores malformed broker runtime URLs", () => {
  const readiness = getEnterpriseConnectorReadiness({
    MCP_BROKER_URL: "http://broker.example.com",
    MCP_BROKER_TOKEN: "broker-token",
    CONNECTOR_BROKER_URL: "not-a-url",
    CONNECTOR_BROKER_TOKEN: "connector-token",
  }, []);
  const slack = readiness.connectors.find((connector) => connector.id === "slack");

  assert.equal(readiness.brokerConfigured, false);
  assert.equal(readiness.brokerUrlConfigured, false);
  assert.equal(readiness.brokerAuthenticated, false);
  assert.equal(readiness.brokerMode, "policy-only");
  assert.equal(readiness.productionReady, false);
  assert.equal(slack?.status, "missing");
});

test("connector readiness detects native tenant-vault secrets without exposing values", () => {
  const readiness = getEnterpriseConnectorReadiness({}, [
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "JIRA_BASE_URL",
    "JIRA_EMAIL",
    "JIRA_API_TOKEN",
  ]);
  const slack = readiness.connectors.find((connector) => connector.id === "slack");
  const jira = readiness.connectors.find((connector) => connector.id === "jira");
  const workday = readiness.connectors.find((connector) => connector.id === "workday");

  assert.equal(slack?.status, "ready");
  assert.equal(jira?.status, "ready");
  assert.equal(workday?.status, "missing");
  assert.equal(readiness.productionReady, true);
  assert.deepEqual(slack?.missingSecrets, []);
});

test("connector readiness ignores malformed native runtime connection fields", () => {
  const readiness = getEnterpriseConnectorReadiness({
    JIRA_BASE_URL: "not-a-url",
    JIRA_EMAIL: "not-email",
    JIRA_API_TOKEN: "jira-token",
  }, []);
  const jira = readiness.connectors.find((connector) => connector.id === "jira");

  assert.equal(jira?.status, "partial");
  assert.deepEqual(jira?.configuredSecrets, ["JIRA_API_TOKEN"]);
  assert.deepEqual(jira?.missingSecrets, ["JIRA_BASE_URL", "JIRA_EMAIL"]);
  assert.equal(readiness.productionReady, false);
});

test("connector readiness keeps native connector proof pending until smoke evidence flags are present", () => {
  const withoutProof = getEnterpriseConnectorReadiness({}, ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"]);
  const untestedSlack = withoutProof.connectors.find((connector) => connector.id === "slack");

  assert.equal(untestedSlack?.status, "ready");
  assert.equal(untestedSlack?.activationChecklist.find((item) => item.id === "read-test")?.status, "pending");
  assert.equal(untestedSlack?.activationChecklist.find((item) => item.id === "action-gate")?.status, "pending");
  assert.equal(untestedSlack?.activationChecklist.find((item) => item.id === "evidence")?.status, "pending");

  const withProof = getEnterpriseConnectorReadiness(
    {
      CONNECTOR_SLACK_READ_TESTED: "true",
      CONNECTOR_SLACK_ACTION_GATE_TESTED: "true",
      CONNECTOR_SLACK_EVIDENCE_TESTED: "true",
    },
    ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
  );
  const testedSlack = withProof.connectors.find((connector) => connector.id === "slack");

  assert.equal(testedSlack?.activationChecklist.every((item) => item.status === "complete"), true);
  assert.match(testedSlack?.nextActivationAction ?? "", /complete/);
});

test("connector readiness tracks optional secrets without making them required", () => {
  const readiness = getEnterpriseConnectorReadiness({}, [
    "GOOGLE_WORKSPACE_CLIENT_ID",
    "GOOGLE_WORKSPACE_CLIENT_SECRET",
    "GOOGLE_WORKSPACE_DELEGATED_ADMIN",
  ]);
  const googleWorkspace = readiness.connectors.find((connector) => connector.id === "google_workspace");

  assert.equal(googleWorkspace?.status, "ready");
  assert.equal(googleWorkspace?.missingSecrets.length, 0);
  assert.equal(googleWorkspace?.configuredSecrets.includes("GOOGLE_WORKSPACE_DELEGATED_ADMIN"), true);
});
