import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveConnectorPosture } from "../src/lib/enterprise-operating-intelligence.ts";
import type { ProductionReadiness } from "../src/lib/ui/types.ts";

type ConnectorCatalog = NonNullable<NonNullable<ProductionReadiness["connectors"]>["catalog"]>;

function readinessWithConnectors(connectors: ConnectorCatalog["connectors"]): ProductionReadiness {
  const readyCount = connectors.filter((connector) => ["ready", "broker-managed"].includes(connector.status)).length;
  const partialCount = connectors.filter((connector) => connector.status === "partial").length;
  const missingCount = connectors.filter((connector) => connector.status === "missing").length;

  return {
    status: "degraded",
    connectors: {
      configured: readyCount > 0,
      mode: "native-secrets",
      catalog: {
        brokerConfigured: false,
        brokerMode: "policy-only",
        readyCount,
        partialCount,
        missingCount,
        requiredCount: connectors.length,
        productionReady: readyCount > 0,
        connectors,
      },
    },
  };
}

test("deriveConnectorPosture separates saved connector credentials from launch proof", () => {
  const posture = deriveConnectorPosture({
    productionReadiness: readinessWithConnectors([
      {
        id: "slack",
        label: "Slack",
        system: "Slack Enterprise Grid",
        category: "collaboration",
        status: "ready",
        executionMode: "native-secrets",
        requiredSecretNames: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
        configuredSecrets: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
        missingSecrets: [],
        requiredScopes: ["channels:read"],
        capabilities: ["Signal ingestion"],
        productionUse: "Capture work signals.",
        setupAction: "Create a Slack app.",
        activationChecklist: [
          { id: "integration-app", label: "Create integration app", status: "complete", owner: "Customer Admin", action: "Slack app created." },
          { id: "secret-route", label: "Store secrets", status: "complete", owner: "Security", action: "Secrets stored." },
          { id: "read-test", label: "Test approved read path", status: "complete", owner: "Integrations", action: "Read test passed." },
          { id: "action-gate", label: "Test write/action approval gate", status: "pending", owner: "Governance", action: "Trigger an approval-gated Slack send." },
          { id: "evidence", label: "Capture evidence ledger event", status: "pending", owner: "Governance", action: "Attach Slack response metadata." },
        ],
      },
    ]),
  });

  assert.equal(posture.readyCount, 1);
  assert.equal(posture.launchReadyCount, 0);
  assert.equal(posture.readTestReadyCount, 1);
  assert.equal(posture.actionGateReadyCount, 0);
  assert.equal(posture.evidenceReadyCount, 0);
  assert.equal(posture.status, "partial");
  assert.deepEqual(posture.proofGaps, ["Slack: Test write/action approval gate"]);
  assert.match(posture.nextAction, /Prove Slack/);
  assert.match(posture.summary, /1\/1 connectors ready/);
  assert.match(posture.summary, /0\/1 have complete launch proof/);
});

test("deriveConnectorPosture marks connectors ready only when activation proof is complete", () => {
  const posture = deriveConnectorPosture({
    productionReadiness: readinessWithConnectors([
      {
        id: "jira",
        label: "Jira",
        system: "Atlassian Jira",
        category: "ticketing",
        status: "ready",
        executionMode: "native-secrets",
        requiredSecretNames: ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
        configuredSecrets: ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
        missingSecrets: [],
        requiredScopes: ["read:jira-work"],
        capabilities: ["Ticket creation"],
        productionUse: "Route approved work.",
        setupAction: "Create an Atlassian token.",
        activationChecklist: [
          { id: "integration-app", label: "Create integration app", status: "complete", owner: "Customer Admin", action: "App created." },
          { id: "secret-route", label: "Store secrets", status: "complete", owner: "Security", action: "Secrets stored." },
          { id: "read-test", label: "Test approved read path", status: "complete", owner: "Integrations", action: "Read test passed." },
          { id: "action-gate", label: "Test write/action approval gate", status: "complete", owner: "Governance", action: "Gate tested." },
          { id: "evidence", label: "Capture evidence ledger event", status: "complete", owner: "Governance", action: "Evidence attached." },
        ],
      },
    ]),
  });

  assert.equal(posture.status, "ready");
  assert.equal(posture.launchReadyCount, 1);
  assert.equal(posture.evidenceReadyCount, 1);
  assert.deepEqual(posture.proofGaps, []);
  assert.match(posture.nextAction, /launch-ready/);
});
