import { ok, strictEqual } from "node:assert";
import { test } from "node:test";

import type { ContextSource, Skill, UseCase, WorkSignal } from "../src/lib/enterprise-ai-data.ts";
import { deriveWorkflowOptimizationModel } from "../src/lib/workflow-optimization.ts";

function signal(overrides: Partial<WorkSignal> = {}): WorkSignal {
  return {
    id: "sig-1",
    source: "service_now",
    eventType: "workflow_delayed",
    department: "HR",
    process: "Employee policy support",
    summary: "Policy answers wait on repeated HR handoffs.",
    metadata: { volume: 380, delayHours: 18, cycleTimeHours: 30, confidence: 0.88, relatedUseCaseId: "uc-1" },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: "system_metadata",
      retentionDays: 180,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel: "medium",
    createdAt: "2026-06-18T12:00:00.000Z",
    ...overrides,
  };
}

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "Employee policy support",
    description: "Help HR answer repeated policy questions.",
    department: "HR",
    requestorId: "u-1",
    ownerId: "u-2",
    businessProblem: "Repeated policy requests wait on manual handoffs.",
    currentProcess: "Employee asks HR, HR searches policy, HR routes exceptions.",
    desiredOutcome: "AI drafts grounded policy responses and routes exceptions.",
    monthlyVolume: 380,
    avgHandlingTimeMinutes: 16,
    estimatedUsers: 120,
    capabilityType: "Knowledge support",
    status: "approved_for_pilot",
    riskLevel: "medium",
    valueScore: 4,
    feasibilityScore: 4,
    riskScore: 2,
    reuseScore: 5,
    urgencyScore: 4,
    dataReadinessScore: 3,
    priorityScore: 88,
    expectedBenefits: ["Faster policy answers"],
    dataSources: ["Employee handbook"],
    risks: ["Outdated citation"],
    linkedSkillId: "skill-1",
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-10T12:00:00.000Z",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    useCaseId: "uc-1",
    name: "Policy Assistant",
    slug: "policy-assistant",
    description: "Drafts grounded policy answers.",
    department: "HR",
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
    systemPrompt: "Use policy context.",
    allowedTools: ["search.policy"],
    blockedTools: [],
    contextSources: ["Employee handbook"],
    evalPassRate: 87,
    adoptionCount: 30,
    valueDelivered: 15_000,
    runs: 60,
    updatedAt: "2026-06-12T12:00:00.000Z",
    ...overrides,
  };
}

function contextSource(overrides: Partial<ContextSource> = {}): ContextSource {
  return {
    id: "ctx-1",
    name: "Employee handbook",
    type: "document_library",
    classification: "internal",
    ownerDepartment: "HR",
    enabled: true,
    lastIndexedAt: "2026-05-01T12:00:00.000Z",
    documentCount: 42,
    skillsUsing: 1,
    health: "stale",
    ...overrides,
  };
}

test("deriveWorkflowOptimizationModel recommends standardization and context repair from workflow signals", () => {
  const model = deriveWorkflowOptimizationModel({
    workSignals: [signal()],
    useCases: [useCase()],
    skills: [skill()],
    runs: [],
    contextSources: [contextSource()],
  });

  ok(model.metrics.workflowsObserved >= 1);
  ok(model.recommendations.some((recommendation) => recommendation.lane === "standardize"));
  ok(model.recommendations.some((recommendation) => recommendation.lane === "agent_context"));
  ok(model.lanes.some((lane) => lane.id === "standardize" && lane.targetView === "process"));
});

test("deriveWorkflowOptimizationModel creates a seed recommendation when empty", () => {
  const model = deriveWorkflowOptimizationModel({
    workSignals: [],
    useCases: [],
    skills: [],
    runs: [],
    contextSources: [],
  });

  strictEqual(model.recommendations[0]?.id, "seed-capture-first-workflow");
  strictEqual(model.recommendations[0]?.targetView, "process");
  strictEqual(model.metrics.workflowsObserved, 0);
});
