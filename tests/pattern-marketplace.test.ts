import assert from "node:assert/strict";
import test from "node:test";
import { buildPatternInstallPlan, derivePatternMarketplace, starterPatternTemplates } from "../src/lib/pattern-marketplace.ts";
import type { Skill } from "../src/lib/enterprise-ai-data.ts";

const skill: Skill = {
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
  evalPassRate: 94,
  adoptionCount: 100,
  valueDelivered: 1000,
  runs: 10,
  updatedAt: "2026-05-29",
};

test("derivePatternMarketplace includes safe starter templates when workspace has no proof yet", () => {
  const marketplace = derivePatternMarketplace({
    useCases: [],
    skills: [],
    runs: [],
    evalResults: [],
    governanceReviews: [],
  });

  assert.equal(marketplace.workspacePatterns.length, 0);
  assert.equal(marketplace.starterTemplates.length, starterPatternTemplates.length);
  assert.ok(marketplace.recommended.some((pattern) => pattern.kind === "starter-template"));
});

test("derivePatternMarketplace promotes proven Skills into workspace patterns", () => {
  const marketplace = derivePatternMarketplace({
    useCases: [],
    skills: [skill],
    runs: [
      {
        id: "run-1",
        skillId: "skill-1",
        triggeredBy: "owner-1",
        status: "completed",
        riskLevel: "medium",
        currentStage: "Completed",
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
        suiteName: "Launch",
        score: 94,
        passed: true,
        criticalFailures: 0,
        createdAt: "2026-05-29 10:20",
      },
    ],
    governanceReviews: [],
  });

  assert.equal(marketplace.workspacePatterns[0].sourceSkillId, "skill-1");
  assert.equal(marketplace.workspacePatterns[0].kind, "workspace-pattern");
});

test("buildPatternInstallPlan turns a recommended pattern into an operational launch path", () => {
  const marketplace = derivePatternMarketplace({
    useCases: [],
    skills: [skill],
    runs: [],
    evalResults: [],
    governanceReviews: [],
  });
  const plan = buildPatternInstallPlan(marketplace.workspacePatterns[0]);

  assert.equal(plan.launchMode, "reuse");
  assert.ok(plan.estimatedDays <= 7);
  assert.ok(plan.steps.some((step) => step.id === "context-tools"));
  assert.ok(plan.exitCriteria.some((criterion) => criterion.includes("Eval suite")));
});
