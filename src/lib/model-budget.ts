import type { Run, Skill } from "./enterprise-ai-data.ts";
import type { AIProviderSettings, ModelRouteDecision } from "./model-router.ts";

export type ModelBudgetStatus = "pass" | "warn" | "block";

export type ModelBudgetDecision = {
  status: ModelBudgetStatus;
  enforcementEnabled: boolean;
  estimatedRunCostUsd: number;
  currentMonthlySpendUsd: number;
  projectedMonthlySpendUsd: number;
  monthlyBudgetUsd: number;
  runBudgetUsd: number;
  warningThreshold: number;
  reason: string;
  evidence: string[];
};

type RuntimeEnv = Record<string, string | undefined>;

const million = 1_000_000;

const providerRatesPerMillion: Record<string, { input: number; output: number }> = {
  local: { input: 0, output: 0 },
  openai: { input: 0.6, output: 2.4 },
  anthropic: { input: 3, output: 15 },
  google: { input: 0.35, output: 1.05 },
  azure_openai: { input: 0.6, output: 2.4 },
  kimi: { input: 0.3, output: 1.2 },
  glm: { input: 0.2, output: 0.8 },
  deepseek: { input: 0.14, output: 0.28 },
  openrouter: { input: 1, output: 3 },
};

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateModelCostUsd(params: {
  provider: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const rates = providerRatesPerMillion[params.provider] ?? providerRatesPerMillion.openrouter;
  const inputCost = (Math.max(0, params.inputTokens) / million) * rates.input;
  const outputCost = (Math.max(0, params.outputTokens) / million) * rates.output;
  return roundMoney(inputCost + outputCost);
}

export function currentMonthRunSpend(runs: Run[], now = new Date()) {
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();
  return roundMoney(
    runs.reduce((sum, run) => {
      const started = new Date(run.startedAt);
      if (Number.isNaN(started.getTime())) return sum;
      if (started.getUTCMonth() !== month || started.getUTCFullYear() !== year) return sum;
      return sum + Math.max(0, run.costUsd ?? 0);
    }, 0),
  );
}

export function modelBudgetFromEnv(
  settings: AIProviderSettings,
  env: RuntimeEnv = process.env,
) {
  const monthlyBudgetUsd = positiveNumber(env.TENANT_MONTHLY_BUDGET_USD) ??
    positiveNumber(env.MODEL_BUDGET_USD) ??
    positiveNumber(settings.monthlyBudgetUsd) ??
    0;
  const runBudgetUsd = positiveNumber(env.MODEL_RUN_BUDGET_USD) ?? positiveNumber(env.MODEL_MAX_RUN_COST_USD) ?? 0;
  const warningThreshold = clamp(positiveNumber(env.MODEL_BUDGET_WARN_RATIO) ?? 0.8, 0.1, 1);
  const enforcementEnabled = env.MODEL_BUDGET_ENFORCEMENT_ENABLED === "true";
  return { monthlyBudgetUsd, runBudgetUsd, warningThreshold, enforcementEnabled };
}

export function evaluateModelBudget(params: {
  settings: AIProviderSettings;
  route: ModelRouteDecision;
  inputTokens: number;
  outputTokens: number;
  currentMonthlySpendUsd: number;
  skill?: Skill;
  env?: RuntimeEnv;
}): ModelBudgetDecision {
  const config = modelBudgetFromEnv(params.settings, params.env);
  const skillRunLimit = positiveNumber(params.skill?.costLimit) ?? 0;
  const runBudgetUsd = config.runBudgetUsd || skillRunLimit;
  const estimatedRunCostUsd = estimateModelCostUsd({
    provider: params.route.provider,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
  });
  const currentMonthlySpendUsd = roundMoney(Math.max(0, params.currentMonthlySpendUsd));
  const projectedMonthlySpendUsd = roundMoney(currentMonthlySpendUsd + estimatedRunCostUsd);
  const monthlyBudgetExceeded = config.monthlyBudgetUsd > 0 && projectedMonthlySpendUsd > config.monthlyBudgetUsd;
  const monthlyBudgetNear =
    config.monthlyBudgetUsd > 0 && projectedMonthlySpendUsd >= config.monthlyBudgetUsd * config.warningThreshold;
  const runBudgetExceeded = runBudgetUsd > 0 && estimatedRunCostUsd > runBudgetUsd;
  const evidence = [
    `route ${params.route.modelRef}`,
    `estimated run ${formatUsd(estimatedRunCostUsd)}`,
    config.monthlyBudgetUsd > 0
      ? `projected month ${formatUsd(projectedMonthlySpendUsd)} / ${formatUsd(config.monthlyBudgetUsd)}`
      : "monthly budget not configured",
    runBudgetUsd > 0 ? `run cap ${formatUsd(runBudgetUsd)}` : "run cap not configured",
    config.enforcementEnabled ? "enforcement on" : "enforcement advisory",
  ];

  if (config.enforcementEnabled && (monthlyBudgetExceeded || runBudgetExceeded)) {
    return {
      status: "block",
      enforcementEnabled: config.enforcementEnabled,
      estimatedRunCostUsd,
      currentMonthlySpendUsd,
      projectedMonthlySpendUsd,
      monthlyBudgetUsd: config.monthlyBudgetUsd,
      runBudgetUsd,
      warningThreshold: config.warningThreshold,
      reason: runBudgetExceeded
        ? `Estimated model spend ${formatUsd(estimatedRunCostUsd)} exceeds the run cap ${formatUsd(runBudgetUsd)}.`
        : `Projected monthly model spend ${formatUsd(projectedMonthlySpendUsd)} exceeds the tenant budget ${formatUsd(config.monthlyBudgetUsd)}.`,
      evidence,
    };
  }

  if (monthlyBudgetExceeded || runBudgetExceeded || monthlyBudgetNear || config.monthlyBudgetUsd <= 0) {
    return {
      status: "warn",
      enforcementEnabled: config.enforcementEnabled,
      estimatedRunCostUsd,
      currentMonthlySpendUsd,
      projectedMonthlySpendUsd,
      monthlyBudgetUsd: config.monthlyBudgetUsd,
      runBudgetUsd,
      warningThreshold: config.warningThreshold,
      reason: config.monthlyBudgetUsd <= 0
        ? "No tenant model budget is configured; model usage remains advisory."
        : runBudgetExceeded
          ? `Estimated run spend is above the configured run cap, but enforcement is advisory.`
          : monthlyBudgetExceeded
            ? `Projected monthly model spend is above budget, but enforcement is advisory.`
            : `Projected monthly model spend is near the warning threshold.`,
      evidence,
    };
  }

  return {
    status: "pass",
    enforcementEnabled: config.enforcementEnabled,
    estimatedRunCostUsd,
    currentMonthlySpendUsd,
    projectedMonthlySpendUsd,
    monthlyBudgetUsd: config.monthlyBudgetUsd,
    runBudgetUsd,
    warningThreshold: config.warningThreshold,
    reason: "Model budget guardrails passed for this route.",
    evidence,
  };
}

export function blockedBudgetRun(params: {
  skill: Skill;
  runId: string;
  triggeredBy: string;
  timestamp: string;
  decision: ModelBudgetDecision;
}): Run {
  return {
    id: params.runId,
    skillId: params.skill.id,
    useCaseId: params.skill.useCaseId,
    triggeredBy: params.triggeredBy,
    status: "blocked",
    riskLevel: params.skill.riskLevel,
    currentStage: "Budget Guardrail",
    costUsd: 0,
    latencyMs: 0,
    startedAt: params.timestamp,
    output: `Run blocked by budget guardrail: ${params.decision.reason}`,
    trace: [
      {
        label: "Model budget check",
        status: "blocked",
        detail: params.decision.reason,
        latencyMs: 0,
      },
    ],
  };
}

function positiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundMoney(value: number) {
  return Math.round(value * 10000) / 10000;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}
