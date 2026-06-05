import { test } from "node:test";
import assert from "node:assert/strict";
import { getEnterpriseConnectorReadiness } from "../src/lib/enterprise-connectors.ts";

test("connector readiness treats an external MCP broker as broker-managed execution", () => {
  const readiness = getEnterpriseConnectorReadiness({ MCP_BROKER_URL: "https://broker.example.com" }, []);

  assert.equal(readiness.brokerConfigured, true);
  assert.equal(readiness.brokerMode, "mcp-broker");
  assert.equal(readiness.productionReady, true);
  assert.equal(readiness.connectors.every((connector) => connector.executionMode === "external-broker"), true);
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
