import { ok, strictEqual } from "node:assert";
import { test } from "node:test";

import type { Skill, UseCase, WorkSignal } from "../src/lib/enterprise-ai-data.ts";
import { deriveEnablementPlaybookProgram } from "../src/lib/enablement-playbooks.ts";

const now = new Date("2026-06-20T12:00:00.000Z");

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "Expense report triage",
    description: "Help finance operators handle expense reports.",
    department: "Finance",
    requestorId: "u-1",
    ownerId: "u-2",
    businessProblem: "Manual review is slow.",
    currentProcess: "Analysts collect receipts, check policy, and route exceptions.",
    desiredOutcome: "AI drafts the review and flags exception cases.",
    monthlyVolume: 900,
    avgHandlingTimeMinutes: 18,
    estimatedUsers: 40,
    capabilityType: "Finance operations",
    status: "approved_for_pilot",
    riskLevel: "medium",
    valueScore: 4,
    feasibilityScore: 4,
    riskScore: 2,
    reuseScore: 4,
    urgencyScore: 4,
    dataReadinessScore: 4,
    priorityScore: 88,
    expectedBenefits: ["Reduce cycle time"],
    dataSources: ["Expense policy", "ERP"],
    risks: ["Incorrect approval"],
    linkedSkillId: "skill-1",
    createdAt: "2026-05-10T12:00:00.000Z",
    updatedAt: "2026-06-05T12:00:00.000Z",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    useCaseId: "uc-1",
    name: "Expense Review Assistant",
    slug: "expense-review-assistant",
    description: "Drafts finance review notes with approved policy context.",
    department: "Finance",
    ownerId: "u-2",
    status: "pilot",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_2_prepare_action",
    modelProvider: "OpenAI",
    model: "gpt-4.1",
    temperature: 0.2,
    maxTokens: 2_000,
    fallbackModel: "gpt-4.1-mini",
    costLimit: 50,
    systemPrompt: "Use approved finance context.",
    allowedTools: ["erp.read"],
    blockedTools: [],
    contextSources: ["Expense policy", "ERP"],
    evalPassRate: 86,
    adoptionCount: 32,
    valueDelivered: 45_000,
    runs: 120,
    updatedAt: "2026-06-10T12:00:00.000Z",
    ...overrides,
  };
}

function signal(overrides: Partial<WorkSignal> = {}): WorkSignal {
  return {
    id: "signal-1",
    source: "survey",
    eventType: "training_completed",
    department: "Finance",
    process: "Expense report triage",
    summary: "Finance cohort completed the workflow playbook.",
    metadata: { relatedUseCaseId: "uc-1", relatedSkillId: "skill-1", confidence: 0.9 },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: "aggregated",
      retentionDays: 365,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel: "medium",
    createdAt: "2026-06-18T12:00:00.000Z",
    ...overrides,
  };
}

test("deriveEnablementPlaybookProgram turns use cases and skills into agent-ready playbooks", () => {
  const program = deriveEnablementPlaybookProgram({
    useCases: [useCase()],
    skills: [skill()],
    workSignals: [signal()],
    now,
  });

  strictEqual(program.metrics.total, 1);
  strictEqual(program.metrics.agentReady, 1);
  strictEqual(program.metrics.lifecycleReady, 1);
  strictEqual(program.playbooks[0]?.stage, "agent_ready");
  strictEqual(program.playbooks[0]?.lifecycle.status, "publish_ready");
  ok(program.optimizationQueue.some((item) => item.kind === "automate" && item.targetView === "workflow"));
  ok(program.playbooks[0]?.optimizations.some((item) => item.kind === "publish" && item.targetView === "orchestrator"));
  ok((program.playbooks[0]?.guide.steps.length ?? 0) >= 3);
  ok(program.playbooks[0]?.guide.assistantContext.some((line) => line.includes("Expense Review Assistant")));
  ok(program.playbooks[0]?.guide.publishTargets.some((target) => target.label === "Agent context"));
  ok(program.playbooks[0]?.lifecycle.exports.some((item) => item.label === "Agent context" && item.status === "ready"));
  ok(program.playbooks[0]?.lifecycle.versionHistory.some((item) => item.label.includes("Skill")));
  ok(program.playbooks[0]?.completion ?? 0 >= 78);
  ok(program.playbooks[0]?.contextReadiness ?? 0 >= 65);
});

test("deriveEnablementPlaybookProgram exposes gaps for unstarted work", () => {
  const program = deriveEnablementPlaybookProgram({
    useCases: [useCase({ currentProcess: "", desiredOutcome: "", dataSources: [], linkedSkillId: undefined })],
    skills: [],
    workSignals: [],
    now,
  });

  const playbook = program.playbooks[0];
  strictEqual(program.metrics.agentReady, 0);
  strictEqual(program.metrics.lifecycleReady, 0);
  strictEqual(playbook?.targetView, "work");
  strictEqual(playbook?.lifecycle.status, "draft");
  strictEqual(playbook?.lifecycle.approvalGates[0]?.status, "missing");
  strictEqual(playbook?.optimizations[0]?.kind, "capture");
  ok(playbook?.guide.quizChecks.some((check) => check.includes("incorrect approval")));
  strictEqual(program.optimizationQueue[0]?.targetView, "work");
  ok(playbook?.gaps.some((gap) => gap.includes("Capture how the workflow")));
  ok(playbook?.gaps.some((gap) => gap.includes("governed AI Skill")));
});

test("deriveEnablementPlaybookProgram marks stale lifecycle reviews as due", () => {
  const program = deriveEnablementPlaybookProgram({
    useCases: [useCase({ riskLevel: "high", updatedAt: "2026-01-01T12:00:00.000Z" })],
    skills: [skill({ riskLevel: "high", updatedAt: "2026-01-10T12:00:00.000Z" })],
    workSignals: [signal({ createdAt: "2026-01-15T12:00:00.000Z" })],
    now,
  });

  const playbook = program.playbooks[0];
  strictEqual(playbook?.lifecycle.status, "review_due");
  ok(playbook?.optimizations.some((item) => item.kind === "review" && item.targetView === "governance"));
  ok((playbook?.lifecycle.reviewDueInDays ?? 0) < 0);
  ok(playbook?.lifecycle.assignments.some((item) => item.label === "Expert reviewer" && item.status === "attention"));
});

test("deriveEnablementPlaybookProgram creates a seed playbook when the workspace is empty", () => {
  const program = deriveEnablementPlaybookProgram({ useCases: [], skills: [], workSignals: [], now });

  strictEqual(program.metrics.total, 1);
  strictEqual(program.playbooks[0]?.source, "seed");
  strictEqual(program.playbooks[0]?.targetView, "work");
  strictEqual(program.playbooks[0]?.lifecycle.status, "draft");
  strictEqual(program.playbooks[0]?.optimizations[0]?.kind, "capture");
  strictEqual(program.playbooks[0]?.guide.sourceLabel, "Waiting for workflow capture");
  strictEqual(program.playbooks[0]?.guide.publishTargets.every((item) => item.status === "missing"), true);
  strictEqual(program.optimizationQueue.length >= 1, true);
  strictEqual(program.playbooks[0]?.lifecycle.exports.every((item) => item.status === "missing"), true);
});
