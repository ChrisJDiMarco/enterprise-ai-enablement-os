import { test } from "node:test";
import assert from "node:assert/strict";
import { countOpenInboxItems, deriveActionInbox } from "../src/lib/action-inbox.ts";
import type { EvalResult, GovernanceReview, Run, Skill, ToolRequest, UseCase } from "../src/lib/enterprise-ai-data.ts";

function baseInput(overrides = {}) {
  return {
    useCases: [],
    skills: [],
    runs: [],
    toolRequests: [],
    governanceReviews: [],
    evalResults: [],
    auditLogs: [],
    report: "",
    metrics: { annualValue: 0, adoptionRate: 0, riskItemsOpen: 0 },
    workflow: { nodeCount: 0, status: "Saved" as const, valid: true, issues: 0, warnings: 0, firstIssue: "" },
    ...overrides,
  };
}

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "Employee Decision Assistant",
    description: "High risk decision support.",
    department: "HR",
    requestorId: "u-1",
    businessProblem: "Manual decisions lack consistency.",
    currentProcess: "Spreadsheet review.",
    desiredOutcome: "Governed recommendations.",
    monthlyVolume: 100,
    avgHandlingTimeMinutes: 20,
    estimatedUsers: 15,
    capabilityType: "decision_support",
    status: "scored",
    riskLevel: "high",
    valueScore: 4,
    feasibilityScore: 3,
    riskScore: 4,
    reuseScore: 3,
    urgencyScore: 4,
    dataReadinessScore: 3,
    priorityScore: 67,
    expectedBenefits: [],
    dataSources: [],
    risks: ["employee impact"],
    updatedAt: "2026-05-28T00:00:00.000Z",
    createdAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "sk-1",
    name: "Finance Close Assistant",
    slug: "finance-close-assistant",
    description: "Close support.",
    department: "Finance",
    ownerId: "u-1",
    status: "pilot",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_2_prepare_action",
    modelProvider: "local",
    model: "local-enterprise-reasoner",
    temperature: 0.2,
    maxTokens: 2400,
    fallbackModel: "",
    costLimit: 2,
    systemPrompt: "Summarize close status.",
    allowedTools: ["excel.read_workbook"],
    blockedTools: [],
    contextSources: ["Finance Close Calendar"],
    evalPassRate: 82,
    adoptionCount: 10,
    valueDelivered: 0,
    runs: 3,
    updatedAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

function toolRequest(overrides: Partial<ToolRequest> = {}): ToolRequest {
  return {
    id: "tr-1",
    skillId: "sk-1",
    runId: "run-1",
    user: "u-1",
    toolId: "excel.read_workbook",
    reason: "Read confidential variance file.",
    riskLevel: "medium",
    status: "pending",
    requestedAt: "2026-05-28T00:00:00.000Z",
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
    currentStage: "Human approval",
    costUsd: 0.02,
    latencyMs: 2000,
    startedAt: "2026-05-28T00:00:00.000Z",
    output: "Waiting.",
    trace: [],
    ...overrides,
  };
}

function review(overrides: Partial<GovernanceReview> = {}): GovernanceReview {
  return {
    id: "gov-1",
    itemType: "skill",
    itemId: "sk-1",
    title: "Finance Close Assistant",
    department: "Finance",
    riskLevel: "medium",
    reviewer: "Security",
    status: "changes_requested",
    dueDate: "2026-05-29",
    blockers: ["Eval pass rate below threshold"],
    ...overrides,
  };
}

function evalResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    id: "eval-1",
    skillId: "sk-1",
    suiteName: "Launch readiness",
    score: 82,
    passed: false,
    criticalFailures: 1,
    createdAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

test("deriveActionInbox: empty workspace routes to setup", () => {
  const items = deriveActionInbox(baseInput());
  assert.equal(items[0].id, "empty-workspace");
  assert.equal(items[0].targetView, "command");
  assert.equal(countOpenInboxItems(items), 1);
});

test("deriveActionInbox: prioritizes approval, governance, run, eval, and workflow blockers", () => {
  const items = deriveActionInbox(
    baseInput({
      useCases: [useCase()],
      skills: [skill()],
      runs: [run()],
      toolRequests: [toolRequest()],
      governanceReviews: [review()],
      evalResults: [evalResult()],
      workflow: { nodeCount: 5, status: "Testing", valid: false, issues: 2, warnings: 1, firstIssue: "End block is missing." },
    }),
  );

  assert.equal(items[0].severity, "critical");
  assert.ok(items.some((item) => item.id === "pending-tool-requests"));
  assert.ok(items.some((item) => item.id === "governance-blockers"));
  assert.ok(items.some((item) => item.id === "blocked-runs"));
  assert.ok(items.some((item) => item.id === "eval-readiness"));
  assert.ok(items.some((item) => item.id === "workflow-validation"));
});

test("deriveActionInbox: healthy workspace produces one success item", () => {
  const items = deriveActionInbox(
    baseInput({
      useCases: [useCase({ riskLevel: "low", risks: [] })],
      skills: [skill({ evalPassRate: 96, valueDelivered: 120000 })],
      runs: [run({ status: "completed", currentStage: "Complete" })],
      toolRequests: [],
      governanceReviews: [review({ status: "approved", blockers: [] })],
      evalResults: [evalResult({ passed: true, score: 96, criticalFailures: 0 })],
      report: "Executive brief",
      metrics: { annualValue: 120000, adoptionRate: 40, riskItemsOpen: 0 },
      workflow: { nodeCount: 5, status: "Published", valid: true, issues: 0, warnings: 0, firstIssue: "" },
    }),
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].severity, "success");
  assert.equal(countOpenInboxItems(items), 0);
});
