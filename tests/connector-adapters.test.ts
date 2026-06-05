import { test } from "node:test";
import assert from "node:assert/strict";
import { executeNativeConnector } from "../src/lib/connector-adapters.ts";
import type { Skill } from "../src/lib/enterprise-ai-data.ts";

const skill: Skill = {
  id: "skill-connector-test",
  name: "Connector Test Skill",
  slug: "connector-test-skill",
  description: "Tests connector adapter behavior.",
  department: "Operations",
  ownerId: "user-1",
  status: "draft",
  version: "1.0.0",
  riskLevel: "low",
  autonomyTier: "tier_2_prepare_action",
  modelProvider: "local",
  model: "local-enterprise-reasoner",
  temperature: 0.2,
  maxTokens: 1000,
  fallbackModel: "local",
  costLimit: 0.1,
  systemPrompt: "Use tools only when approved.",
  allowedTools: ["slack.chat_post_message"],
  blockedTools: [],
  contextSources: [],
  evalPassRate: 0,
  adoptionCount: 0,
  valueDelivered: 0,
  runs: 0,
  updatedAt: "2026-05-29",
};

test("native connector adapter fails closed when a recognized connector lacks secrets", async () => {
  const result = await executeNativeConnector({
    request: {
      organizationId: "org-test",
      skill,
      toolId: "slack.chat_post_message",
      payload: { channel: "C123", text: "hello" },
    },
    secrets: {},
  });

  assert.equal(result.handled, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.connectorId, "slack");
  assert.match(String(result.output.message), /SLACK_BOT_TOKEN/);
});

test("native connector adapter ignores unrecognized tools so policy-only fallback can remain explicit", async () => {
  const result = await executeNativeConnector({
    request: {
      organizationId: "org-test",
      skill,
      toolId: "unknown.read",
      payload: {},
    },
    secrets: {},
  });

  assert.equal(result.handled, false);
});
