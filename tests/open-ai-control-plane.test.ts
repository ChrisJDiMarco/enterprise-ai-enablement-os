import assert from "node:assert/strict";
import test from "node:test";
import { deriveOpenAiControlPlane } from "../src/lib/open-ai-control-plane.ts";
import type { EvalResult, Run, Skill, UseCase } from "../src/lib/enterprise-ai-data.ts";

const useCase: UseCase = {
  id: "uc-1",
  title: "Support response assistant",
  description: "Draft support replies from approved sources.",
  department: "Operations",
  requestorId: "user-1",
  ownerId: "owner-1",
  businessProblem: "Support teams spend too long finding policy answers.",
  currentProcess: "Manual search and drafting.",
  desiredOutcome: "Faster reviewed responses.",
  monthlyVolume: 1200,
  avgHandlingTimeMinutes: 18,
  estimatedUsers: 40,
  capabilityType: "Knowledge assistant",
  status: "in_pilot",
  riskLevel: "medium",
  valueScore: 4,
  feasibilityScore: 4,
  riskScore: 2,
  reuseScore: 5,
  urgencyScore: 4,
  dataReadinessScore: 4,
  priorityScore: 88,
  expectedBenefits: ["Faster cycle time"],
  dataSources: ["Knowledge base"],
  risks: ["Stale content"],
  linkedSkillId: "skill-1",
  updatedAt: "2026-06-01",
  createdAt: "2026-06-01",
};

const skill: Skill = {
  id: "skill-1",
  useCaseId: "uc-1",
  name: "Support Response Skill",
  slug: "support-response-skill",
  description: "Drafts support responses from approved knowledge.",
  department: "Operations",
  ownerId: "owner-1",
  status: "pilot",
  version: "1.0.0",
  riskLevel: "medium",
  autonomyTier: "tier_2_prepare_action",
  modelProvider: "openai",
  model: "gpt-4.1",
  temperature: 0.2,
  maxTokens: 1800,
  fallbackModel: "gpt-4.1-mini",
  costLimit: 0.4,
  systemPrompt: "Use approved support knowledge only.",
  allowedTools: ["knowledge.search"],
  blockedTools: ["email.send"],
  contextSources: ["Knowledge base"],
  evalPassRate: 92,
  adoptionCount: 120,
  valueDelivered: 50_000,
  runs: 12,
  updatedAt: "2026-06-01",
};

const run: Run = {
  id: "run-1",
  skillId: "skill-1",
  useCaseId: "uc-1",
  triggeredBy: "owner-1",
  status: "completed",
  riskLevel: "medium",
  currentStage: "Completed",
  costUsd: 0.04,
  latencyMs: 1200,
  startedAt: "2026-06-01T12:00:00Z",
  output: "Draft response.",
  trace: [
    { label: "Prompt", status: "completed", detail: "Prompt rendered", latencyMs: 100 },
    { label: "Tool", status: "completed", detail: "Knowledge searched", latencyMs: 400 },
  ],
};

const evalResult: EvalResult = {
  id: "eval-1",
  skillId: "skill-1",
  suiteName: "Launch readiness",
  score: 94,
  passed: true,
  criticalFailures: 0,
  createdAt: "2026-06-01T12:10:00Z",
};

test("deriveOpenAiControlPlane stays runtime-neutral while exposing adapter options", () => {
  const controlPlane = deriveOpenAiControlPlane({
    useCases: [useCase],
    skills: [skill],
    runs: [run],
    evalResults: [evalResult],
    governanceReviews: [],
    auditLogs: [],
    toolRequests: [],
    workSignals: [],
    contextSources: [],
    report: "",
    metrics: {
      annualValue: 50_000,
      adoptionRate: 18,
      hoursSaved: 300,
      riskItemsOpen: 0,
    },
  });

  assert.ok(controlPlane.score > 0);
  assert.ok(controlPlane.adapters.some((adapter) => adapter.id === "langfuse-adapter"));
  assert.ok(controlPlane.adapters.some((adapter) => adapter.id === "otel-agent-spans"));
  assert.equal(
    controlPlane.adapters.find((adapter) => adapter.id === "openclaw-compatible")?.status,
    "sample_profile",
  );
  assert.ok(controlPlane.templates.some((template) => template.id === "tpl-runtime-import"));
  assert.ok(controlPlane.runtimeAssets.some((asset) => asset.runtime === "Enablement OS Registry"));
});
