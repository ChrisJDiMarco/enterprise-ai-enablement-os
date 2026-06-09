import assert from "node:assert/strict";
import test from "node:test";
import type {
  AuditLog,
  EvalResult,
  GovernanceReview,
  Run,
  Skill,
  UseCase,
  WorkSignal,
} from "../src/lib/enterprise-ai-data.ts";
import { deriveOperatingModel } from "../src/lib/ui/operating-model.ts";

const baseMetrics = {
  totalUseCases: 0,
  activePilots: 0,
  skills: 0,
  adoptionRate: 0,
  hoursSaved: 0,
  riskItemsOpen: 0,
  annualValue: 0,
};

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "Policy Self-Service",
    description: "Reduce repetitive policy questions.",
    department: "HR",
    requestorId: "requestor-1",
    ownerId: "owner-1",
    businessProblem: "Employees wait too long for policy answers.",
    currentProcess: "Employees email HR.",
    desiredOutcome: "Answers are grounded and fast.",
    monthlyVolume: 1200,
    avgHandlingTimeMinutes: 8,
    estimatedUsers: 400,
    capabilityType: "knowledge_assistant",
    status: "approved_for_pilot",
    riskLevel: "medium",
    valueScore: 5,
    feasibilityScore: 4,
    riskScore: 2,
    reuseScore: 5,
    urgencyScore: 4,
    dataReadinessScore: 4,
    priorityScore: 92,
    expectedBenefits: ["hours_saved"],
    dataSources: ["HR Policy Manual"],
    risks: ["hallucination"],
    linkedSkillId: "skill-1",
    updatedAt: "2026-05-29",
    createdAt: "2026-05-29",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    useCaseId: "uc-1",
    name: "Policy Self-Service",
    slug: "policy-self-service",
    description: "Answers approved policy questions.",
    department: "HR",
    ownerId: "owner-1",
    status: "pilot",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_1_read_only",
    modelProvider: "openai",
    model: "gpt-5-mini",
    temperature: 0.2,
    maxTokens: 2000,
    fallbackModel: "openrouter/auto",
    costLimit: 0.25,
    systemPrompt: "Answer only from approved sources and cite evidence.",
    allowedTools: ["sharepoint.read_policy"],
    blockedTools: ["email.send_external"],
    contextSources: ["HR Policy Manual"],
    evalPassRate: 96,
    adoptionCount: 300,
    valueDelivered: 50000,
    runs: 12,
    updatedAt: "2026-05-29",
    ...overrides,
  };
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    skillId: "skill-1",
    useCaseId: "uc-1",
    triggeredBy: "user-1",
    status: "completed",
    riskLevel: "medium",
    currentStage: "Completed",
    costUsd: 0.02,
    latencyMs: 2200,
    startedAt: "2026-05-29 10:00",
    output: "Answered with citations.",
    trace: [
      { label: "Request", status: "completed", detail: "Received", latencyMs: 10 },
      { label: "Identity", status: "completed", detail: "Resolved", latencyMs: 10 },
      { label: "Context", status: "completed", detail: "Retrieved", latencyMs: 10 },
      { label: "Policy", status: "completed", detail: "Allowed", latencyMs: 10 },
    ],
    ...overrides,
  };
}

function evalResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    id: "eval-1",
    skillId: "skill-1",
    suiteName: "Launch Readiness",
    score: 96,
    passed: true,
    criticalFailures: 0,
    createdAt: "2026-05-29",
    ...overrides,
  };
}

function governanceReview(overrides: Partial<GovernanceReview> = {}): GovernanceReview {
  return {
    id: "gov-1",
    itemType: "skill",
    itemId: "skill-1",
    title: "Policy Self-Service review",
    department: "HR",
    riskLevel: "medium",
    reviewer: "Security",
    status: "approved",
    dueDate: "2026-06-01",
    blockers: [],
    ...overrides,
  };
}

function auditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "audit-1",
    eventType: "skill_run_completed",
    message: "Policy Self-Service completed with approved controls.",
    actor: "Policy Self-Service",
    riskLevel: "low",
    createdAt: "2026-05-29",
    ...overrides,
  };
}

function workSignal(overrides: Partial<WorkSignal> = {}): WorkSignal {
  return {
    id: "signal-1",
    source: "service_now",
    eventType: "question_asked",
    department: "HR",
    process: "Policy support",
    summary: "High-volume HR policy questions.",
    metadata: { volume: 1200, relatedUseCaseId: "uc-1" },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: "aggregated",
      retentionDays: 30,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel: "low",
    createdAt: "2026-05-29",
    ...overrides,
  };
}

test("deriveOperatingModel keeps an empty workspace focused on the first business signal", () => {
  const model = deriveOperatingModel({
    useCases: [],
    skills: [],
    runs: [],
    evalResults: [],
    governanceReviews: [],
    auditLogs: [],
    metrics: baseMetrics,
  });

  assert.equal(model.initiative.title, "First governed AI initiative");
  assert.equal(model.nextStage?.id, "signal");
  assert.equal(model.nextProof?.id, "work-signal");
  assert.equal(model.completionScore, 0);
  assert.equal(model.proofScore, 0);
});

test("deriveOperatingModel follows the selected use case through Skill, trace, eval, review, proof, and ROI", () => {
  const selectedUseCase = useCase({ id: "uc-selected", linkedSkillId: "skill-selected", priorityScore: 70 });
  const selectedSkill = skill({ id: "skill-selected", useCaseId: "uc-selected", name: "Selected Intake Assistant" });
  const model = deriveOperatingModel({
    useCases: [useCase({ id: "uc-top", linkedSkillId: undefined, priorityScore: 99 }), selectedUseCase],
    skills: [selectedSkill],
    runs: [run({ skillId: "skill-selected", useCaseId: "uc-selected" })],
    evalResults: [evalResult({ skillId: "skill-selected" })],
    governanceReviews: [governanceReview({ itemId: "skill-selected" })],
    auditLogs: [auditLog({ actor: "Selected Intake Assistant", message: "Selected Intake Assistant completed." })],
    workSignals: [workSignal({ metadata: { relatedUseCaseId: "uc-selected", volume: 800 } })],
    metrics: { ...baseMetrics, totalUseCases: 2, activePilots: 1, skills: 1, annualValue: 120000 },
    workflowNodeCount: 4,
    workflowStatus: "Published",
    selectedUseCase,
  });

  assert.equal(model.initiative.useCase?.id, "uc-selected");
  assert.equal(model.initiative.skill?.id, "skill-selected");
  assert.equal(model.initiative.title, "Selected Intake Assistant");
  assert.equal(model.completionScore, 100);
  assert.equal(model.proofScore, 100);
  assert.equal(model.nextProof?.id, "value-story");
  assert.equal(model.controlPlane.find((item) => item.label === "Proof")?.value, "4");
});
