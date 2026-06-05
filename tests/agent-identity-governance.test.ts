import assert from "node:assert/strict";
import test from "node:test";
import { deriveAgentIdentityGovernance } from "../src/lib/agent-identity-governance.ts";
import type { Skill } from "../src/lib/enterprise-ai-data.ts";

function skill(overrides: Partial<Skill>): Skill {
  return {
    id: "skill-1",
    name: "Policy Copilot",
    slug: "policy-copilot",
    description: "Answers policy questions.",
    department: "HR",
    ownerId: "owner-1",
    status: "pilot",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_1_read_only",
    modelProvider: "mock",
    model: "mock-smart",
    temperature: 0.2,
    maxTokens: 1800,
    fallbackModel: "mock-fast",
    costLimit: 0.25,
    systemPrompt: "Use approved context only.",
    allowedTools: ["sharepoint.read_policy"],
    blockedTools: [],
    contextSources: ["HR Policy Manual"],
    evalPassRate: 94,
    adoptionCount: 100,
    valueDelivered: 1000,
    runs: 10,
    updatedAt: "2026-05-29",
    ...overrides,
  };
}

test("deriveAgentIdentityGovernance creates accountable agent subjects", () => {
  const posture = deriveAgentIdentityGovernance({
    skills: [skill({})],
    runs: [],
    toolRequests: [],
    auditLogs: [],
  });

  assert.equal(posture.records[0].subject, "agent:policy-copilot:v1.0.0");
  assert.equal(posture.records[0].status, "active");
  assert.equal(posture.activeAgents, 1);
});

test("deriveAgentIdentityGovernance treats archived Skills as disabled kill switch identities", () => {
  const posture = deriveAgentIdentityGovernance({
    skills: [skill({ status: "archived" })],
    runs: [],
    toolRequests: [],
    auditLogs: [],
  });

  assert.equal(posture.records[0].status, "disabled");
  assert.equal(posture.records[0].killSwitchEngaged, true);
  assert.equal(posture.disabledAgents, 1);
});
