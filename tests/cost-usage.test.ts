import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveCostUsage } from "../src/lib/cost-usage.ts";
import type { Run } from "../src/lib/enterprise-ai-data.ts";

const now = new Date("2026-06-15T12:00:00.000Z");

function makeRun(overrides: Partial<Run>): Run {
  return {
    id: "run-1",
    skillId: "sk-1",
    triggeredBy: "tester",
    status: "completed",
    riskLevel: "low",
    currentStage: "Response Delivered",
    costUsd: 0,
    latencyMs: 100,
    startedAt: "2026-06-10T09:00:00.000Z",
    output: "ok",
    trace: [],
    executionMode: "live",
    ...overrides,
  };
}

test("deriveCostUsage sums current-month spend and ranks skills", () => {
  const usage = deriveCostUsage({
    now,
    monthlyBudgetUsd: 1000,
    runs: [
      makeRun({ id: "r1", skillId: "sk-a", costUsd: 120 }),
      makeRun({ id: "r2", skillId: "sk-a", costUsd: 30 }),
      makeRun({ id: "r3", skillId: "sk-b", costUsd: 50 }),
      makeRun({ id: "r4", skillId: "sk-c", costUsd: 999, startedAt: "2026-05-20T09:00:00.000Z" }), // prior month, excluded
    ],
  });
  assert.equal(usage.monthToDateUsd, 200);
  assert.equal(usage.monthlyBudgetUsd, 1000);
  assert.equal(usage.remainingUsd, 800);
  assert.equal(usage.percentUsed, 20);
  assert.equal(usage.monthRunCount, 3);
  assert.equal(usage.topSkills[0]?.skillId, "sk-a");
  assert.equal(usage.topSkills[0]?.costUsd, 150);
});

test("deriveCostUsage projects month-end and runway from current burn", () => {
  const usage = deriveCostUsage({ now, monthlyBudgetUsd: 1000, runs: [makeRun({ costUsd: 300 })] });
  // 300 over 15 days = 20/day; June has 30 days -> projected 600.
  assert.equal(usage.daysElapsed, 15);
  assert.equal(usage.daysInMonth, 30);
  assert.equal(usage.projectedMonthEndUsd, 600);
  assert.equal(usage.runwayDays, 35); // remaining 700 / 20 per day
  assert.equal(usage.projectedOverBudget, false);
});

test("deriveCostUsage flags over-budget and handles no configured budget", () => {
  const over = deriveCostUsage({ now, monthlyBudgetUsd: 100, runs: [makeRun({ costUsd: 250 })] });
  assert.equal(over.overBudget, true);
  assert.equal(over.remainingUsd, -150);

  const noBudget = deriveCostUsage({ now, runs: [makeRun({ costUsd: 80 })] });
  assert.equal(noBudget.monthlyBudgetUsd, 0);
  assert.equal(noBudget.percentUsed, 0);
  assert.equal(noBudget.runwayDays, null);
});
