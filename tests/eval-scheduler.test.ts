import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveEvalScheduleMaintenancePlan,
  deriveEvalSchedulePlan,
  evalCadenceConfigFromEnv,
} from "../src/lib/eval-scheduler.ts";
import { buildDemoWorkspace } from "../src/lib/demo/demo-workspace.ts";

test("evalCadenceConfigFromEnv describes configured and missing cadence", () => {
  const configured = evalCadenceConfigFromEnv({
    EVAL_RUNNER_URL: "https://eval.example.com",
    EVAL_SCHEDULE_CRON: "0 9 * * 1",
    EVAL_MAX_AGE_DAYS: "14",
  });
  const missing = evalCadenceConfigFromEnv({});

  assert.equal(configured.configured, true);
  assert.equal(configured.mode, "external-runner");
  assert.equal(configured.cadenceDays, 14);
  assert.equal(configured.evidence.includes("cron 0 9 * * 1"), true);
  assert.equal(missing.configured, false);
  assert.equal(missing.mode, "missing");
  assert.equal(missing.cadenceDays, 30);
});

test("deriveEvalSchedulePlan marks stale or missing evals as due", () => {
  const workspace = buildDemoWorkspace("eval-schedule-test");
  const plan = deriveEvalSchedulePlan({
    skills: workspace.skills,
    evalResults: [],
    now: new Date("2026-06-01T00:00:00.000Z"),
    env: { EVAL_MAX_AGE_DAYS: "30" },
  });

  assert.equal(plan.dueCount, workspace.skills.length);
  assert.equal(plan.items.every((item) => item.recommendedSuites.includes("regression")), true);
});

test("deriveEvalSchedulePlan blocks production skills with failed critical evals", () => {
  const workspace = buildDemoWorkspace("eval-failure-test");
  const skill = { ...workspace.skills[0], status: "production" as const };
  const plan = deriveEvalSchedulePlan({
    skills: [skill],
    evalResults: [
      {
        id: "eval-failed",
        skillId: skill.id,
        suiteName: "Launch Regression",
        score: 68,
        passed: false,
        criticalFailures: 1,
        createdAt: "2026-05-31T00:00:00.000Z",
      },
    ],
    now: new Date("2026-06-01T00:00:00.000Z"),
  });

  assert.equal(plan.blockedCount, 1);
  assert.equal(plan.items[0].priority, "critical");
});

test("deriveEvalScheduleMaintenancePlan queues blocked items but only runs due items by default", () => {
  const workspace = buildDemoWorkspace("eval-maintenance-test");
  const dueSkill = workspace.skills[0];
  const blockedSkill = { ...workspace.skills[1], status: "production" as const };
  const plan = deriveEvalSchedulePlan({
    skills: [dueSkill, blockedSkill],
    evalResults: [
      {
        id: "eval-failed",
        skillId: blockedSkill.id,
        suiteName: "Launch Regression",
        score: 68,
        passed: false,
        criticalFailures: 1,
        createdAt: "2026-05-31T00:00:00.000Z",
      },
    ],
    now: new Date("2026-06-01T00:00:00.000Z"),
  });

  const queue = deriveEvalScheduleMaintenancePlan(plan, { action: "queue_due" });
  const run = deriveEvalScheduleMaintenancePlan(plan, { action: "run_due", dryRun: false });

  assert.equal(queue.selected, 2);
  assert.equal(queue.blockedSelected, 1);
  assert.equal(run.selected, 1);
  assert.equal(run.dueSelected, 1);
  assert.equal(run.blockedSkipped, 1);
  assert.equal(run.dryRun, false);
});
