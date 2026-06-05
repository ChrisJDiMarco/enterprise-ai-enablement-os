import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveLaunchHandoff } from "../src/lib/launch-handoff.ts";
import type { EvalResult, GovernanceReview, Run, Skill, UseCase } from "../src/lib/enterprise-ai-data.ts";

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "HR Policy Helpdesk",
    description: "Answer policy questions.",
    department: "HR",
    requestorId: "u-1",
    businessProblem: "Employees wait for policy answers.",
    currentProcess: "Shared inbox and tickets.",
    desiredOutcome: "Governed policy assistant.",
    monthlyVolume: 1200,
    avgHandlingTimeMinutes: 12,
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
    updatedAt: "2026-05-28T00:00:00.000Z",
    createdAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    useCaseId: "uc-1",
    name: "HR Policy Helpdesk Skill",
    slug: "hr-policy-helpdesk",
    description: "Answers approved policy questions.",
    department: "HR",
    ownerId: "u-1",
    status: "in_review",
    version: "0.1.0",
    riskLevel: "medium",
    autonomyTier: "tier_1_read_only",
    modelProvider: "local",
    model: "local-enterprise-reasoner",
    temperature: 0.2,
    maxTokens: 2200,
    fallbackModel: "",
    costLimit: 0.35,
    systemPrompt: "Use approved HR policy sources only. Cite sources, avoid policy invention, and escalate sensitive cases.",
    allowedTools: ["knowledge.search_approved_sources"],
    blockedTools: [],
    contextSources: ["HR Policy Manual"],
    evalPassRate: 82,
    adoptionCount: 0,
    valueDelivered: 0,
    runs: 0,
    updatedAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

function review(overrides: Partial<GovernanceReview> = {}): GovernanceReview {
  return {
    id: "gov-1",
    itemType: "skill",
    itemId: "skill-1",
    title: "HR Policy Helpdesk Launch Review",
    department: "HR",
    riskLevel: "medium",
    reviewer: "Security / Legal / Privacy",
    status: "in_review",
    dueDate: "2026-05-28T00:00:00.000Z",
    blockers: ["Run full launch readiness eval suite"],
    ...overrides,
  };
}

function evalResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    id: "eval-1",
    skillId: "skill-1",
    suiteName: "Launch Readiness",
    score: 82,
    passed: false,
    criticalFailures: 1,
    createdAt: "2026-05-28T00:00:00.000Z",
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
    costUsd: 0.01,
    latencyMs: 1200,
    startedAt: "2026-05-28T00:00:00.000Z",
    output: "Done",
    trace: [
      { label: "Request", status: "completed", detail: "Received", latencyMs: 10 },
      { label: "Identity", status: "completed", detail: "Resolved", latencyMs: 10 },
      { label: "Skill", status: "completed", detail: "Loaded", latencyMs: 10 },
      { label: "Context", status: "completed", detail: "Retrieved", latencyMs: 10 },
      { label: "Policy", status: "completed", detail: "Allowed", latencyMs: 10 },
      { label: "Output", status: "completed", detail: "Validated", latencyMs: 10 },
    ],
    ...overrides,
  };
}

test("deriveLaunchHandoff: empty workspace tells the user to generate first", () => {
  const handoff = deriveLaunchHandoff({
    organizationName: "",
    useCases: [],
    skills: [],
    runs: [],
    governanceReviews: [],
    evalResults: [],
    report: "",
    workflow: { nodeCount: 0, status: "Saved", valid: true, issues: 0 },
  });

  assert.equal(handoff.generated, false);
  assert.equal(handoff.nextStep.id, "inspect-portfolio");
  assert.equal(handoff.nextStep.status, "blocked");
});

test("deriveLaunchHandoff: generated workspace prioritizes eval before governance approval", () => {
  const handoff = deriveLaunchHandoff({
    organizationName: "Northwind Group",
    useCases: [useCase()],
    skills: [skill()],
    runs: [],
    governanceReviews: [review()],
    evalResults: [evalResult()],
    report: "# Launch Plan",
    workflow: { nodeCount: 8, status: "Saved", valid: true, issues: 0 },
  });

  assert.equal(handoff.generated, true);
  assert.equal(handoff.nextStep.id, "review-skill-package");
  assert.equal(handoff.steps.find((item) => item.id === "run-launch-eval")?.status, "ready");
  assert.equal(handoff.steps.find((item) => item.id === "resolve-governance")?.status, "ready");
});

test("deriveLaunchHandoff: mature launch package points to reports", () => {
  const handoff = deriveLaunchHandoff({
    organizationName: "Northwind Group",
    useCases: [useCase()],
    skills: [skill({ status: "pilot", evalPassRate: 96, adoptionCount: 30, valueDelivered: 120000 })],
    runs: [run()],
    governanceReviews: [review({ status: "approved", blockers: [] })],
    evalResults: [evalResult({ score: 96, passed: true, criticalFailures: 0 })],
    report: "# Launch Plan",
    workflow: { nodeCount: 8, status: "Published", valid: true, issues: 0 },
  });

  assert.equal(handoff.score, 100);
  assert.equal(handoff.nextStep.id, "inspect-portfolio");
  assert.equal(handoff.nextStep.status, "done");
});
