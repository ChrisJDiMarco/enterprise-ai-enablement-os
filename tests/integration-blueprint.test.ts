import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveIntegrationBlueprint } from "../src/lib/integration-blueprint.ts";
import type { ContextSource, Run, Skill, Tool, ToolRequest, UseCase } from "../src/lib/enterprise-ai-data.ts";

function tool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: "knowledge.search",
    displayName: "Knowledge Search",
    description: "Search approved sources.",
    category: "document",
    actionType: "read",
    riskLevel: "low",
    requiresApprovalByDefault: false,
    enabled: true,
    usage: 1,
    lastUsed: "Today",
    ...overrides,
  };
}

function contextSource(overrides: Partial<ContextSource> = {}): ContextSource {
  return {
    id: "ctx-1",
    name: "HR Policy Manual",
    type: "sharepoint",
    classification: "confidential",
    ownerDepartment: "HR",
    enabled: true,
    lastIndexedAt: "Today",
    documentCount: 100,
    skillsUsing: 1,
    health: "healthy",
    ...overrides,
  };
}

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "HR Policy Helpdesk",
    description: "Answer repeated policy questions.",
    department: "HR",
    requestorId: "u-1",
    businessProblem: "Employees wait for answers.",
    currentProcess: "Tickets.",
    desiredOutcome: "Guided answers.",
    monthlyVolume: 1000,
    avgHandlingTimeMinutes: 8,
    estimatedUsers: 200,
    capabilityType: "knowledge_assistant",
    status: "governance_review",
    riskLevel: "medium",
    valueScore: 4,
    feasibilityScore: 4,
    riskScore: 2.5,
    reuseScore: 5,
    urgencyScore: 4,
    dataReadinessScore: 4,
    priorityScore: 86,
    expectedBenefits: ["hours_saved"],
    dataSources: ["HR Policy Manual"],
    risks: ["policy accuracy"],
    linkedSkillId: "skill-1",
    updatedAt: "2026-05-29T00:00:00.000Z",
    createdAt: "2026-05-29T00:00:00.000Z",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    useCaseId: "uc-1",
    name: "HR Policy Helpdesk Skill",
    slug: "hr-policy-helpdesk",
    description: "Answers policy questions.",
    department: "HR",
    ownerId: "u-1",
    status: "pilot",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_1_read_only",
    modelProvider: "local",
    model: "local-enterprise-reasoner",
    temperature: 0.2,
    maxTokens: 2200,
    fallbackModel: "",
    costLimit: 0.35,
    systemPrompt: "Use approved policy context only.",
    allowedTools: ["knowledge.search", "jira.create_task"],
    blockedTools: ["email.send_external"],
    contextSources: ["HR Policy Manual"],
    evalPassRate: 94,
    adoptionCount: 40,
    valueDelivered: 120000,
    runs: 8,
    updatedAt: "2026-05-29T00:00:00.000Z",
    ...overrides,
  };
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    skillId: "skill-1",
    triggeredBy: "u-1",
    status: "completed",
    riskLevel: "medium",
    currentStage: "Completed",
    costUsd: 0.04,
    latencyMs: 2300,
    startedAt: "2026-05-29T00:00:00.000Z",
    output: "Done.",
    trace: [
      { label: "Request", status: "completed", detail: "Received", latencyMs: 1 },
      { label: "Identity", status: "completed", detail: "Resolved", latencyMs: 1 },
      { label: "Skill", status: "completed", detail: "Loaded", latencyMs: 1 },
      { label: "Context", status: "completed", detail: "Retrieved", latencyMs: 1 },
      { label: "Policy", status: "completed", detail: "Checked", latencyMs: 1 },
      { label: "Output", status: "completed", detail: "Validated", latencyMs: 1 },
    ],
    ...overrides,
  };
}

function toolRequest(overrides: Partial<ToolRequest> = {}): ToolRequest {
  return {
    id: "tr-1",
    skillId: "skill-1",
    runId: "run-1",
    user: "u-1",
    toolId: "jira.create_task",
    reason: "Create follow-up task.",
    riskLevel: "medium",
    status: "approved",
    requestedAt: "2026-05-29T00:00:00.000Z",
    ...overrides,
  };
}

test("deriveIntegrationBlueprint: empty workspace identifies missing integration layer", () => {
  const blueprint = deriveIntegrationBlueprint({
    tools: [],
    contextSources: [],
    useCases: [],
    skills: [],
    runs: [],
    toolRequests: [],
  });

  assert.equal(blueprint.status, "missing");
  assert.equal(blueprint.primaryNextAction.id, "identity");
  assert.equal(blueprint.connectedCategories.length, 0);
});

test("deriveIntegrationBlueprint: connected workspace recommends runner mix", () => {
  const blueprint = deriveIntegrationBlueprint({
    tools: [
      tool(),
      tool({ id: "jira.create_task", category: "workflow", actionType: "create", riskLevel: "medium", requiresApprovalByDefault: true }),
      tool({ id: "identity.read_group", category: "identity", actionType: "read" }),
    ],
    contextSources: [contextSource()],
    useCases: [useCase()],
    skills: [skill()],
    runs: [run()],
    toolRequests: [toolRequest()],
    productionReadiness: {
      status: "degraded",
      auth: { authRequired: true, oidcConfigured: false, localLoginEnabled: true, mode: "local" },
      connectors: { configured: false, mode: "policy-only" },
      workflows: { configured: false, mode: "local-job-ledger" },
    },
  });

  assert.ok(blueprint.score > 50);
  assert.ok(blueprint.connectedCategories.includes("workflow"));
  assert.equal(blueprint.runners.find((item) => item.id === "harness-native")?.status, "ready");
  assert.equal(blueprint.runners.find((item) => item.id === "human-in-loop")?.status, "ready");
});

test("deriveIntegrationBlueprint: durable workflow remains partial without production engine", () => {
  const blueprint = deriveIntegrationBlueprint({
    tools: [tool({ id: "jira.create_task", category: "workflow", actionType: "create", requiresApprovalByDefault: true })],
    contextSources: [],
    useCases: [useCase()],
    skills: [skill()],
    runs: [run()],
    toolRequests: [],
    productionReadiness: {
      status: "degraded",
      workflows: { configured: false, mode: "local-job-ledger" },
    },
  });

  assert.equal(blueprint.runners.find((item) => item.id === "durable-workflow")?.status, "partial");
  assert.equal(blueprint.zones.find((item) => item.id === "automation-runners")?.status, "partial");
});
