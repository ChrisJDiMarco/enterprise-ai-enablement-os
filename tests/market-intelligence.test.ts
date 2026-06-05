import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveMarketBenchmark } from "../src/lib/market-intelligence.ts";
import type { AuditLog, EvalResult, GovernanceReview, Run, Skill, ToolRequest, UseCase } from "../src/lib/enterprise-ai-data.ts";

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "HR Policy Assistant",
    description: "Answer policy questions.",
    department: "HR",
    requestorId: "u-1",
    ownerId: "u-1",
    businessProblem: "Employees wait for policy answers.",
    currentProcess: "Email HR.",
    desiredOutcome: "Self-service answers with citations.",
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
    updatedAt: "2026-05-28T00:00:00.000Z",
    createdAt: "2026-05-28T00:00:00.000Z",
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
    systemPrompt: "Answer from approved sources.",
    allowedTools: ["sharepoint.read_policy"],
    blockedTools: ["email.send_external"],
    contextSources: ["HR Policy Manual"],
    evalPassRate: 96,
    adoptionCount: 120,
    valueDelivered: 50000,
    runs: 40,
    updatedAt: "2026-05-28T00:00:00.000Z",
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
    startedAt: "2026-05-28T00:00:00.000Z",
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
    createdAt: "2026-05-28T00:00:00.000Z",
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
    requestedAt: "2026-05-28T00:00:00.000Z",
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
    createdAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

test("deriveMarketBenchmark: empty workspace shows market gaps", () => {
  const benchmark = deriveMarketBenchmark({
    useCases: [],
    skills: [],
    governanceReviews: [],
    evalResults: [],
    runs: [],
    toolRequests: [],
    auditLogs: [],
    metrics: { adoptionRate: 0, hoursSaved: 0, annualValue: 0 },
    workflowNodeCount: 0,
    workflowStatus: "Saved",
  });

  assert.equal(benchmark.status, "gap");
  assert.equal(benchmark.patterns.length, 6);
  assert.ok(benchmark.patterns.every((item) => item.status === "gap"));
});

test("deriveMarketBenchmark: mature workspace is competitive against market patterns", () => {
  const benchmark = deriveMarketBenchmark({
    useCases: [useCase()],
    skills: [skill()],
    governanceReviews: [review(), review({ id: "gr-2", status: "in_review", blockers: ["Eval below threshold"] })],
    evalResults: [evalResult()],
    runs: [run()],
    toolRequests: [toolRequest(), toolRequest({ id: "tr-2", status: "blocked" })],
    auditLogs: [audit()],
    metrics: { adoptionRate: 62, hoursSaved: 2400, annualValue: 350000 },
    workflowNodeCount: 8,
    workflowStatus: "Published",
  });

  assert.ok(["competitive", "leading"].includes(benchmark.status));
  assert.ok(benchmark.score >= 65);
  assert.equal(benchmark.patterns.find((item) => item.id === "connector-sandbox")?.status, "leading");
  assert.equal(benchmark.patterns.find((item) => item.id === "adoption-value")?.status, "leading");
});

test("deriveMarketBenchmark: missing broker traffic makes connector sandbox the gap", () => {
  const benchmark = deriveMarketBenchmark({
    useCases: [useCase()],
    skills: [skill({ blockedTools: [], contextSources: [] })],
    governanceReviews: [],
    evalResults: [],
    runs: [],
    toolRequests: [],
    auditLogs: [],
    metrics: { adoptionRate: 0, hoursSaved: 0, annualValue: 0 },
    workflowNodeCount: 0,
    workflowStatus: "Saved",
  });

  const connector = benchmark.patterns.find((item) => item.id === "connector-sandbox");
  assert.equal(connector?.status, "gap");
  assert.match(connector?.nextAction ?? "", /trust scoring/i);
});
