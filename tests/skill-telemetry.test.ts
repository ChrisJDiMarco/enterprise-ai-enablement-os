import { test } from "node:test";
import assert from "node:assert/strict";

import type { Run, Skill, UseCase } from "../src/lib/enterprise-ai-data.ts";
import { buildRoiRows } from "../src/lib/roi-model.ts";
import { deriveSkillTelemetry } from "../src/lib/skill-telemetry.ts";

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    useCaseId: "uc-1",
    name: "Policy Copilot",
    slug: "policy-copilot",
    description: "Answers policy questions.",
    department: "HR",
    ownerId: "user-1",
    status: "pilot",
    version: "1.0.0",
    riskLevel: "medium",
    autonomyTier: "tier_1_read_only",
    modelProvider: "openai",
    model: "openai/gpt-5.4-mini",
    temperature: 0.2,
    maxTokens: 1800,
    fallbackModel: "openrouter/auto",
    costLimit: 0.25,
    systemPrompt: "You are the Policy Copilot.",
    allowedTools: [],
    blockedTools: [],
    contextSources: [],
    evalPassRate: 92,
    adoptionCount: 1840,
    valueDelivered: 50000,
    runs: 5210,
    updatedAt: "2026-06-02",
    ...overrides,
  };
}

function makeUseCase(overrides: Partial<UseCase> = {}): UseCase {
  return {
    id: "uc-1",
    title: "Policy answers",
    description: "x",
    department: "HR",
    requestorId: "user-1",
    ownerId: "user-1",
    businessProblem: "x",
    currentProcess: "x",
    desiredOutcome: "x",
    monthlyVolume: 100,
    avgHandlingTimeMinutes: 30,
    estimatedUsers: 50,
    capabilityType: "knowledge_assistant",
    status: "scaled",
    riskLevel: "medium",
    valueScore: 4,
    feasibilityScore: 4,
    riskScore: 3,
    reuseScore: 4,
    urgencyScore: 3,
    dataReadinessScore: 4,
    priorityScore: 70,
    expectedBenefits: [],
    dataSources: [],
    risks: [],
    updatedAt: "2026-06-02",
    createdAt: "2026-06-02",
    ...overrides,
  };
}

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: `run-${Math.round(Math.random() * 1e9)}`,
    skillId: "skill-1",
    triggeredBy: "user-a",
    status: "completed",
    riskLevel: "medium",
    currentStage: "Response Delivered",
    costUsd: 0.02,
    latencyMs: 800,
    startedAt: "2026-06-02",
    output: "ok",
    trace: [],
    executionMode: "live",
    ...overrides,
  };
}

test("deriveSkillTelemetry: runs counts only this skill's runs", () => {
  const skill = makeSkill();
  const runs = [makeRun({ id: "r1" }), makeRun({ id: "r2" }), makeRun({ id: "r3", skillId: "other" })];
  const t = deriveSkillTelemetry(skill, runs, makeUseCase());
  assert.equal(t.runs, 2);
});

test("deriveSkillTelemetry: adoptionCount is distinct triggeredBy", () => {
  const skill = makeSkill();
  const runs = [
    makeRun({ id: "r1", triggeredBy: "user-a" }),
    makeRun({ id: "r2", triggeredBy: "user-a" }),
    makeRun({ id: "r3", triggeredBy: "user-b" }),
  ];
  const t = deriveSkillTelemetry(skill, runs, makeUseCase());
  assert.equal(t.adoptionCount, 2);
});

test("deriveSkillTelemetry: value accrues only on completed LIVE runs, via roi-model", () => {
  const skill = makeSkill();
  const useCase = makeUseCase();
  const runs = [
    makeRun({ id: "r1", status: "completed", executionMode: "live" }),
    makeRun({ id: "r2", status: "completed", executionMode: "live" }),
    makeRun({ id: "r3", status: "blocked", executionMode: "live" }), // not completed
    makeRun({ id: "r4", status: "completed", executionMode: "simulated" }), // not live
  ];
  const t = deriveSkillTelemetry(skill, runs, useCase);

  const expectedPerRun = buildRoiRows([useCase])[0]!.expected / (useCase.monthlyVolume * 12);
  assert.equal(t.valueDelivered, Math.round(expectedPerRun * 2));
  assert.equal(t.runs, 4);
  assert.equal(t.provenance, "modeled");
});

test("deriveSkillTelemetry: runs but no live value keeps the self-assessed baseline", () => {
  const skill = makeSkill({ valueDelivered: 50000 });
  const runs = [makeRun({ id: "r1", status: "completed", executionMode: "simulated" })];
  const t = deriveSkillTelemetry(skill, runs, makeUseCase());
  assert.equal(t.valueDelivered, 50000);
  assert.equal(t.provenance, "self-assessed");
  assert.equal(t.runs, 1);
});

test("deriveSkillTelemetry: no runs falls back to stored baseline, runs honestly 0", () => {
  const skill = makeSkill({ valueDelivered: 12000, adoptionCount: 9 });
  const t = deriveSkillTelemetry(skill, [], makeUseCase());
  assert.equal(t.runs, 0);
  assert.equal(t.valueDelivered, 12000);
  assert.equal(t.adoptionCount, 9);
  assert.equal(t.provenance, "self-assessed");
});

test("deriveSkillTelemetry: no use case means no modeled value even with live runs", () => {
  const skill = makeSkill({ valueDelivered: 7000 });
  const runs = [makeRun({ id: "r1", status: "completed", executionMode: "live" })];
  const t = deriveSkillTelemetry(skill, runs, undefined);
  assert.equal(t.valueDelivered, 7000);
  assert.equal(t.provenance, "self-assessed");
});

test("deriveSkillTelemetry: illustrative (demo) keeps seeded numbers, labeled seeded", () => {
  const skill = makeSkill({ runs: 5210, adoptionCount: 1840, valueDelivered: 412000 });
  const runs = [makeRun({ id: "r1" })]; // a single ledger run that would otherwise crater the demo
  const t = deriveSkillTelemetry(skill, runs, makeUseCase(), { illustrative: true });
  assert.equal(t.runs, 5210);
  assert.equal(t.adoptionCount, 1840);
  assert.equal(t.valueDelivered, 412000);
  assert.equal(t.provenance, "seeded");
});
