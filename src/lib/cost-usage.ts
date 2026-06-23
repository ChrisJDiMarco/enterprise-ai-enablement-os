import type { Run } from "./enterprise-ai-data.ts";

/**
 * Operator-facing month-to-date cost & usage, derived from the real run ledger +
 * the configured monthly budget. Budget is already enforced server-side
 * (model-budget.ts); this surfaces the numbers an AI-program owner checks daily
 * and that the app otherwise hides entirely.
 */
export type CostUsageSkillSpend = {
  skillId: string;
  costUsd: number;
  runCount: number;
};

export type CostUsage = {
  monthToDateUsd: number;
  monthlyBudgetUsd: number; // 0 = not configured
  remainingUsd: number; // budget - mtd (can be negative when over)
  percentUsed: number; // 0..100+, 0 when no budget configured
  projectedMonthEndUsd: number; // straight-line from current burn
  daysElapsed: number;
  daysInMonth: number;
  runwayDays: number | null; // days until budget exhausted at current burn; null if no budget/no burn
  overBudget: boolean;
  projectedOverBudget: boolean;
  monthRunCount: number;
  liveRunCount: number;
  topSkills: CostUsageSkillSpend[];
};

export function deriveCostUsage(params: { runs: Run[]; monthlyBudgetUsd?: number; now?: Date }): CostUsage {
  const now = params.now ?? new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthlyBudgetUsd = params.monthlyBudgetUsd && params.monthlyBudgetUsd > 0 ? params.monthlyBudgetUsd : 0;

  const monthRuns = params.runs.filter((run) => {
    const started = new Date(run.startedAt);
    return Number.isFinite(started.getTime()) && started.getFullYear() === year && started.getMonth() === month;
  });

  const monthToDateUsd = round2(monthRuns.reduce((sum, run) => sum + Math.max(0, run.costUsd || 0), 0));
  const liveRunCount = monthRuns.filter((run) => run.executionMode === "live").length;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = Math.min(now.getDate(), daysInMonth);
  const dailyBurn = daysElapsed > 0 ? monthToDateUsd / daysElapsed : 0;
  const projectedMonthEndUsd = round2(dailyBurn * daysInMonth);

  const remainingUsd = round2(monthlyBudgetUsd - monthToDateUsd);
  const percentUsed = monthlyBudgetUsd > 0 ? Math.round((monthToDateUsd / monthlyBudgetUsd) * 100) : 0;
  const runwayDays =
    monthlyBudgetUsd > 0 && dailyBurn > 0 ? Math.max(0, Math.floor(Math.max(0, remainingUsd) / dailyBurn)) : null;

  const bySkill = new Map<string, CostUsageSkillSpend>();
  for (const run of monthRuns) {
    const entry = bySkill.get(run.skillId) ?? { skillId: run.skillId, costUsd: 0, runCount: 0 };
    entry.costUsd = round2(entry.costUsd + Math.max(0, run.costUsd || 0));
    entry.runCount += 1;
    bySkill.set(run.skillId, entry);
  }
  const topSkills = [...bySkill.values()].sort((left, right) => right.costUsd - left.costUsd).slice(0, 5);

  return {
    monthToDateUsd,
    monthlyBudgetUsd,
    remainingUsd,
    percentUsed,
    projectedMonthEndUsd,
    daysElapsed,
    daysInMonth,
    runwayDays,
    overBudget: monthlyBudgetUsd > 0 && monthToDateUsd > monthlyBudgetUsd,
    projectedOverBudget: monthlyBudgetUsd > 0 && projectedMonthEndUsd > monthlyBudgetUsd,
    monthRunCount: monthRuns.length,
    liveRunCount,
    topSkills,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
