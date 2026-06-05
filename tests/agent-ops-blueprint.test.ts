import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveAgentOpsBlueprint } from "../src/lib/agent-ops-blueprint.ts";
import type { AuditLog, Run, Skill, ToolRequest } from "../src/lib/enterprise-ai-data.ts";

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "sk-1",
    name: "Policy Copilot",
    slug: "policy-copilot",
    description: "Answers policy questions.",
    department: "HR",
    ownerId: "u-1",
    status: "production",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_1_read_only",
    modelProvider: "local",
    model: "local-enterprise-reasoner",
    temperature: 0.2,
    maxTokens: 2400,
    fallbackModel: "",
    costLimit: 2,
    systemPrompt: "Answer from approved sources.",
    allowedTools: ["sharepoint.read_policy"],
    blockedTools: ["email.send_external"],
    contextSources: ["HR Policy Manual"],
    evalPassRate: 96,
    adoptionCount: 42,
    valueDelivered: 12000,
    runs: 10,
    updatedAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    skillId: "sk-1",
    triggeredBy: "u-1",
    status: "waiting_for_approval",
    riskLevel: "medium",
    currentStage: "Approval gate",
    costUsd: 0.04,
    latencyMs: 12000,
    startedAt: "2026-05-28T00:00:00.000Z",
    output: "Pending approval.",
    trace: [
      { label: "Request received", detail: "Accepted", status: "completed", latencyMs: 20 },
      { label: "Identity resolved", detail: "User mapped", status: "completed", latencyMs: 30 },
      { label: "Context retrieved", detail: "Permission filtered", status: "completed", latencyMs: 200 },
      { label: "Policy check", detail: "Tool permission approved", status: "completed", latencyMs: 40 },
      { label: "Output validation", detail: "Safety and grounding passed", status: "completed", latencyMs: 50 },
      { label: "Human approval", detail: "Paused with checkpoint", status: "waiting", latencyMs: 0 },
    ],
    ...overrides,
  };
}

function toolRequest(overrides: Partial<ToolRequest> = {}): ToolRequest {
  return {
    id: "tr-1",
    skillId: "sk-1",
    runId: "run-1",
    user: "u-1",
    toolId: "sharepoint.read_policy",
    reason: "Retrieve approved policy.",
    riskLevel: "low",
    status: "pending",
    requestedAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

function audit(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "audit-1",
    eventType: "policy_check",
    message: "Policy check recorded.",
    actor: "Harness",
    riskLevel: "low",
    createdAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

test("deriveAgentOpsBlueprint: empty workspace reports gaps", () => {
  const blueprint = deriveAgentOpsBlueprint({
    runs: [],
    skills: [],
    toolRequests: [],
    auditLogs: [],
  });

  assert.equal(blueprint.status, "gap");
  assert.ok(blueprint.score < 45);
  assert.equal(blueprint.capabilities.length, 6);
  assert.ok(blueprint.capabilities.every((item) => item.status === "gap"));
});

test("deriveAgentOpsBlueprint: strong harness evidence raises readiness", () => {
  const blueprint = deriveAgentOpsBlueprint({
    runs: [run()],
    skills: [skill()],
    toolRequests: [toolRequest()],
    auditLogs: [audit()],
  });

  assert.equal(blueprint.status, "ready");
  assert.ok(blueprint.score >= 80);
  assert.equal(blueprint.capabilities.find((item) => item.id === "guardrail-stack")?.status, "ready");
  assert.equal(blueprint.capabilities.find((item) => item.id === "connector-broker")?.status, "ready");
  assert.equal(blueprint.capabilities.find((item) => item.id === "evaluation")?.status, "ready");
});

test("deriveAgentOpsBlueprint: tools without broker traffic remain partial", () => {
  const blueprint = deriveAgentOpsBlueprint({
    runs: [],
    skills: [skill()],
    toolRequests: [],
    auditLogs: [],
  });

  assert.equal(blueprint.capabilities.find((item) => item.id === "connector-broker")?.status, "partial");
  assert.match(blueprint.capabilities.find((item) => item.id === "connector-broker")?.nextAction ?? "", /broker/i);
});
