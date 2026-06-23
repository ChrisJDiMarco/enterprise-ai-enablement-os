import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveGovernanceProof } from "../src/lib/governance-proof.ts";
import type { EvalResult, GovernanceReview, Run, Skill } from "../src/lib/enterprise-ai-data.ts";

const review: GovernanceReview = {
  id: "gr-1",
  itemType: "skill",
  itemId: "sk-1",
  title: "HR Copilot",
  department: "HR",
  riskLevel: "medium",
  reviewer: "Risk",
  status: "in_review",
  dueDate: "2026-07-01",
  blockers: [],
};

const skill = {
  id: "sk-1",
  allowedTools: ["a", "b"],
  contextSources: ["c"],
  evalPassRate: 88,
  autonomyTier: "tier_1_read_only",
  status: "in_review",
} as unknown as Skill;

function run(id: string, status: Run["status"], startedAt: string): Run {
  return { id, skillId: "sk-1", triggeredBy: "t", status, riskLevel: "low", currentStage: "x", costUsd: 0, latencyMs: 1, startedAt, output: "", trace: [] };
}

test("deriveGovernanceProof surfaces the linked Skill's real run/eval/tool/context proof", () => {
  const runs = [run("r1", "completed", "2026-06-01T00:00:00Z"), run("r2", "blocked", "2026-06-02T00:00:00Z")];
  const evals: EvalResult[] = [
    { id: "e1", skillId: "sk-1", suiteName: "regression", score: 91, passed: true, criticalFailures: 0, createdAt: "2026-06-02T00:00:00Z" },
    { id: "e2", skillId: "other", suiteName: "x", score: 10, passed: false, criticalFailures: 3, createdAt: "2026-06-03T00:00:00Z" },
  ];
  const proof = deriveGovernanceProof({ review, skills: [skill], runs, evalResults: evals });
  assert.equal(proof.skillFound, true);
  assert.equal(proof.totalRuns, 2);
  assert.equal(proof.completedRuns, 1);
  assert.equal(proof.blockedRuns, 1);
  assert.equal(proof.latestRunStatus, "blocked");
  assert.equal(proof.evalCount, 1, "only the linked skill's evals count");
  assert.equal(proof.latestEvalScore, 91);
  assert.equal(proof.toolCount, 2);
  assert.equal(proof.contextCount, 1);
});

test("deriveGovernanceProof reports skillFound=false for an unmatched review", () => {
  const proof = deriveGovernanceProof({ review: { ...review, itemId: "missing" }, skills: [skill], runs: [], evalResults: [] });
  assert.equal(proof.skillFound, false);
  assert.equal(proof.totalRuns, 0);
  assert.equal(proof.toolCount, 0);
});
