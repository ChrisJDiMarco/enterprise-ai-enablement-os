import type { EvalResult, Skill } from "./enterprise-ai-data.ts";
import { configuredRuntimeHttpUrl, runtimeHttpUrlIssue } from "./runtime-url-config.ts";

export type EvalScheduleItem = {
  skillId: string;
  skillName: string;
  status: "due" | "blocked" | "healthy";
  priority: "critical" | "high" | "medium" | "low";
  lastRunAt?: string;
  lastScore?: number;
  reason: string;
  recommendedSuites: string[];
};

export type EvalSchedulePlan = {
  schema: "enterprise-ai-enablement-os.eval-schedule.v1";
  generatedAt: string;
  cadenceDays: number;
  dueCount: number;
  blockedCount: number;
  healthyCount: number;
  items: EvalScheduleItem[];
};

export type EvalCadenceConfig = {
  configured: boolean;
  mode: "external-runner" | "scheduled-runner" | "missing";
  cadenceDays: number;
  reason: string;
  evidence: string[];
};

export type EvalScheduleMaintenanceAction = "queue_due" | "run_due";

export type EvalScheduleMaintenanceOptions = {
  action?: EvalScheduleMaintenanceAction;
  dryRun?: boolean;
  includeBlocked?: boolean;
  maxSkills?: number;
};

export type EvalScheduleMaintenancePlan = {
  schema: "enterprise-ai-enablement-os.eval-schedule-maintenance.v1";
  action: EvalScheduleMaintenanceAction;
  dryRun: boolean;
  generatedAt: string;
  cadenceDays: number;
  scanned: number;
  selected: number;
  maxSkills: number;
  dueSelected: number;
  blockedSelected: number;
  blockedSkipped: number;
  healthySkipped: number;
  items: EvalScheduleItem[];
  note: string;
};

type RuntimeEnv = Record<string, string | undefined>;

export function evalCadenceConfigFromEnv(env: RuntimeEnv = process.env): EvalCadenceConfig {
  const cadenceDays = parsePositiveInt(env.EVAL_MAX_AGE_DAYS) ?? 30;
  const externalRunner = Boolean(configuredRuntimeHttpUrl(env, "EVAL_RUNNER_URL"));
  const externalRunnerIssue = runtimeHttpUrlIssue(env, "EVAL_RUNNER_URL");
  const scheduleEnabled = env.EVAL_SCHEDULE_ENABLED === "true";
  const cron = env.EVAL_SCHEDULE_CRON?.trim();
  const evidence = [
    externalRunner ? "external runner endpoint" : "",
    externalRunnerIssue ? "external runner endpoint invalid" : "",
    scheduleEnabled ? "schedule enabled" : "",
    cron ? `cron ${cron}` : "",
    `${cadenceDays}-day max eval age`,
  ].filter(Boolean);

  if (externalRunner) {
    return {
      configured: true,
      mode: "external-runner",
      cadenceDays,
      reason: scheduleEnabled || cron
        ? "External eval runner and recurring cadence are configured."
        : "External eval runner is configured and can own recurring eval jobs.",
      evidence,
    };
  }

  if (scheduleEnabled || cron) {
    return {
      configured: true,
      mode: "scheduled-runner",
      cadenceDays,
      reason: "Recurring eval scheduler is enabled for local or hosted eval jobs.",
      evidence,
    };
  }

  return {
    configured: false,
    mode: "missing",
    cadenceDays,
    reason: externalRunnerIssue
      ? `EVAL_RUNNER_URL is invalid: ${externalRunnerIssue}`
      : "Set EVAL_SCHEDULE_ENABLED, EVAL_SCHEDULE_CRON, or EVAL_RUNNER_URL so launch evals become continuous monitoring.",
    evidence,
  };
}

export function deriveEvalSchedulePlan(params: {
  skills: Skill[];
  evalResults: EvalResult[];
  now?: Date;
  env?: RuntimeEnv;
}): EvalSchedulePlan {
  const now = params.now ?? new Date();
  const cadenceDays = evalCadenceConfigFromEnv(params.env ?? process.env).cadenceDays;
  const latestBySkill = new Map<string, EvalResult>();
  for (const result of params.evalResults) {
    const existing = latestBySkill.get(result.skillId);
    if (!existing || Date.parse(result.createdAt) > Date.parse(existing.createdAt)) {
      latestBySkill.set(result.skillId, result);
    }
  }

  const items = params.skills.map((skill) => {
    const latest = latestBySkill.get(skill.id);
    const ageDays = latest ? daysBetween(latest.createdAt, now) : Number.POSITIVE_INFINITY;
    const stale = ageDays > cadenceDays;
    const failed = latest ? !latest.passed || latest.criticalFailures > 0 : false;
    const blocked = skill.status === "production" && failed;
    const due = !latest || stale || failed || skill.status === "in_review";
    const priority = blocked
      ? "critical"
      : skill.riskLevel === "restricted" || skill.riskLevel === "high"
        ? "high"
        : due
          ? "medium"
          : "low";

    return {
      skillId: skill.id,
      skillName: skill.name,
      status: blocked ? "blocked" : due ? "due" : "healthy",
      priority,
      lastRunAt: latest?.createdAt,
      lastScore: latest?.score,
      reason: !latest
        ? "No eval artifact exists for this Skill."
        : failed
          ? `Latest eval did not pass (${latest.score}%, ${latest.criticalFailures} critical failures).`
          : stale
            ? `Latest eval is ${Math.round(ageDays)} days old, above the ${cadenceDays}-day cadence.`
            : "Eval evidence is current.",
      recommendedSuites: suitesForSkill(skill),
    } satisfies EvalScheduleItem;
  });

  return {
    schema: "enterprise-ai-enablement-os.eval-schedule.v1",
    generatedAt: now.toISOString(),
    cadenceDays,
    dueCount: items.filter((item) => item.status === "due").length,
    blockedCount: items.filter((item) => item.status === "blocked").length,
    healthyCount: items.filter((item) => item.status === "healthy").length,
    items: items.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)),
  };
}

export function deriveEvalScheduleMaintenancePlan(
  plan: EvalSchedulePlan,
  options: EvalScheduleMaintenanceOptions = {},
): EvalScheduleMaintenancePlan {
  const action = options.action ?? "queue_due";
  const dryRun = options.dryRun ?? true;
  const maxSkills = parsePositiveInt(options.maxSkills) ?? 25;
  const includeBlocked = options.includeBlocked ?? action === "queue_due";
  const selected = plan.items
    .filter((item) => item.status === "due" || (includeBlocked && item.status === "blocked"))
    .slice(0, maxSkills);
  const dueSelected = selected.filter((item) => item.status === "due").length;
  const blockedSelected = selected.filter((item) => item.status === "blocked").length;
  const blockedTotal = plan.items.filter((item) => item.status === "blocked").length;
  const healthySkipped = plan.items.filter((item) => item.status === "healthy").length;
  const note =
    action === "run_due"
      ? dryRun
        ? "Dry-run only. No eval artifacts or workspace evidence will be written."
        : "Due eval suites will run through the deterministic local runner and write tenant evidence."
      : "Queue preview for the configured continuous eval runner.";

  return {
    schema: "enterprise-ai-enablement-os.eval-schedule-maintenance.v1",
    action,
    dryRun,
    generatedAt: new Date().toISOString(),
    cadenceDays: plan.cadenceDays,
    scanned: plan.items.length,
    selected: selected.length,
    maxSkills,
    dueSelected,
    blockedSelected,
    blockedSkipped: Math.max(0, blockedTotal - blockedSelected),
    healthySkipped,
    items: selected,
    note,
  };
}

function suitesForSkill(skill: Skill) {
  const suites = ["regression", "quality", "grounding"];
  if (skill.allowedTools.length > 0) suites.push("tool_safety", "permission");
  if (skill.riskLevel === "high" || skill.riskLevel === "restricted") suites.push("red_team", "decision_boundary");
  if (skill.contextSources.length > 0) suites.push("prompt_injection");
  return [...new Set(suites)];
}

function daysBetween(iso: string, now: Date) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then.getTime()) / (24 * 60 * 60 * 1000);
}

function parsePositiveInt(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function priorityRank(priority: EvalScheduleItem["priority"]) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority];
}
