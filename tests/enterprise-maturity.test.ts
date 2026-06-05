import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveEnterpriseMaturity } from "../src/lib/enterprise-maturity.ts";
import type {
  AuditLog,
  ContextSource,
  EvalResult,
  GovernanceReview,
  Run,
  Skill,
  Tool,
  ToolRequest,
  UseCase,
  WorkSignal,
} from "../src/lib/enterprise-ai-data.ts";
import type { ProductionReadiness } from "../src/lib/ui/types.ts";

const now = "2026-05-28T00:00:00.000Z";

function useCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "HR Policy Copilot",
    description: "Answers HR questions from approved sources.",
    department: "HR",
    requestorId: "u-1",
    businessProblem: "Employees wait on repeated policy questions.",
    currentProcess: "Tickets and shared inbox.",
    desiredOutcome: "Instant grounded answers.",
    monthlyVolume: 1000,
    avgHandlingTimeMinutes: 8,
    estimatedUsers: 400,
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
    risks: ["Employee impact"],
    linkedSkillId: "sk-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "sk-1",
    useCaseId: "uc-1",
    name: "HR Policy Copilot",
    slug: "hr-policy-copilot",
    description: "Grounded HR policy support.",
    department: "HR",
    ownerId: "u-1",
    status: "pilot",
    version: "1.2.0",
    riskLevel: "medium",
    autonomyTier: "tier_1_read_only",
    modelProvider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 2400,
    fallbackModel: "local",
    costLimit: 1,
    systemPrompt: "You answer employee policy questions using only approved, cited HR policy sources and escalate ambiguity.",
    allowedTools: ["sharepoint.read_policy"],
    blockedTools: ["workday.update_employee"],
    contextSources: ["HR Policy Manual"],
    evalPassRate: 96,
    adoptionCount: 120,
    valueDelivered: 180000,
    runs: 14,
    updatedAt: now,
    ...overrides,
  };
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    skillId: "sk-1",
    triggeredBy: "u-1",
    status: "completed",
    riskLevel: "medium",
    currentStage: "Complete",
    costUsd: 0.04,
    latencyMs: 3200,
    startedAt: now,
    output: "Completed.",
    trace: [
      { label: "Identity resolved", detail: "Role checked", latencyMs: 20, status: "completed" },
      { label: "Context retrieved", detail: "Approved HR source", latencyMs: 300, status: "completed" },
      { label: "Policy check", detail: "Permission allowed", latencyMs: 50, status: "completed" },
      { label: "Model generated", detail: "Grounded answer", latencyMs: 900, status: "completed" },
      { label: "Output validation", detail: "Safety and citation checks passed", latencyMs: 70, status: "completed" },
      { label: "Audit logged", detail: "Evidence written", latencyMs: 30, status: "completed" },
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
    reason: "Read approved HR policy source.",
    riskLevel: "medium",
    status: "approved",
    requestedAt: now,
    ...overrides,
  };
}

function tool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: "sharepoint.read_policy",
    displayName: "Read HR policy",
    description: "Read approved HR policy content.",
    category: "document",
    actionType: "read",
    riskLevel: "low",
    requiresApprovalByDefault: false,
    enabled: true,
    usage: 24,
    lastUsed: now,
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
    lastIndexedAt: now,
    documentCount: 42,
    skillsUsing: 1,
    health: "healthy",
    ...overrides,
  };
}

function review(overrides: Partial<GovernanceReview> = {}): GovernanceReview {
  return {
    id: "gov-1",
    itemType: "skill",
    itemId: "sk-1",
    title: "HR Policy Copilot",
    department: "HR",
    riskLevel: "medium",
    reviewer: "Security",
    status: "approved",
    dueDate: "2026-05-29",
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
    createdAt: now,
    ...overrides,
  };
}

function auditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "audit-1",
    eventType: "workflow_run_started",
    message: "Run completed with policy evidence.",
    actor: "System",
    riskLevel: "low",
    createdAt: now,
    ...overrides,
  };
}

function workSignal(overrides: Partial<WorkSignal> = {}): WorkSignal {
  return {
    id: "sig-1",
    source: "service_now",
    eventType: "question_asked",
    department: "HR",
    process: "HR policy support",
    summary: "Aggregated policy questions show repeated PTO confusion.",
    metadata: { volume: 1200, confidence: 0.9 },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: "aggregated",
      retentionDays: 90,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel: "low",
    createdAt: now,
    ...overrides,
  };
}

function readiness(overrides: Partial<ProductionReadiness> = {}): ProductionReadiness {
  return {
    status: "ready",
    blockers: [],
    warnings: [],
    database: { mode: "postgres", configured: true, durable: true, reason: "Postgres configured." },
    auth: { authRequired: true, oidcConfigured: true, localLoginEnabled: false, mode: "sso" },
    connectors: { configured: true, mode: "mcp-broker" },
    workflows: { configured: true, mode: "temporal-ready" },
    ...overrides,
  };
}

test("deriveEnterpriseMaturity: empty workspace identifies setup gaps", () => {
  const maturity = deriveEnterpriseMaturity({
    useCases: [],
    skills: [],
    runs: [],
    toolRequests: [],
    auditLogs: [],
    governanceReviews: [],
    evalResults: [],
    workSignals: [],
    tools: [],
    contextSources: [],
    report: "",
    metrics: { annualValue: 0, adoptionRate: 0, hoursSaved: 0 },
    workflow: { nodeCount: 0, status: "Saved", valid: true, issues: 0, warnings: 0 },
    productionReadiness: null,
  });

  assert.equal(maturity.pillars.length, 10);
  assert.equal(maturity.status, "gap");
  assert.ok(maturity.score < 42);
  assert.equal(maturity.highestLeveragePillar.status, "gap");
});

test("deriveEnterpriseMaturity: mature workspace reaches strong or elite posture", () => {
  const maturity = deriveEnterpriseMaturity({
    useCases: [useCase(), useCase({ id: "uc-2", department: "Finance", linkedSkillId: "sk-2" }), useCase({ id: "uc-3", department: "Legal", linkedSkillId: "sk-3" })],
    skills: [skill(), skill({ id: "sk-2", status: "production" }), skill({ id: "sk-3", department: "Legal" })],
    runs: [run(), run({ id: "run-2" })],
    toolRequests: [toolRequest(), toolRequest({ id: "tr-2", status: "blocked", riskLevel: "high" })],
    auditLogs: [auditLog(), auditLog({ id: "audit-2" })],
    governanceReviews: [review(), review({ id: "gov-2", status: "approved_with_conditions" })],
    evalResults: [evalResult(), evalResult({ id: "eval-2" })],
    workSignals: [workSignal()],
    tools: [tool()],
    contextSources: [contextSource()],
    report: "Executive brief",
    metrics: { annualValue: 360000, adoptionRate: 42, hoursSaved: 5294 },
    workflow: { nodeCount: 8, status: "Published", valid: true, issues: 0, warnings: 0 },
    productionReadiness: readiness(),
  });

  assert.ok(["strong", "elite"].includes(maturity.status));
  assert.ok(maturity.score >= 68);
  assert.ok(maturity.pillars.every((pillar) => pillar.score >= 50));
});

test("deriveEnterpriseMaturity: unsafe work signals do not count as adoption evidence", () => {
  const maturity = deriveEnterpriseMaturity({
    useCases: [useCase()],
    skills: [skill({ valueDelivered: 0, adoptionCount: 0 })],
    runs: [],
    toolRequests: [],
    auditLogs: [],
    governanceReviews: [],
    evalResults: [],
    workSignals: [workSignal({ privacy: { ...workSignal().privacy, contentRedacted: false } })],
    tools: [],
    contextSources: [],
    report: "",
    metrics: { annualValue: 0, adoptionRate: 0, hoursSaved: 0 },
    workflow: { nodeCount: 0, status: "Saved", valid: true, issues: 0, warnings: 0 },
    productionReadiness: null,
  });

  const adoption = maturity.pillars.find((pillar) => pillar.id === "adoption-value");
  assert.equal(adoption?.score, 0);
});
