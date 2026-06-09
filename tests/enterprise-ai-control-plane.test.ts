import assert from "node:assert/strict";
import test from "node:test";

import {
  agentPermissionSurfaces,
  compliancePacks,
  deriveEnterpriseAiControlPlane,
  shadowAiDiscoveries,
  vendorRiskRecords,
} from "../src/lib/enterprise-ai-control-plane.ts";
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
    title: "Contract Intake Assistant",
    description: "Triage contract requests.",
    department: "Legal",
    requestorId: "u-1",
    ownerId: "u-2",
    businessProblem: "Legal intake is slow and hard to prioritize.",
    currentProcess: "Email and manual routing.",
    desiredOutcome: "Classify requests and draft reviewer packets.",
    monthlyVolume: 800,
    avgHandlingTimeMinutes: 18,
    estimatedUsers: 120,
    capabilityType: "intake_routing",
    status: "approved_for_pilot",
    riskLevel: "high",
    valueScore: 5,
    feasibilityScore: 4,
    riskScore: 4,
    reuseScore: 4,
    urgencyScore: 5,
    dataReadinessScore: 4,
    priorityScore: 88,
    expectedBenefits: ["cycle time"],
    dataSources: ["Legal intake queue"],
    risks: ["customer confidential data"],
    linkedSkillId: "skill-1",
    updatedAt: "2026-06-01",
    createdAt: "2026-06-01",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    useCaseId: "uc-1",
    name: "Contract Intake Assistant",
    slug: "contract-intake-assistant",
    description: "Creates intake summaries and routes requests.",
    department: "Legal",
    ownerId: "u-2",
    status: "pilot",
    version: "1.0.0",
    riskLevel: "high",
    autonomyTier: "tier_2_prepare_action",
    modelProvider: "openai",
    model: "gpt-5-mini",
    temperature: 0.2,
    maxTokens: 3000,
    fallbackModel: "local-enterprise-reasoner",
    costLimit: 1,
    systemPrompt: "Draft only from approved sources and request human approval for actions.",
    allowedTools: ["legal.intake.read"],
    blockedTools: ["email.send_external"],
    contextSources: ["Legal intake queue"],
    evalPassRate: 94,
    adoptionCount: 45,
    valueDelivered: 120000,
    runs: 24,
    updatedAt: "2026-06-01",
    ...overrides,
  };
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    skillId: "skill-1",
    useCaseId: "uc-1",
    triggeredBy: "u-2",
    status: "completed",
    riskLevel: "high",
    currentStage: "Completed",
    costUsd: 0.08,
    latencyMs: 1800,
    startedAt: "2026-06-01T10:00:00.000Z",
    output: "Drafted intake packet.",
    trace: [
      { label: "Request", status: "completed", detail: "Received", latencyMs: 10 },
      { label: "Identity", status: "completed", detail: "Resolved", latencyMs: 10 },
      { label: "Context", status: "completed", detail: "Permission filtered", latencyMs: 60 },
      { label: "Policy", status: "completed", detail: "Tool allowed", latencyMs: 20 },
      { label: "Model", status: "completed", detail: "Generated", latencyMs: 900 },
      { label: "Output validation", status: "completed", detail: "Passed", latencyMs: 30 },
    ],
    ...overrides,
  };
}

function review(overrides: Partial<GovernanceReview> = {}): GovernanceReview {
  return {
    id: "review-1",
    itemType: "skill",
    itemId: "skill-1",
    title: "Contract Intake Assistant review",
    department: "Legal",
    riskLevel: "high",
    reviewer: "Security",
    status: "approved_with_conditions",
    dueDate: "2026-06-10",
    blockers: [],
    ...overrides,
  };
}

function evalResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    id: "eval-1",
    skillId: "skill-1",
    suiteName: "Launch readiness",
    score: 94,
    passed: true,
    criticalFailures: 0,
    createdAt: "2026-06-01",
    ...overrides,
  };
}

function toolRequest(overrides: Partial<ToolRequest> = {}): ToolRequest {
  return {
    id: "tool-1",
    skillId: "skill-1",
    runId: "run-1",
    user: "u-2",
    toolId: "legal.intake.read",
    reason: "Read intake queue.",
    riskLevel: "medium",
    status: "approved",
    requestedAt: "2026-06-01",
    ...overrides,
  };
}

function auditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "audit-1",
    eventType: "skill_run_completed",
    actor: "AI Harness",
    message: "Contract Intake Assistant completed with policy evidence.",
    riskLevel: "low",
    createdAt: "2026-06-01",
    ...overrides,
  };
}

function workSignal(overrides: Partial<WorkSignal> = {}): WorkSignal {
  return {
    id: "signal-1",
    source: "survey",
    eventType: "feedback_given",
    department: "Legal",
    process: "Contract intake",
    summary: "Operators asked for approved AI intake support.",
    metadata: { system: "Approved AI intake", count: 12 },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: "aggregated",
      retentionDays: 30,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel: "low",
    createdAt: "2026-06-01",
    ...overrides,
  };
}

test("deriveEnterpriseAiControlPlane keeps an empty workspace honest about gaps", () => {
  const plane = deriveEnterpriseAiControlPlane();

  assert.equal(plane.posture, "uncontrolled");
  assert.ok(plane.score < 45);
  assert.equal(plane.metrics.governedAssets, 0);
  assert.ok(plane.priorityActions.some((item) => item.id === "system-of-record"));
  assert.ok(plane.capabilities.some((item) => item.id === "shadow-ai"));
});

test("deriveEnterpriseAiControlPlane scores a governed pilot as controlled", () => {
  const plane = deriveEnterpriseAiControlPlane({
    useCases: [useCase()],
    skills: [skill()],
    runs: [run()],
    governanceReviews: [review()],
    evalResults: [evalResult()],
    toolRequests: [toolRequest()],
    auditLogs: [auditLog()],
    workSignals: [workSignal()],
    providerCount: 3,
    providerReadyCount: 2,
    connectorCount: 4,
    connectorReadyCount: 3,
    metrics: { annualValue: 120000, adoptionRate: 58, hoursSaved: 1800 },
  });

  assert.ok(["controlled", "scale-ready"].includes(plane.posture));
  assert.ok(plane.metrics.complianceCoverage >= 80);
  assert.ok(plane.metrics.incidentReadiness >= 80);
  assert.ok(plane.metrics.valueConfidence >= 80);
  assert.equal(plane.capabilities.find((item) => item.id === "permissions")?.status, "ready");
});

test("enterprise control-plane static catalogs cover the enhancement surfaces", () => {
  assert.ok(shadowAiDiscoveries.some((item) => item.disposition === "block"));
  assert.ok(agentPermissionSurfaces.some((item) => item.surface === "External destinations"));
  assert.ok(vendorRiskRecords.some((item) => item.category === "Automation and agent runners"));
  assert.ok(compliancePacks.some((item) => item.name === "EU AI Act readiness"));
});
