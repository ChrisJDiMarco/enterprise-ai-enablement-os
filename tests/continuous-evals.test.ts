import assert from "node:assert/strict";
import test from "node:test";
import { deriveContinuousEvalProgram } from "../src/lib/continuous-evals.ts";
import type { Skill, WorkSignal } from "../src/lib/enterprise-ai-data.ts";

const baseSkill: Skill = {
  id: "skill-1",
  name: "Policy Copilot",
  slug: "policy-copilot",
  description: "Answers policy questions.",
  department: "HR",
  ownerId: "owner-1",
  status: "pilot",
  version: "1.0.0",
  riskLevel: "medium",
  autonomyTier: "tier_1_read_only",
  modelProvider: "mock",
  model: "mock-smart",
  temperature: 0.2,
  maxTokens: 1800,
  fallbackModel: "mock-fast",
  costLimit: 0.25,
  systemPrompt: "Use approved context only.",
  allowedTools: ["sharepoint.read_policy"],
  blockedTools: [],
  contextSources: ["HR Policy Manual"],
  evalPassRate: 92,
  adoptionCount: 100,
  valueDelivered: 1000,
  runs: 10,
  updatedAt: "2026-05-29",
};

function workSignal(overrides: Partial<WorkSignal>): WorkSignal {
  return {
    id: "sig-1",
    source: "harness",
    eventType: "context_gap",
    department: "HR",
    process: "Policy questions",
    summary: "Context gap detected.",
    metadata: { relatedSkillId: "skill-1", sentiment: "negative" },
    privacy: {
      contentRedacted: true,
      piiRedacted: true,
      consentBasis: "system_metadata",
      retentionDays: 90,
      individualScoringAllowed: false,
      rawContentStored: false,
    },
    riskLevel: "medium",
    createdAt: "2026-05-29 10:00",
    ...overrides,
  };
}

test("deriveContinuousEvalProgram marks Skills without eval evidence as overdue", () => {
  const program = deriveContinuousEvalProgram({
    skills: [baseSkill],
    runs: [],
    evalResults: [],
    workSignals: [],
  });

  assert.equal(program.status, "overdue");
  assert.equal(program.overdueSuites, 1);
  assert.equal(program.monitors[0].status, "overdue");
});

test("deriveContinuousEvalProgram detects drift from failed evals and negative signals", () => {
  const program = deriveContinuousEvalProgram({
    skills: [baseSkill],
    runs: [
      {
        id: "run-1",
        skillId: "skill-1",
        triggeredBy: "owner-1",
        status: "blocked",
        riskLevel: "medium",
        currentStage: "Output blocked",
        costUsd: 0.01,
        latencyMs: 1000,
        startedAt: "2026-05-29 10:10",
        output: "",
        trace: [],
      },
    ],
    evalResults: [
      {
        id: "eval-1",
        skillId: "skill-1",
        suiteName: "Regression",
        score: 82,
        passed: false,
        criticalFailures: 1,
        createdAt: "2026-05-29 10:20",
      },
    ],
    workSignals: [workSignal({ id: "sig-negative" })],
  });

  assert.equal(program.status, "drift");
  assert.equal(program.driftAlerts, 1);
  assert.equal(program.monitors[0].status, "drift");
});
