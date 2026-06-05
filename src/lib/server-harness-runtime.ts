import { selectModelForTask, type AIProviderSettings, type ModelRouteDecision, type ModelTaskLane } from "@/lib/model-router";
import type { Run, Skill, Tool, ToolRequest } from "@/lib/enterprise-ai-data";
import { evaluateContextPolicy, evaluateOutputPolicy, evaluateToolPolicy, PolicyDecision } from "@/lib/policy-engine";
import { generateWithModelProvider } from "@/lib/model-provider";
import {
  blockedBudgetRun,
  evaluateModelBudget,
  estimateModelCostUsd,
  estimateTokens,
  type ModelBudgetDecision,
} from "@/lib/model-budget";
import {
  buildHarnessUserPrompt,
  buildSkillPromptContract,
  evaluatePromptQuality,
  formatPromptContract,
  type PromptQualityReport,
} from "@/lib/prompt-contracts";

export type ServerHarnessInput = {
  skill: Skill;
  tools: Tool[];
  settings: AIProviderSettings;
  triggeredBy: string;
  timestamp: string;
  runId: string;
  toolRequestId: string;
  message?: string;
  currentMonthlySpendUsd?: number;
};

export type ServerHarnessResult = {
  run: Run;
  toolRequest?: ToolRequest;
  selectedToolId: string;
  requiresApproval: boolean;
  lane: ModelTaskLane;
  route: ModelRouteDecision;
  policy: {
    context: PolicyDecision;
    tool: PolicyDecision;
    output: PolicyDecision;
  };
  model: {
    inputTokens: number;
    outputTokens: number;
    localFallback: boolean;
    finishReason: string;
    estimatedCostUsd: number;
  };
  budget: ModelBudgetDecision;
  prompt: {
    contractId: string;
    contractVersion: string;
    quality: PromptQualityReport;
  };
};

function selectRuntimeLane(skill: Skill): ModelTaskLane {
  if (skill.riskLevel === "high" || skill.riskLevel === "restricted" || skill.autonomyTier === "tier_2_prepare_action") {
    return "governance";
  }

  if (skill.allowedTools.length > 0) {
    return "workflow";
  }

  return "default";
}

export async function runServerHarnessSkill(input: ServerHarnessInput): Promise<ServerHarnessResult> {
  const lane = selectRuntimeLane(input.skill);
  const selectedToolId = input.skill.allowedTools[0] ?? "";
  const selectedTool = input.tools.find((tool) => tool.id === selectedToolId);
  const promptContract = buildSkillPromptContract(input.skill);
  const promptQuality = evaluatePromptQuality(input.skill);
  const contextDecision = evaluateContextPolicy(input.skill);
  const toolDecision = evaluateToolPolicy({
    skill: input.skill,
    tool: selectedTool,
    toolId: selectedToolId,
  });
  const systemPrompt = formatPromptContract(promptContract);
  const userPrompt = buildHarnessUserPrompt({
    skill: input.skill,
    message: input.message,
    allowedContextCount: contextDecision.allowedSourceIds.length,
    selectedToolId,
    contextPolicyReason: contextDecision.reason,
    toolPolicyReason: toolDecision.reason,
  });
  const route = selectModelForTask(input.settings, lane);
  const preflightBudget = evaluateModelBudget({
    settings: input.settings,
    route,
    inputTokens: estimateTokens(`${systemPrompt}\n${userPrompt}`),
    outputTokens: input.skill.maxTokens,
    currentMonthlySpendUsd: input.currentMonthlySpendUsd ?? 0,
    skill: input.skill,
  });

  if (preflightBudget.status === "block") {
    const blockedRun = blockedBudgetRun({
      skill: input.skill,
      runId: input.runId,
      triggeredBy: input.triggeredBy,
      timestamp: input.timestamp,
      decision: preflightBudget,
    });
    const approvedOutput: PolicyDecision = {
      status: "approved",
      reason: "No model output was generated because budget policy blocked the run before execution.",
      policyId: `${input.skill.slug || input.skill.id}-output-policy-v${input.skill.version || "1"}`,
      riskLevel: input.skill.riskLevel,
    };
    return {
      run: {
        ...blockedRun,
        trace: [
          ...blockedRun.trace,
          {
            label: "Context policy",
            status: contextDecision.status === "blocked" ? "blocked" : contextDecision.status === "requires_approval" ? "waiting" : "completed",
            detail: `${contextDecision.policyId}: ${contextDecision.reason}`,
            latencyMs: 0,
          },
          {
            label: "Tool policy",
            status: toolDecision.status === "blocked" ? "blocked" : toolDecision.status === "requires_approval" ? "waiting" : "completed",
            detail: `${toolDecision.policyId}: ${toolDecision.reason}`,
            latencyMs: 0,
          },
        ],
      },
      selectedToolId,
      requiresApproval: false,
      lane,
      route,
      policy: {
        context: contextDecision,
        tool: toolDecision,
        output: approvedOutput,
      },
      model: {
        inputTokens: 0,
        outputTokens: 0,
        localFallback: false,
        finishReason: "budget_blocked",
        estimatedCostUsd: 0,
      },
      budget: preflightBudget,
      prompt: {
        contractId: promptContract.id,
        contractVersion: promptContract.version,
        quality: promptQuality,
      },
    };
  }

  const modelResult = await generateWithModelProvider({
    settings: input.settings,
    lane,
    system: systemPrompt,
    user: userPrompt,
    temperature: input.skill.temperature,
    maxTokens: input.skill.maxTokens,
  });
  const postflightBudget = evaluateModelBudget({
    settings: input.settings,
    route: modelResult.route,
    inputTokens: modelResult.inputTokens,
    outputTokens: modelResult.outputTokens,
    currentMonthlySpendUsd: input.currentMonthlySpendUsd ?? 0,
    skill: input.skill,
  });

  const outputDecision = evaluateOutputPolicy({
    skill: input.skill,
    output: modelResult.text,
  });
  const requiresApproval =
    contextDecision.status === "requires_approval" ||
    toolDecision.status === "requires_approval" ||
    outputDecision.status === "requires_approval";
  const blocked =
    contextDecision.status === "blocked" ||
    toolDecision.status === "blocked" ||
    outputDecision.status === "blocked";

  const runStatus = blocked ? "blocked" : requiresApproval ? "waiting_for_approval" : "completed";
  const run: Run = {
    id: input.runId,
    skillId: input.skill.id,
    useCaseId: input.skill.useCaseId,
    triggeredBy: input.triggeredBy,
    status: runStatus,
    riskLevel: input.skill.riskLevel,
    currentStage: blocked ? "Policy Blocked" : requiresApproval ? "Approval Gate" : "Response Delivered",
    costUsd: postflightBudget.estimatedRunCostUsd,
    latencyMs: modelResult.latencyMs,
    startedAt: input.timestamp,
    output: blocked
      ? `Run blocked by policy: ${[contextDecision, toolDecision, outputDecision].find((decision) => decision.status === "blocked")?.reason}`
      : modelResult.text,
    trace: [
      {
        label: "Request received",
        status: "completed",
        detail: "Skill run accepted by server Harness API.",
        latencyMs: 18,
      },
      {
        label: "Identity check",
        status: "completed",
        detail: `${input.triggeredBy} resolved for local workspace execution.`,
        latencyMs: 52,
      },
      {
        label: "Context policy",
        status: contextDecision.status === "blocked" ? "blocked" : contextDecision.status === "requires_approval" ? "waiting" : "completed",
        detail: `${contextDecision.policyId}: ${contextDecision.reason}`,
        latencyMs: 96,
      },
      {
        label: "Tool policy",
        status: toolDecision.status === "blocked" ? "blocked" : toolDecision.status === "requires_approval" ? "waiting" : "completed",
        detail: `${toolDecision.policyId}: ${toolDecision.reason}`,
        latencyMs: 124,
      },
      {
        label: "Prompt contract assembled",
        status: promptQuality.missingCritical.length ? "waiting" : "completed",
        detail: `${promptContract.id}: quality ${promptQuality.score}/100 (${promptQuality.grade}); ${promptQuality.passedChecks}/${promptQuality.totalChecks} controls present.`,
        latencyMs: 88,
      },
      {
        label: "Model budget",
        status: postflightBudget.status === "block" ? "blocked" : postflightBudget.status === "warn" ? "waiting" : "completed",
        detail: postflightBudget.reason,
        latencyMs: 24,
      },
      {
        label: "Model call",
        status: "completed",
        detail: `${modelResult.route.provider}/${modelResult.route.model} selected. ${modelResult.route.reason}`,
        latencyMs: modelResult.latencyMs,
      },
      {
        label: "Output policy",
        status: outputDecision.status === "blocked" ? "blocked" : outputDecision.status === "requires_approval" ? "waiting" : "completed",
        detail: `${outputDecision.policyId}: ${outputDecision.reason}`,
        latencyMs: 142,
      },
      {
        label: "Tool request",
        status: toolDecision.status === "requires_approval" ? "waiting" : toolDecision.status === "blocked" ? "blocked" : "completed",
        detail: selectedToolId
          ? `${selectedToolId}: ${toolDecision.reason}`
          : "No tool was requested because the Skill has no allowed tools configured.",
        latencyMs: toolDecision.status === "requires_approval" ? 0 : 215,
      },
    ],
  };

  const toolRequest =
    toolDecision.status === "requires_approval" && selectedToolId
      ? {
          id: input.toolRequestId,
          skillId: input.skill.id,
          runId: input.runId,
          user: input.triggeredBy,
          toolId: selectedToolId,
          reason: toolDecision.reason,
          riskLevel: toolDecision.riskLevel,
          status: "pending" as const,
          requestedAt: input.timestamp,
        }
      : undefined;

  return {
    run,
    toolRequest,
    selectedToolId,
    requiresApproval,
    lane,
    route: modelResult.route,
    policy: {
      context: contextDecision,
      tool: toolDecision,
      output: outputDecision,
    },
    model: {
      inputTokens: modelResult.inputTokens,
      outputTokens: modelResult.outputTokens,
      localFallback: modelResult.localFallback,
      finishReason: modelResult.finishReason,
      estimatedCostUsd: estimateModelCostUsd({
        provider: modelResult.route.provider,
        inputTokens: modelResult.inputTokens,
        outputTokens: modelResult.outputTokens,
      }),
    },
    budget: postflightBudget,
    prompt: {
      contractId: promptContract.id,
      contractVersion: promptContract.version,
      quality: promptQuality,
    },
  };
}
