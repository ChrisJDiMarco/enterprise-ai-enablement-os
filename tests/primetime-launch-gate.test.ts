import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePrimetimeLaunchGate } from "../src/lib/primetime-launch-gate.ts";
import { deriveEnterpriseMaturity } from "../src/lib/enterprise-maturity.ts";
import { deriveIntegrationBlueprint } from "../src/lib/integration-blueprint.ts";
import type { EvalResult, GovernanceReview, Run, Skill, UseCase } from "../src/lib/enterprise-ai-data.ts";

function fixtureUseCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "HR Policy Helpdesk",
    description: "Answer policy questions.",
    department: "HR",
    requestorId: "u-1",
    businessProblem: "Employees wait for answers.",
    currentProcess: "Tickets.",
    desiredOutcome: "Governed assistant.",
    monthlyVolume: 1000,
    avgHandlingTimeMinutes: 10,
    estimatedUsers: 200,
    capabilityType: "knowledge_assistant",
    status: "approved_for_pilot",
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
    description: "Answers approved policy questions.",
    department: "HR",
    ownerId: "u-1",
    status: "pilot",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_1_read_only",
    modelProvider: "local",
    model: "local-enterprise-reasoner",
    temperature: 0.2,
    maxTokens: 2000,
    fallbackModel: "",
    costLimit: 0.5,
    systemPrompt: "Use approved policy sources only and cite every answer.",
    allowedTools: ["knowledge.search"],
    blockedTools: ["email.send_external"],
    contextSources: ["HR Policy Manual"],
    evalPassRate: 96,
    adoptionCount: 50,
    valueDelivered: 100000,
    runs: 10,
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
    costUsd: 0.02,
    latencyMs: 2400,
    startedAt: "2026-05-29T00:00:00.000Z",
    output: "Done.",
    trace: [
      { label: "Request", status: "completed", detail: "Received", latencyMs: 1 },
      { label: "Identity", status: "completed", detail: "Resolved", latencyMs: 1 },
      { label: "Context", status: "completed", detail: "Retrieved", latencyMs: 1 },
      { label: "Policy", status: "completed", detail: "Checked", latencyMs: 1 },
      { label: "Model", status: "completed", detail: "Generated", latencyMs: 1 },
      { label: "Output", status: "completed", detail: "Validated", latencyMs: 1 },
    ],
    ...overrides,
  };
}

function review(overrides: Partial<GovernanceReview> = {}): GovernanceReview {
  return {
    id: "gov-1",
    itemType: "skill",
    itemId: "skill-1",
    title: "HR Policy Helpdesk Review",
    department: "HR",
    riskLevel: "medium",
    reviewer: "Security",
    status: "approved",
    dueDate: "2026-05-29T00:00:00.000Z",
    blockers: [],
    ...overrides,
  };
}

function evalResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    id: "eval-1",
    skillId: "skill-1",
    suiteName: "Launch readiness",
    score: 96,
    passed: true,
    criticalFailures: 0,
    createdAt: "2026-05-29T00:00:00.000Z",
    ...overrides,
  };
}

function maturityAndIntegration(overrides = {}) {
  const useCases = [fixtureUseCase()];
  const skills = [skill()];
  const runs = [run()];
  const governanceReviews = [review()];
  const evalResults = [evalResult()];
  const report = "# Launch report";
  const productionReadiness = {
    status: "ready" as const,
    auth: { authRequired: true, oidcConfigured: true, localLoginEnabled: false, mode: "sso" },
    database: { mode: "postgres", configured: true, durable: true, reason: "Postgres configured." },
    connectors: { configured: true, mode: "mcp-broker" },
    workflows: { configured: true, mode: "temporal-ready" },
    blockers: [],
    warnings: [],
    ...overrides,
  };
  const enterpriseMaturity = deriveEnterpriseMaturity({
    useCases,
    skills,
    runs,
    toolRequests: [],
    auditLogs: [{ id: "a-1", eventType: "eval_run", message: "Eval passed.", actor: "System", riskLevel: "low", createdAt: "2026-05-29T00:00:00.000Z" }],
    governanceReviews,
    evalResults,
    workSignals: [],
    tools: [],
    contextSources: [],
    report,
    metrics: { annualValue: 100000, adoptionRate: 20, hoursSaved: 1200 },
    workflow: { nodeCount: 6, status: "Published", valid: true, issues: 0, warnings: 0 },
    productionReadiness,
  });
  const integrationBlueprint = deriveIntegrationBlueprint({
    tools: [],
    contextSources: [],
    useCases,
    skills,
    runs,
    toolRequests: [],
    productionReadiness,
  });

  return { useCases, skills, runs, governanceReviews, evalResults, report, productionReadiness, enterpriseMaturity, integrationBlueprint };
}

test("derivePrimetimeLaunchGate: empty workspace is blocked", () => {
  const base = maturityAndIntegration({ status: "blocked" as const, blockers: [{ id: "db", label: "Database", detail: "Missing", status: "fail" }] });
  const gate = derivePrimetimeLaunchGate({
    ...base,
    useCases: [],
    skills: [],
    runs: [],
    governanceReviews: [],
    evalResults: [],
    report: "",
    workflow: { nodeCount: 0, valid: false, issues: 1, status: "Saved" },
  });

  assert.equal(gate.status, "blocked");
  assert.ok(gate.blockers.some((item) => item.id === "portfolio"));
});

test("derivePrimetimeLaunchGate: production fallbacks stay warnings even with pilot assets", () => {
  const base = maturityAndIntegration({
    status: "degraded" as const,
    warnings: [{ id: "connectors", label: "Connector broker", detail: "Policy-only", status: "warn" }],
    connectors: { configured: false, mode: "policy-only" },
  });
  const gate = derivePrimetimeLaunchGate({
    ...base,
    workflow: { nodeCount: 6, valid: true, issues: 0, status: "Published" },
  });

  assert.notEqual(gate.status, "ready");
  assert.ok(gate.warnings.some((item) => item.id === "production-runtime" || item.id === "integration"));
});

test("derivePrimetimeLaunchGate: strong launch package has no pilot blockers", () => {
  const base = maturityAndIntegration();
  const gate = derivePrimetimeLaunchGate({
    ...base,
    workflow: { nodeCount: 6, valid: true, issues: 0, status: "Published" },
  });

  assert.equal(gate.blockers.filter((item) => item.requiredFor === "pilot").length, 0);
  assert.ok(gate.score >= 70);
});
