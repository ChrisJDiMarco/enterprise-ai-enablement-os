import { test } from "node:test";
import assert from "node:assert/strict";

import { executeConnectorRequest } from "../src/lib/connector-broker.ts";
import type { Skill, Tool } from "../src/lib/enterprise-ai-data.ts";

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-broker-test",
    name: "Broker Test Skill",
    slug: "broker-test-skill",
    description: "Tests connector broker execution boundaries.",
    department: "Operations",
    ownerId: "user-1",
    status: "production",
    version: "1.0.0",
    riskLevel: "low",
    autonomyTier: "tier_3_execute_bounded_action",
    modelProvider: "local",
    model: "local-enterprise-reasoner",
    temperature: 0.2,
    maxTokens: 1000,
    fallbackModel: "local",
    costLimit: 0.1,
    systemPrompt: "Use tools only when approved.",
    allowedTools: [],
    blockedTools: [],
    contextSources: [],
    evalPassRate: 92,
    adoptionCount: 0,
    valueDelivered: 0,
    runs: 0,
    updatedAt: "2026-06-01",
    ...overrides,
  };
}

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: "custom.execute_task",
    displayName: "Execute Task",
    description: "A bounded connector task.",
    category: "custom",
    actionType: "execute",
    riskLevel: "medium",
    requiresApprovalByDefault: false,
    enabled: true,
    usage: 0,
    lastUsed: "2026-06-01",
    ...overrides,
  };
}

test("executeConnectorRequest blocks policy violations before any broker execution", async () => {
  const tool = makeTool({ id: "slack.chat_post_message", actionType: "create" });
  const result = await executeConnectorRequest({
    request: {
      organizationId: "org-test",
      skill: makeSkill({ allowedTools: [] }),
      toolId: tool.id,
      payload: { channel: "C123", text: "hello" },
      approved: true,
    },
    tools: [tool],
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.brokerMode, "policy-only");
  assert.match(result.decision.reason, /does not allow/i);
});

test("executeConnectorRequest pauses approval-gated tools until a human approves", async () => {
  const tool = makeTool({ actionType: "create", requiresApprovalByDefault: true });
  const result = await executeConnectorRequest({
    request: {
      organizationId: "org-test",
      skill: makeSkill({ allowedTools: [tool.id] }),
      toolId: tool.id,
      payload: { summary: "Create bounded task" },
      approved: false,
    },
    tools: [tool],
  });

  assert.equal(result.status, "requires_approval");
  assert.equal(result.decision.status, "requires_approval");
  assert.match(String(result.output.message), /Approval required/i);
});

test("executeConnectorRequest sends approved requests to an external MCP broker envelope", async () => {
  const originalFetch = globalThis.fetch;
  const previousBrokerUrl = process.env.MCP_BROKER_URL;
  const previousBrokerToken = process.env.CONNECTOR_BROKER_TOKEN;
  const tool = makeTool({ actionType: "read", riskLevel: "low" });
  let capturedBody = "";
  let capturedAuthorization = "";

  process.env.MCP_BROKER_URL = "https://broker.example";
  process.env.CONNECTOR_BROKER_TOKEN = "test-token";
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = String(init?.body ?? "");
    capturedAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
    return new Response(JSON.stringify({ ok: true, brokerRunId: "broker-run-1" }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await executeConnectorRequest({
      request: {
        organizationId: "org-test",
        skill: makeSkill({ allowedTools: [tool.id] }),
        toolId: tool.id,
        payload: { query: "status" },
        approved: true,
      },
      tools: [tool],
    });

    const envelope = JSON.parse(capturedBody) as { schema?: string; policyDecision?: { status?: string }; toolId?: string };
    assert.equal(result.status, "executed");
    assert.equal(result.brokerMode, "external");
    assert.equal(capturedAuthorization, "Bearer test-token");
    assert.equal(envelope.schema, "enterprise-ai-enablement-os.connector-execution-request.v1");
    assert.equal(envelope.toolId, tool.id);
    assert.equal(envelope.policyDecision?.status, "approved");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousBrokerUrl;
    if (previousBrokerToken === undefined) delete process.env.CONNECTOR_BROKER_TOKEN;
    else process.env.CONNECTOR_BROKER_TOKEN = previousBrokerToken;
  }
});

test("executeConnectorRequest fails closed when the external broker is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const previousBrokerUrl = process.env.MCP_BROKER_URL;
  const previousTimeout = process.env.CONNECTOR_BROKER_TIMEOUT_MS;
  const tool = makeTool({ actionType: "read", riskLevel: "low" });

  process.env.MCP_BROKER_URL = "https://broker.example";
  process.env.CONNECTOR_BROKER_TIMEOUT_MS = "10";
  globalThis.fetch = (async () => {
    throw new Error("network offline");
  }) as typeof fetch;

  try {
    const result = await executeConnectorRequest({
      request: {
        organizationId: "org-test",
        skill: makeSkill({ allowedTools: [tool.id] }),
        toolId: tool.id,
        payload: { query: "status" },
        approved: true,
      },
      tools: [tool],
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.brokerMode, "external");
    assert.match(result.decision.reason, /External broker unavailable/i);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousBrokerUrl;
    if (previousTimeout === undefined) delete process.env.CONNECTOR_BROKER_TIMEOUT_MS;
    else process.env.CONNECTOR_BROKER_TIMEOUT_MS = previousTimeout;
  }
});

test("executeConnectorRequest makes policy-only fallback explicit for unhandled connectors", async () => {
  const tool = makeTool({ actionType: "read", riskLevel: "low", requiresApprovalByDefault: false });
  const result = await executeConnectorRequest({
    request: {
      organizationId: "org-test",
      skill: makeSkill({ allowedTools: [tool.id] }),
      toolId: tool.id,
      payload: { path: "/ops/status" },
      approved: true,
    },
    tools: [tool],
  });

  assert.equal(result.status, "executed");
  assert.equal(result.brokerMode, "policy-only");
  assert.equal(result.output.simulated, true);
  assert.match(String(result.output.message), /policy-only/i);
});
