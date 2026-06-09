import { test } from "node:test";
import assert from "node:assert/strict";

import { executeConnectorRequest } from "../src/lib/connector-broker.ts";
import { summarizeConnectorEvents } from "../src/lib/connector-events.ts";
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
  let capturedIdempotencyKey = "";

  process.env.MCP_BROKER_URL = "https://broker.example";
  process.env.CONNECTOR_BROKER_TOKEN = "test-token";
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = String(init?.body ?? "");
    capturedAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
    capturedIdempotencyKey = String((init?.headers as Record<string, string> | undefined)?.["X-EAIEOS-Idempotency-Key"] ?? "");
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

    const envelope = JSON.parse(capturedBody) as {
      schema?: string;
      policyDecision?: { status?: string };
      toolId?: string;
      executionEnvelope?: { schema?: string; payloadDigest?: string; idempotencyKey?: string };
    };
    assert.equal(result.status, "executed");
    assert.equal(result.brokerMode, "external");
    assert.equal(capturedAuthorization, "Bearer test-token");
    assert.equal(capturedIdempotencyKey.length > 20, true);
    assert.equal(envelope.schema, "enterprise-ai-enablement-os.connector-execution-request.v1");
    assert.equal(envelope.toolId, tool.id);
    assert.equal(envelope.policyDecision?.status, "approved");
    assert.equal(envelope.executionEnvelope?.schema, "enterprise-ai-enablement-os.connector-execution-envelope.v1");
    assert.equal(envelope.executionEnvelope?.payloadDigest?.startsWith("sha256:"), true);
    assert.equal(envelope.executionEnvelope?.idempotencyKey, capturedIdempotencyKey);
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
    assert.match(result.decision.reason, /External connector broker is unavailable/i);
    assert.equal(JSON.stringify(result).includes("network offline"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBrokerUrl === undefined) delete process.env.MCP_BROKER_URL;
    else process.env.MCP_BROKER_URL = previousBrokerUrl;
    if (previousTimeout === undefined) delete process.env.CONNECTOR_BROKER_TIMEOUT_MS;
    else process.env.CONNECTOR_BROKER_TIMEOUT_MS = previousTimeout;
  }
});

test("executeConnectorRequest redacts rejected external broker response bodies", async () => {
  const originalFetch = globalThis.fetch;
  const previousBrokerUrl = process.env.MCP_BROKER_URL;
  const tool = makeTool({ actionType: "read", riskLevel: "low" });

  process.env.MCP_BROKER_URL = "https://broker.example";
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
  assert.equal(String(result.output.payloadDigest).startsWith("sha256:"), true);
  assert.equal(result.envelope.payloadPreview.path, "/ops/status");
  assert.match(String(result.output.message), /policy-only/i);
});

test("executeConnectorRequest returns redacted evidence envelope without leaking raw payload secrets", async () => {
  const tool = makeTool({ actionType: "read", riskLevel: "low", requiresApprovalByDefault: false });
  const result = await executeConnectorRequest({
    request: {
      organizationId: "org-test",
      skill: makeSkill({ allowedTools: [tool.id] }),
      toolId: tool.id,
      payload: {
        query: "status",
        customerEmail: "person@example.com",
        nested: { note: "Customer email is redacted in connector evidence." },
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
  assert.equal(serialized.includes("person@example.com"), false);
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
  assert.equal(summary.executed, 1);
  assert.equal(summary.requiresApproval, 1);
  assert.equal(summary.envelopeCount, 1);
  assert.equal(summary.missingEnvelopeCount, 1);
  assert.equal(summary.redactedPayloadCount, 1);
  assert.equal(summary.latestAt, "2026-06-01T01:00:00.000Z");
});
