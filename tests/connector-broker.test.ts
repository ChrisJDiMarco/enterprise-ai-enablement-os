import { test } from "node:test";
import assert from "node:assert/strict";

import { executeConnectorRequest } from "../src/lib/connector-broker.ts";
import { connectorEvidenceFreshness, normalizeConnectorEvent, summarizeConnectorEvents } from "../src/lib/connector-events.ts";
import type { ConnectorEvent } from "../src/lib/connector-events.ts";
import type { Skill, Tool } from "../src/lib/enterprise-ai-data.ts";
import { deleteTenantSecrets, upsertTenantSecrets } from "../src/lib/tenant-secret-vault.ts";

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
  const previousBrokerToken = process.env.MCP_BROKER_TOKEN;
  const tool = makeTool({ actionType: "read", riskLevel: "low" });
  let capturedUrl = "";
  let capturedBody = "";
  let capturedAuthorization = "";
  let capturedIdempotencyKey = "";

  process.env.MCP_BROKER_URL = "https://broker.example/api/execute";
  process.env.MCP_BROKER_TOKEN = "test-token";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedBody = String(init?.body ?? "");
    capturedAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
    capturedIdempotencyKey = String((init?.headers as Record<string, string> | undefined)?.["X-EAIEOS-Idempotency-Key"] ?? "");
    return new Response(
      JSON.stringify({
        ok: true,
        brokerRunId: "broker-run-1",
        contact: "person@example.com",
        accessToken: "SECRET_TOKEN_123456789012",
      }),
      { status: 200 },
    );
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

    const envelope = JSON.parse(capturedBody) as {
      schema?: string;
      policyDecision?: { status?: string };
      toolId?: string;
      executionEnvelope?: { schema?: string; payloadDigest?: string; idempotencyKey?: string };
    };
    assert.equal(result.status, "executed");
    assert.equal(result.brokerMode, "external");
    assert.equal(capturedUrl, "https://broker.example/api/execute");
    assert.equal(capturedAuthorization, "Bearer test-token");
    assert.equal(capturedIdempotencyKey.length > 20, true);
    assert.equal(envelope.schema, "enterprise-ai-enablement-os.connector-execution-request.v1");
    assert.equal(envelope.toolId, tool.id);
    assert.equal(envelope.policyDecision?.status, "approved");
    assert.equal(envelope.executionEnvelope?.schema, "enterprise-ai-enablement-os.connector-execution-envelope.v1");
    assert.equal(envelope.executionEnvelope?.payloadDigest?.startsWith("sha256:"), true);
    assert.equal(envelope.executionEnvelope?.idempotencyKey, capturedIdempotencyKey);
    assert.equal(result.output.brokerRunId, "broker-run-1");
    assert.equal(JSON.stringify(result.output).includes("person@example.com"), false);
    assert.equal(JSON.stringify(result.output).includes("SECRET_TOKEN"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousBrokerUrl;
    if (previousBrokerToken === undefined) delete process.env.MCP_BROKER_TOKEN;
    else process.env.MCP_BROKER_TOKEN = previousBrokerToken;
  }
});

test("executeConnectorRequest uses tenant-vault broker URL and token for external execution", async () => {
  const originalFetch = globalThis.fetch;
  const previousMcpBrokerUrl = process.env.MCP_BROKER_URL;
  const previousMcpBrokerToken = process.env.MCP_BROKER_TOKEN;
  const previousConnectorBrokerUrl = process.env.CONNECTOR_BROKER_URL;
  const previousConnectorBrokerToken = process.env.CONNECTOR_BROKER_TOKEN;
  const organizationId = "org-test-tenant-broker";
  const brokerSecretNames = [
    "MCP_BROKER_URL",
    "MCP_BROKER_TOKEN",
    "CONNECTOR_BROKER_URL",
    "CONNECTOR_BROKER_TOKEN",
  ];
  const tool = makeTool({ actionType: "read", riskLevel: "low" });
  let capturedUrl = "";
  let capturedAuthorization = "";

  delete process.env.MCP_BROKER_URL;
  delete process.env.MCP_BROKER_TOKEN;
  delete process.env.CONNECTOR_BROKER_URL;
  delete process.env.CONNECTOR_BROKER_TOKEN;
  await deleteTenantSecrets(organizationId, brokerSecretNames);
  await upsertTenantSecrets(organizationId, {
    MCP_BROKER_URL: "https://tenant-broker.example",
    MCP_BROKER_TOKEN: "tenant-broker-token",
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
    return new Response(JSON.stringify({ ok: true, brokerRunId: "tenant-broker-run" }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await executeConnectorRequest({
      request: {
        organizationId,
        skill: makeSkill({ allowedTools: [tool.id] }),
        toolId: tool.id,
        payload: { query: "tenant broker status" },
        approved: true,
      },
      tools: [tool],
    });

    assert.equal(result.status, "executed");
    assert.equal(result.brokerMode, "external");
    assert.equal(capturedUrl, "https://tenant-broker.example/execute");
    assert.equal(capturedAuthorization, "Bearer tenant-broker-token");
    assert.equal(result.output.brokerRunId, "tenant-broker-run");
  } finally {
    globalThis.fetch = originalFetch;
    await deleteTenantSecrets(organizationId, brokerSecretNames);
    if (previousMcpBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousMcpBrokerUrl;
    if (previousMcpBrokerToken === undefined) delete process.env.MCP_BROKER_TOKEN;
    else process.env.MCP_BROKER_TOKEN = previousMcpBrokerToken;
    if (previousConnectorBrokerUrl === undefined) delete process.env.CONNECTOR_BROKER_URL;
    else process.env.CONNECTOR_BROKER_URL = previousConnectorBrokerUrl;
    if (previousConnectorBrokerToken === undefined) delete process.env.CONNECTOR_BROKER_TOKEN;
    else process.env.CONNECTOR_BROKER_TOKEN = previousConnectorBrokerToken;
  }
});

test("executeConnectorRequest lets tenant-vault broker settings override malformed global env fallbacks", async () => {
  const originalFetch = globalThis.fetch;
  const previousMcpBrokerUrl = process.env.MCP_BROKER_URL;
  const previousMcpBrokerToken = process.env.MCP_BROKER_TOKEN;
  const previousConnectorBrokerUrl = process.env.CONNECTOR_BROKER_URL;
  const previousConnectorBrokerToken = process.env.CONNECTOR_BROKER_TOKEN;
  const organizationId = "org-test-tenant-broker-override";
  const brokerSecretNames = [
    "MCP_BROKER_URL",
    "MCP_BROKER_TOKEN",
    "CONNECTOR_BROKER_URL",
    "CONNECTOR_BROKER_TOKEN",
  ];
  const tool = makeTool({ actionType: "read", riskLevel: "low" });
  let capturedUrl = "";
  let capturedAuthorization = "";

  process.env.MCP_BROKER_URL = "http://broken-broker.example";
  process.env.MCP_BROKER_TOKEN = "broken-global-token";
  delete process.env.CONNECTOR_BROKER_URL;
  delete process.env.CONNECTOR_BROKER_TOKEN;
  await deleteTenantSecrets(organizationId, brokerSecretNames);
  await upsertTenantSecrets(organizationId, {
    MCP_BROKER_URL: "https://tenant-broker.example",
    MCP_BROKER_TOKEN: "tenant-broker-token",
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
    return new Response(JSON.stringify({ ok: true, brokerRunId: "tenant-broker-run" }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await executeConnectorRequest({
      request: {
        organizationId,
        skill: makeSkill({ allowedTools: [tool.id] }),
        toolId: tool.id,
        payload: { query: "tenant broker status" },
        approved: true,
      },
      tools: [tool],
    });

    assert.equal(result.status, "executed");
    assert.equal(result.brokerMode, "external");
    assert.equal(capturedUrl, "https://tenant-broker.example/execute");
    assert.equal(capturedAuthorization, "Bearer tenant-broker-token");
    assert.equal(JSON.stringify(result).includes("broken-global-token"), false);
  } finally {
    globalThis.fetch = originalFetch;
    await deleteTenantSecrets(organizationId, brokerSecretNames);
    if (previousMcpBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousMcpBrokerUrl;
    if (previousMcpBrokerToken === undefined) delete process.env.MCP_BROKER_TOKEN;
    else process.env.MCP_BROKER_TOKEN = previousMcpBrokerToken;
    if (previousConnectorBrokerUrl === undefined) delete process.env.CONNECTOR_BROKER_URL;
    else process.env.CONNECTOR_BROKER_URL = previousConnectorBrokerUrl;
    if (previousConnectorBrokerToken === undefined) delete process.env.CONNECTOR_BROKER_TOKEN;
    else process.env.CONNECTOR_BROKER_TOKEN = previousConnectorBrokerToken;
  }
});

test("executeConnectorRequest blocks external broker execution when broker token is missing", async () => {
  const originalFetch = globalThis.fetch;
  const previousBrokerUrl = process.env.MCP_BROKER_URL;
  const previousMcpToken = process.env.MCP_BROKER_TOKEN;
  const previousConnectorBrokerToken = process.env.CONNECTOR_BROKER_TOKEN;
  const tool = makeTool({ actionType: "read", riskLevel: "low" });
  let fetchCalled = false;

  process.env.MCP_BROKER_URL = "https://broker.example";
  delete process.env.MCP_BROKER_TOKEN;
  delete process.env.CONNECTOR_BROKER_TOKEN;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
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
    assert.equal(fetchCalled, false);
    assert.match(result.decision.reason, /MCP_BROKER_TOKEN|CONNECTOR_BROKER_TOKEN/i);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousBrokerUrl;
    if (previousMcpToken === undefined) delete process.env.MCP_BROKER_TOKEN;
    else process.env.MCP_BROKER_TOKEN = previousMcpToken;
    if (previousConnectorBrokerToken === undefined) delete process.env.CONNECTOR_BROKER_TOKEN;
    else process.env.CONNECTOR_BROKER_TOKEN = previousConnectorBrokerToken;
  }
});

test("executeConnectorRequest blocks malformed external broker URLs before fetch", async () => {
  const originalFetch = globalThis.fetch;
  const previousMcpBrokerUrl = process.env.MCP_BROKER_URL;
  const previousMcpBrokerToken = process.env.MCP_BROKER_TOKEN;
  const previousConnectorBrokerUrl = process.env.CONNECTOR_BROKER_URL;
  const previousConnectorBrokerToken = process.env.CONNECTOR_BROKER_TOKEN;
  const organizationId = "org-test-invalid-broker";
  const brokerSecretNames = [
    "MCP_BROKER_URL",
    "MCP_BROKER_TOKEN",
    "CONNECTOR_BROKER_URL",
    "CONNECTOR_BROKER_TOKEN",
  ];
  const tool = makeTool({ actionType: "read", riskLevel: "low" });
  let fetchCalled = false;

  await deleteTenantSecrets(organizationId, brokerSecretNames);
  process.env.MCP_BROKER_URL = "http://broker.example";
  process.env.MCP_BROKER_TOKEN = "test-token";
  delete process.env.CONNECTOR_BROKER_URL;
  delete process.env.CONNECTOR_BROKER_TOKEN;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await executeConnectorRequest({
      request: {
        organizationId,
        skill: makeSkill({ allowedTools: [tool.id] }),
        toolId: tool.id,
        payload: { query: "status" },
        approved: true,
      },
      tools: [tool],
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.brokerMode, "external");
    assert.equal(fetchCalled, false);
    assert.equal(result.output.invalidSecret, "MCP_BROKER_URL");
    assert.match(result.decision.reason, /configuration is invalid/i);
    assert.match(result.decision.reason, /HTTPS/i);
    assert.equal(JSON.stringify(result).includes("test-token"), false);
  } finally {
    globalThis.fetch = originalFetch;
    await deleteTenantSecrets(organizationId, brokerSecretNames);
    if (previousMcpBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousMcpBrokerUrl;
    if (previousMcpBrokerToken === undefined) delete process.env.MCP_BROKER_TOKEN;
    else process.env.MCP_BROKER_TOKEN = previousMcpBrokerToken;
    if (previousConnectorBrokerUrl === undefined) delete process.env.CONNECTOR_BROKER_URL;
    else process.env.CONNECTOR_BROKER_URL = previousConnectorBrokerUrl;
    if (previousConnectorBrokerToken === undefined) delete process.env.CONNECTOR_BROKER_TOKEN;
    else process.env.CONNECTOR_BROKER_TOKEN = previousConnectorBrokerToken;
  }
});

test("executeConnectorRequest blocks malformed native connector secrets before fetch", async () => {
  const originalFetch = globalThis.fetch;
  const previousMcpBrokerUrl = process.env.MCP_BROKER_URL;
  const previousConnectorBrokerUrl = process.env.CONNECTOR_BROKER_URL;
  const previousJiraBaseUrl = process.env.JIRA_BASE_URL;
  const previousJiraEmail = process.env.JIRA_EMAIL;
  const previousJiraApiToken = process.env.JIRA_API_TOKEN;
  const organizationId = "org-test-invalid-native-secrets";
  const tool = makeTool({ id: "jira.issue_read", actionType: "read", riskLevel: "low" });
  let fetchCalled = false;

  await deleteTenantSecrets(organizationId, ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"]);
  delete process.env.MCP_BROKER_URL;
  delete process.env.CONNECTOR_BROKER_URL;
  process.env.JIRA_BASE_URL = "not-a-url";
  process.env.JIRA_EMAIL = "not-an-email";
  process.env.JIRA_API_TOKEN = "jira-token";
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await executeConnectorRequest({
      request: {
        organizationId,
        skill: makeSkill({ allowedTools: [tool.id] }),
        toolId: tool.id,
        payload: { issueKey: "EAIEOS-1" },
        approved: true,
      },
      tools: [tool],
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.brokerMode, "native");
    assert.equal(result.output.connectorId, "jira");
    assert.equal(fetchCalled, false);
    assert.match(result.decision.reason, /JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN are required/i);
  } finally {
    globalThis.fetch = originalFetch;
    await deleteTenantSecrets(organizationId, ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"]);
    if (previousMcpBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousMcpBrokerUrl;
    if (previousConnectorBrokerUrl === undefined) delete process.env.CONNECTOR_BROKER_URL;
    else process.env.CONNECTOR_BROKER_URL = previousConnectorBrokerUrl;
    if (previousJiraBaseUrl === undefined) delete process.env.JIRA_BASE_URL;
    else process.env.JIRA_BASE_URL = previousJiraBaseUrl;
    if (previousJiraEmail === undefined) delete process.env.JIRA_EMAIL;
    else process.env.JIRA_EMAIL = previousJiraEmail;
    if (previousJiraApiToken === undefined) delete process.env.JIRA_API_TOKEN;
    else process.env.JIRA_API_TOKEN = previousJiraApiToken;
  }
});

test("executeConnectorRequest redacts successful native connector output before returning it", async () => {
  const originalFetch = globalThis.fetch;
  const previousSlackToken = process.env.SLACK_BOT_TOKEN;
  const previousBrokerUrl = process.env.MCP_BROKER_URL;
  const previousConnectorBrokerUrl = process.env.CONNECTOR_BROKER_URL;
  const tool = makeTool({ id: "slack.chat_post_message", actionType: "create", riskLevel: "medium" });

  delete process.env.MCP_BROKER_URL;
  delete process.env.CONNECTOR_BROKER_URL;
  process.env.SLACK_BOT_TOKEN = "xoxb-native-test-token";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: true,
        ts: "1710000000.0001",
        message: { userEmail: "person@example.com", text: "posted" },
        botToken: "xoxb-leaked-token-value",
      }),
      { status: 200 },
    )) as typeof fetch;

  try {
    const result = await executeConnectorRequest({
      request: {
        organizationId: "org-test",
        skill: makeSkill({ allowedTools: [tool.id] }),
        toolId: tool.id,
        payload: { channel: "C123", text: "hello" },
        approved: true,
      },
      tools: [tool],
    });

    const serializedOutput = JSON.stringify(result.output);
    assert.equal(result.status, "executed");
    assert.equal(result.brokerMode, "native");
    assert.equal(result.output.connectorId, "slack");
    assert.equal(serializedOutput.includes("person@example.com"), false);
    assert.equal(serializedOutput.includes("xoxb-leaked-token-value"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousSlackToken === undefined) delete process.env.SLACK_BOT_TOKEN;
    else process.env.SLACK_BOT_TOKEN = previousSlackToken;
    if (previousBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousBrokerUrl;
    if (previousConnectorBrokerUrl === undefined) delete process.env.CONNECTOR_BROKER_URL;
    else process.env.CONNECTOR_BROKER_URL = previousConnectorBrokerUrl;
  }
});

test("executeConnectorRequest fails closed when the external broker is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const previousBrokerUrl = process.env.MCP_BROKER_URL;
  const previousBrokerToken = process.env.MCP_BROKER_TOKEN;
  const previousTimeout = process.env.CONNECTOR_BROKER_TIMEOUT_MS;
  const tool = makeTool({ actionType: "read", riskLevel: "low" });

  process.env.MCP_BROKER_URL = "https://broker.example";
  process.env.MCP_BROKER_TOKEN = "test-token";
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
    assert.match(result.decision.reason, /External connector broker is unavailable/i);
    assert.equal(JSON.stringify(result).includes("network offline"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousBrokerUrl;
    if (previousBrokerToken === undefined) delete process.env.MCP_BROKER_TOKEN;
    else process.env.MCP_BROKER_TOKEN = previousBrokerToken;
    if (previousTimeout === undefined) delete process.env.CONNECTOR_BROKER_TIMEOUT_MS;
    else process.env.CONNECTOR_BROKER_TIMEOUT_MS = previousTimeout;
  }
});

test("executeConnectorRequest redacts rejected external broker response bodies", async () => {
  const originalFetch = globalThis.fetch;
  const previousBrokerUrl = process.env.MCP_BROKER_URL;
  const previousBrokerToken = process.env.MCP_BROKER_TOKEN;
  const tool = makeTool({ actionType: "read", riskLevel: "low" });

  process.env.MCP_BROKER_URL = "https://broker.example";
  process.env.MCP_BROKER_TOKEN = "test-token";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        error: "postgres://user:password@db.internal failed with SECRET_TOKEN",
        message: "broker stack trace",
      }),
      { status: 502 },
    )) as typeof fetch;

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

    const serialized = JSON.stringify(result);
    assert.equal(result.status, "blocked");
    assert.equal(result.brokerMode, "external");
    assert.match(result.decision.reason, /External connector broker is unavailable or returned an error/i);
    assert.equal(serialized.includes("postgres://"), false);
    assert.equal(serialized.includes("SECRET_TOKEN"), false);
    assert.equal(serialized.includes("stack trace"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousBrokerUrl;
    if (previousBrokerToken === undefined) delete process.env.MCP_BROKER_TOKEN;
    else process.env.MCP_BROKER_TOKEN = previousBrokerToken;
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

  assert.equal(result.status, "simulated");
  assert.equal(result.brokerMode, "policy-only");
  assert.equal(result.output.simulated, true);
  assert.equal(String(result.output.payloadDigest).startsWith("sha256:"), true);
  assert.equal(result.envelope.payloadPreview.path, "/ops/status");
  assert.match(String(result.output.message), /policy-only/i);
});

test("executeConnectorRequest fails closed in production for unhandled connectors", async () => {
  const tool = makeTool({ actionType: "read", riskLevel: "low", requiresApprovalByDefault: false });
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOverride = process.env.ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION;
    const blocked = await executeConnectorRequest({
      request: {
        organizationId: "org-test",
        skill: makeSkill({ allowedTools: [tool.id] }),
        toolId: tool.id,
        payload: { path: "/ops/status" },
        approved: true,
      },
      tools: [tool],
    });
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.output.simulated, false);
    assert.notEqual(blocked.decision.status, "approved");

    // Explicit opt-in restores rehearsal mode.
    process.env.ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION = "true";
    const simulated = await executeConnectorRequest({
      request: {
        organizationId: "org-test",
        skill: makeSkill({ allowedTools: [tool.id] }),
        toolId: tool.id,
        payload: { path: "/ops/status" },
        approved: true,
      },
      tools: [tool],
    });
    assert.equal(simulated.status, "simulated");
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousOverride === undefined) delete process.env.ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION;
    else process.env.ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION = previousOverride;
  }
});

test("executeConnectorRequest returns redacted evidence envelope without leaking raw payload secrets", async () => {
  const tool = makeTool({ actionType: "read", riskLevel: "low", requiresApprovalByDefault: false });
  const result = await executeConnectorRequest({
    request: {
      organizationId: "org-test",
      skill: makeSkill({ allowedTools: [tool.id] }),
      toolId: tool.id,
      payload: {
        method: "GET",
        path: "/ops/status",
        query: "status for Jane Doe payroll escalation",
        customerEmail: "person@example.com",
        nested: {
          ticketId: "INC-1234",
          note: "Jane Doe payroll escalation should never persist in evidence previews.",
        },
      },
      approved: true,
      actor: "Security Reviewer",
      idempotencyKey: "manual-idempotency-key",
    },
    tools: [tool],
  });

  const serialized = JSON.stringify(result.envelope);
  assert.equal(result.envelope.idempotencyKey, "manual-idempotency-key");
  assert.equal(result.envelope.actor, "Security Reviewer");
  assert.equal(result.envelope.payloadPreview.method, "GET");
  assert.equal(result.envelope.payloadPreview.path, "/ops/status");
  assert.equal(result.envelope.payloadPreview.query, "[redacted]");
  assert.equal((result.envelope.payloadPreview.nested as Record<string, unknown>).ticketId, "INC-1234");
  assert.equal((result.envelope.payloadPreview.nested as Record<string, unknown>).note, "[redacted]");
  assert.equal(serialized.includes("person@example.com"), false);
  assert.equal(serialized.includes("Jane Doe"), false);
  assert.equal(serialized.includes("payroll escalation"), false);
  assert.equal(result.envelope.payloadDigest.startsWith("sha256:"), true);
});

test("executeConnectorRequest blocks credential material before connector execution", async () => {
  const tool = makeTool({ actionType: "read", riskLevel: "low", requiresApprovalByDefault: false });
  const result = await executeConnectorRequest({
    request: {
      organizationId: "org-test",
      skill: makeSkill({ allowedTools: [tool.id] }),
      toolId: tool.id,
      payload: {
        query: "status",
        nested: { bearerToken: "Bearer SECRET_TOKEN_123456789" },
      },
      approved: true,
    },
    tools: [tool],
  });

  const serialized = JSON.stringify(result);
  assert.equal(result.status, "blocked");
  assert.equal(result.brokerMode, "policy-only");
  assert.match(result.decision.reason, /tenant vault/i);
  assert.equal(serialized.includes("SECRET_TOKEN"), false);
  assert.ok(result.envelope.controls.includes("payload_safety_gate"));
  assert.ok(result.envelope.controls.includes("credential_payload_block"));
});

test("executeConnectorRequest blocks non-serializable connector payloads without throwing", async () => {
  const tool = makeTool({ actionType: "read", riskLevel: "low", requiresApprovalByDefault: false });
  const payload: Record<string, unknown> = { issueKey: "EAIEOS-1" };
  payload.self = payload;

  const result = await executeConnectorRequest({
    request: {
      organizationId: "org-test",
      skill: makeSkill({ allowedTools: [tool.id] }),
      toolId: tool.id,
      payload,
      approved: true,
    },
    tools: [tool],
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.status, "blocked");
  assert.equal(result.brokerMode, "policy-only");
  assert.match(result.decision.reason, /JSON-serializable/i);
  assert.equal(serialized.includes("EAIEOS-1"), true);
  assert.equal(serialized.includes("[omitted]"), true);
});

test("executeConnectorRequest blocks write-like Graph methods on read tools", async () => {
  const tool = makeTool({
    id: "microsoft.graph_read",
    actionType: "read",
    riskLevel: "low",
    requiresApprovalByDefault: false,
  });
  const result = await executeConnectorRequest({
    request: {
      organizationId: "org-test",
      skill: makeSkill({ allowedTools: [tool.id] }),
      toolId: tool.id,
      payload: { method: "DELETE", endpoint: "/users/user-1" },
      approved: true,
    },
    tools: [tool],
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.brokerMode, "policy-only");
  assert.match(result.decision.reason, /not allowed for a read connector tool/i);
});

test("executeConnectorRequest sanitizes unsafe client idempotency keys before evidence storage", async () => {
  const tool = makeTool({ actionType: "read", riskLevel: "low", requiresApprovalByDefault: false });
  const unsafeKey = "Bearer SECRET_TOKEN_123456789 for person@example.com";
  const result = await executeConnectorRequest({
    request: {
      organizationId: "org-test",
      skill: makeSkill({ allowedTools: [tool.id] }),
      toolId: tool.id,
      payload: { query: "status" },
      approved: true,
      idempotencyKey: unsafeKey,
    },
    tools: [tool],
  });

  const serialized = JSON.stringify(result);
  assert.match(result.envelope.idempotencyKey, /^generated:[a-f0-9]{64}$/);
  assert.equal(serialized.includes(unsafeKey), false);
  assert.equal(serialized.includes("SECRET_TOKEN"), false);
  assert.equal(serialized.includes("person@example.com"), false);
  assert.ok(result.envelope.controls.includes("idempotency_key_sanitization"));
});

test("summarizeConnectorEvents reports envelope coverage and redacted payload evidence", async () => {
  const tool = makeTool({ actionType: "read", riskLevel: "low", requiresApprovalByDefault: false });
  const result = await executeConnectorRequest({
    request: {
      organizationId: "org-test",
      skill: makeSkill({ allowedTools: [tool.id] }),
      toolId: tool.id,
      payload: { customerEmail: "person@example.com" },
      approved: true,
    },
    tools: [tool],
  });
  const summary = summarizeConnectorEvents([
    {
      id: "event-1",
      organizationId: "org-test",
      skillId: "skill-broker-test",
      toolId: tool.id,
      status: result.status,
      decision: result.decision,
      payload: result.envelope.payloadPreview,
      envelope: result.envelope,
      createdAt: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "event-legacy",
      organizationId: "org-test",
      skillId: "skill-broker-test",
      toolId: tool.id,
      status: "requires_approval",
      decision: result.decision,
      payload: { reason: "legacy event" },
      createdAt: "2026-06-01T01:00:00.000Z",
    },
  ]);

  assert.equal(summary.total, 2);
  assert.equal(summary.executed, 0);
  assert.equal(summary.simulated, 1);
  assert.equal(summary.requiresApproval, 1);
  assert.equal(summary.envelopeCount, 1);
  assert.equal(summary.missingEnvelopeCount, 1);
  assert.equal(summary.redactedPayloadCount, 1);
  assert.equal(summary.latestAt, "2026-06-01T01:00:00.000Z");
});

test("normalizeConnectorEvent redacts unsafe legacy connector event evidence", () => {
  const event = normalizeConnectorEvent({
    id: "event-person@example.com",
    organizationId: "org-test",
    skillId: "skill-broker-test",
    toolId: "crm.lookup",
    status: "executed",
    decision: {
      status: "approved",
      reason: "Broker returned postgres://user:password@db.internal and api_key=sk-live-sensitive1234567890.",
      policyId: "policy-person@example.com",
      riskLevel: "low",
    },
    payload: {
      path: "/crm/accounts/acme",
      query: "Jane Doe salary history",
      customerEmail: "person@example.com",
      phoneNote: "Call 212-555-0101",
      ssnNote: "SSN 123-45-6789",
      body: "raw transcript from customer",
    },
    envelope: {
      schema: "enterprise-ai-enablement-os.connector-execution-envelope.v1",
      executionId: "event-person@example.com",
      idempotencyKey: "Bearer SECRET_TOKEN_123456789 for person@example.com",
      organizationId: "org-test",
      actor: "reviewer@example.com",
      skill: {
        id: "skill-broker-test",
        name: "Broker Test Skill",
        riskLevel: "low",
        autonomyTier: "tier_3_execute_bounded_action",
        version: "1.0.0",
      },
      toolId: "crm.lookup",
      payloadDigest: "sha256:abc",
      payloadSizeBytes: 200,
      payloadPreview: {
        path: "/crm/accounts/acme",
        query: "Jane Doe salary history",
        customerEmail: "person@example.com",
        note: "Call 212-555-0101 before renewal.",
      },
      approval: {
        approved: true,
        approvedBy: "approver@example.com",
        approvalId: "approval-1",
        approvedAt: "2026-06-01T00:00:00.000Z",
      },
      policy: {
        status: "approved",
        reason: "policy accepted api_key=sk-live-sensitive1234567890",
        policyId: "policy-person@example.com",
        riskLevel: "low",
      },
      controls: ["redacted_evidence"],
      createdAt: "2026-06-01T00:00:00.000Z",
    },
    createdAt: "2026-06-01T00:00:00.000Z",
  } as ConnectorEvent);
  const serialized = JSON.stringify(event);

  assert.equal(serialized.includes("person@example.com"), false);
  assert.equal(serialized.includes("212-555-0101"), false);
  assert.equal(serialized.includes("123-45-6789"), false);
  assert.equal(serialized.includes("Jane Doe salary"), false);
  assert.equal(serialized.includes("postgres://"), false);
  assert.equal(serialized.includes("sk-live-sensitive"), false);
  assert.equal(serialized.includes("SECRET_TOKEN"), false);
  assert.equal(event.payload.path, "/crm/accounts/acme");
  assert.equal(event.payload.query, "[redacted]");
  assert.equal(event.envelope?.payloadPreview.path, "/crm/accounts/acme");
  assert.equal(event.envelope?.payloadPreview.query, "[redacted]");
  assert.match(serialized, /\[redacted\]/);
});

test("connectorEvidenceFreshness applies the configured freshness window", () => {
  const now = new Date("2026-06-19T12:00:00.000Z");
  const fresh = connectorEvidenceFreshness(
    {
      total: 1,
      executed: 1,
      simulated: 0,
      requiresApproval: 0,
      blocked: 0,
      envelopeCount: 1,
      missingEnvelopeCount: 0,
      redactedPayloadCount: 1,
      latestAt: "2026-06-10T12:00:00.000Z",
    },
    { CONNECTOR_EVIDENCE_MAX_AGE_DAYS: "14" },
    now,
  );
  const stale = connectorEvidenceFreshness(
    {
      total: 1,
      executed: 1,
      simulated: 0,
      requiresApproval: 0,
      blocked: 0,
      envelopeCount: 1,
      missingEnvelopeCount: 0,
      redactedPayloadCount: 1,
      latestAt: "2026-05-01T12:00:00.000Z",
    },
    { CONNECTOR_EVIDENCE_MAX_AGE_DAYS: "14" },
    now,
  );

  assert.equal(fresh.fresh, true);
  assert.equal(fresh.ageDays, 9);
  assert.equal(stale.fresh, false);
  assert.equal(stale.maxAgeDays, 14);
  assert.match(stale.reason, /outside the 14-day freshness window/);
});
