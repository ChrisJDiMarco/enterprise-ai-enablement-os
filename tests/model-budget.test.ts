import { test } from "node:test";
import assert from "node:assert/strict";

import {
  currentMonthRunSpend,
  evaluateModelBudget,
  estimateModelCostUsd,
} from "../src/lib/model-budget.ts";
import { defaultAISettings } from "../src/lib/model-router.ts";
import type { Run, Skill } from "../src/lib/enterprise-ai-data.ts";

const route = {
  provider: "openai",
  model: "gpt-5.4-mini",
  modelRef: "openai/gpt-5.4-mini",
  fallbackUsed: false,
  reason: "test route",
};

const skill: Skill = {
  id: "sk-1",
  useCaseId: "uc-1",
  name: "Policy Assistant",
  slug: "policy-assistant",
  description: "Answers policy questions.",
  department: "HR",
  ownerId: "u-1",
  status: "production",
  version: "1.0.0",
  riskLevel: "medium",
  autonomyTier: "tier_1_read_only",
  modelProvider: "openai",
  model: "gpt-5.4-mini",
  temperature: 0.2,
  maxTokens: 1000,
  fallbackModel: "",
  costLimit: 0.01,
  systemPrompt: "Answer from policy.",
  allowedTools: [],
  blockedTools: [],
  contextSources: [],
  evalPassRate: 90,
  adoptionCount: 10,
  valueDelivered: 100,
  runs: 1,
  updatedAt: "2026-06-01T00:00:00.000Z",
};

function run(costUsd: number, startedAt = "2026-06-01T00:00:00.000Z"): Run {
  return {
    id: `run-${costUsd}`,
    skillId: "sk-1",
    triggeredBy: "Admin",
    status: "completed",
    riskLevel: "medium",
    currentStage: "Done",
    costUsd,
    latencyMs: 100,
    startedAt,
    output: "ok",
    trace: [],
  };
}

test("estimateModelCostUsd estimates nonzero external model spend", () => {
  assert.ok(estimateModelCostUsd({ provider: "openai", inputTokens: 1000, outputTokens: 1000 }) > 0);
  assert.equal(estimateModelCostUsd({ provider: "local", inputTokens: 1000, outputTokens: 1000 }), 0);
});

test("evaluateModelBudget blocks when enforcement and monthly budget are exceeded", () => {
  const decision = evaluateModelBudget({
    settings: defaultAISettings,
    route,
    inputTokens: 100_000,
    outputTokens: 100_000,
    currentMonthlySpendUsd: 0.95,
    skill,
    env: {
      TENANT_MONTHLY_BUDGET_USD: "1",
      MODEL_BUDGET_ENFORCEMENT_ENABLED: "true",
    },
  });

  assert.equal(decision.status, "block");
  assert.equal(decision.enforcementEnabled, true);
});

test("currentMonthRunSpend ignores previous-month runs", () => {
  const spend = currentMonthRunSpend(
    [run(10, "2026-06-01T00:00:00.000Z"), run(99, "2026-05-01T00:00:00.000Z")],
    new Date("2026-06-15T00:00:00.000Z"),
  );

  assert.equal(spend, 10);
});
