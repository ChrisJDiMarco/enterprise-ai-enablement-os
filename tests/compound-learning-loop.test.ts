import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveCompoundLearningLoop } from "../src/lib/compound-learning-loop.ts";
import type {
  AuditLog,
  EvalResult,
  GovernanceReview,
  Run,
  Skill,
  ToolRequest,
  UseCase,
  WorkSignal,
} from "../src/lib/enterprise-ai-data.ts";

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "HR Policy Assistant",
    description: "Answer employee policy questions with citations.",
    department: "HR",
    requestorId: "u-1",
    ownerId: "u-1",
    businessProblem: "Employees wait too long for repetitive HR policy answers.",
    currentProcess: "Employees email HR or open tickets.",
    desiredOutcome: "Self-service answers with approved sources and escalation.",
    monthlyVolume: 1200,
    avgHandlingTimeMinutes: 6,
    estimatedUsers: 400,
    capabilityType: "knowledge_assistant",
    status: "measuring",
    riskLevel: "medium",
    valueScore: 5,
    feasibilityScore: 4,
    riskScore: 2.5,
    reuseScore: 5,
    urgencyScore: 4,
    dataReadinessScore: 4,
    priorityScore: 88,
    expectedBenefits: ["hours saved"],
    dataSources: ["HR Policy Manual"],
    risks: ["hallucination"],
    linkedSkillId: "sk-1",
    updatedAt: "2026-05-29T00:00:00.000Z",
    createdAt: "2026-05-29T00:00:00.000Z",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "sk-1",
    useCaseId: "uc-1",
    name: "HR Policy Assistant",
    slug: "hr-policy-assistant",
    description: "Governed HR answers.",
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
    systemPrompt:
      "Answer only from approved HR policy sources. Cite sources, avoid inventing policy, and escalate ambiguous employee-impact cases.",
    allowedTools: ["sharepoint.read_policy"],
    blockedTools: ["email.send_external"],
    contextSources: ["HR Policy Manual"],
    evalPassRate: 96,
    adoptionCount: 120,
    valueDelivered: 50000,
    runs: 40,
    updatedAt: "2026-05-29T00:00:00.000Z",
    ...overrides,
  };
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    skillId: "sk-1",
    useCaseId: "uc-1",
    triggeredBy: "u-1",
    status: "completed",
    riskLevel: "medium",
    currentStage: "Completed",
    costUsd: 0.04,
    latencyMs: 1400,
    startedAt: "2026-05-29T00:00:00.000Z",
    output: "Complete.",
    trace: [
      { label: "Request received", detail: "Accepted", status: "completed", latencyMs: 10 },
      { label: "Identity resolved", detail: "RBAC checked", status: "completed", latencyMs: 10 },
      { label: "Context retrieved", detail: "Permission filtered", status: "completed", latencyMs: 100 },
      { label: "Policy check", detail: "Tool allowed", status: "completed", latencyMs: 20 },
      { label: "Model call", detail: "Generated response", status: "completed", latencyMs: 800 },
      { label: "Output validation", detail: "Grounding passed", status: "completed", latencyMs: 30 },
    ],
    ...overrides,
  };
}

function review(overrides: Partial<GovernanceReview> = {}): GovernanceReview {
  return {
    id: "gr-1",
    itemType: "skill",
    itemId: "sk-1",
    title: "HR Policy Assistant",
    department: "HR",
    riskLevel: "medium",
    reviewer: "u-2",
    status: "approved",
    dueDate: "2026-06-01",
    blockers: [],
    ...overrides,
  };
}

function evalResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    id: "eval-1",
    skillId: "sk-1",
    suiteName: "Launch readiness",
    score: 96,
    passed: true,
    criticalFailures: 0,
    createdAt: "2026-05-29T00:00:00.000Z",
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
    status: "approved",
    requestedAt: "2026-05-29T00:00:00.000Z",
    ...overrides,
  };
}

function audit(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "audit-1",
    eventType: "tool_approved",
    message: "Tool approval recorded.",
    actor: "Harness",
    riskLevel: "low",
    createdAt: "2026-05-29T00:00:00.000Z",
    ...overrides,
  };
}

function workSignal(overrides: Partial<WorkSignal> = {}): WorkSignal {
  return {
    id: "ws-1",
    source: "service_now",
    eventType: "workflow_delayed",
    department: "HR",
    process: "Policy support",
    summary: "Aggregated HR policy tickets show repetitive questions and delay.",
    metadata: { volume: 1200, delayHours: 48, confidence: 0.86 },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: "aggregated",
      retentionDays: 90,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel: "low",
    createdAt: "2026-05-29T00:00:00.000Z",
    ...overrides,
  };
}

function baseInput() {
  return {
    useCases: [] as UseCase[],
    skills: [] as Skill[],
    runs: [] as Run[],
    toolRequests: [] as ToolRequest[],
    auditLogs: [] as AuditLog[],
    governanceReviews: [] as GovernanceReview[],
    evalResults: [] as EvalResult[],
    workSignals: [] as WorkSignal[],
    report: "",
    metrics: { annualValue: 0, adoptionRate: 0, hoursSaved: 0, riskItemsOpen: 0 },
    workflow: { nodeCount: 0, status: "Saved" as const, valid: false },
  };
}

test("deriveCompoundLearningLoop: empty workspace starts with the opportunity engine", () => {
  const loop = deriveCompoundLearningLoop(baseInput());

  assert.equal(loop.status, "empty");
  assert.equal(loop.score, 0);
  assert.equal(loop.stages.length, 6);
  assert.equal(loop.autopilotMoves[0]?.targetView, "factory");
  assert.match(loop.summary, /No compounding loop/i);
});

test("deriveCompoundLearningLoop: governed workspace becomes an operating loop", () => {
  const loop = deriveCompoundLearningLoop({
    ...baseInput(),
    useCases: [
      useCase(),
      useCase({ id: "uc-2", department: "Finance", title: "Finance Close Assistant", priorityScore: 82, linkedSkillId: "sk-2" }),
      useCase({ id: "uc-3", department: "Legal", title: "Legal Intake Triage", priorityScore: 78, linkedSkillId: "sk-3" }),
    ],
    skills: [
      skill(),
      skill({ id: "sk-2", department: "Finance", status: "pilot", adoptionCount: 30, valueDelivered: 120000 }),
      skill({ id: "sk-3", department: "Cross-Functional", status: "approved", adoptionCount: 20, valueDelivered: 70000 }),
    ],
    runs: [run(), run({ id: "run-2", skillId: "sk-2" })],
    toolRequests: [toolRequest(), toolRequest({ id: "tr-2", runId: "run-2", status: "blocked" })],
    auditLogs: [audit(), audit({ id: "audit-2", eventType: "eval_run" })],
    governanceReviews: [review(), review({ id: "gr-2", itemId: "sk-2", status: "approved_with_conditions" })],
    evalResults: [evalResult(), evalResult({ id: "eval-2", skillId: "sk-2", score: 93 })],
    workSignals: [workSignal(), workSignal({ id: "ws-2", department: "Finance", process: "Close" })],
    report: "# Weekly AI Enablement Brief",
    metrics: { annualValue: 240000, adoptionRate: 58, hoursSaved: 3600, riskItemsOpen: 1 },
    workflow: { nodeCount: 9, status: "Published", valid: true },
  });

  assert.ok(["operating", "compounding"].includes(loop.status));
  assert.ok(loop.score >= 65);
  assert.equal(loop.moatSignals.length, 4);
  assert.ok(loop.stages.find((stage) => stage.id === "trust")?.score ?? 0 >= 80);
});

test("deriveCompoundLearningLoop: missing runtime traces points operators to the Harness", () => {
  const loop = deriveCompoundLearningLoop({
    ...baseInput(),
    useCases: [useCase()],
    skills: [skill()],
    governanceReviews: [review()],
    evalResults: [evalResult()],
    workSignals: [workSignal()],
    report: "# Brief",
    metrics: { annualValue: 50000, adoptionRate: 20, hoursSaved: 500, riskItemsOpen: 0 },
    workflow: { nodeCount: 6, status: "Testing", valid: true },
  });

  assert.equal(loop.weakestStage.id, "instrument");
  assert.equal(loop.autopilotMoves[0]?.targetView, "harness");
  assert.match(loop.autopilotMoves[0]?.body ?? "", /trace/i);
});
