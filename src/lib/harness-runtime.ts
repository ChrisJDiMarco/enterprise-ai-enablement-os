import type { AIProviderSettings, ModelRouteDecision, ModelTaskLane } from "@/lib/model-router";
import { providerLabel, selectModelForTask } from "@/lib/model-router";
import type { Run, Skill, Tool, ToolRequest } from "@/lib/enterprise-ai-data";
import { buildSkillPromptContract, evaluatePromptQuality, type PromptQualityReport } from "@/lib/prompt-contracts";

export type HarnessRuntimeInput = {
  skill: Skill;
  tools: Tool[];
  settings: AIProviderSettings;
  triggeredBy: string;
  timestamp: string;
  runId: string;
  toolRequestId: string;
};

export type HarnessRuntimeResult = {
  run: Run;
  toolRequest?: ToolRequest;
  selectedToolId: string;
  requiresApproval: boolean;
  lane: ModelTaskLane;
  route: ModelRouteDecision;
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

function requiresHumanApproval(skill: Skill, tool?: Tool) {
  if (!tool) return false;
  return tool.requiresApprovalByDefault || skill.autonomyTier === "tier_2_prepare_action" || skill.riskLevel === "high";
}

export function runLocalHarnessSkill(input: HarnessRuntimeInput): HarnessRuntimeResult {
  const { runId, settings, skill, timestamp, toolRequestId, tools, triggeredBy } = input;
  const selectedToolId = skill.allowedTools[0] ?? "";
  const selectedTool = tools.find((tool) => tool.id === selectedToolId);
  const requiresApproval = requiresHumanApproval(skill, selectedTool);
  const lane = selectRuntimeLane(skill);
  const route = selectModelForTask(settings, lane);
  const promptContract = buildSkillPromptContract(skill);
  const promptQuality = evaluatePromptQuality(skill);
  const simulationReason =
    "Deterministic local runtime — no model provider was called. Configure a server-side provider to produce live output.";
  const governedOutput = [
    `[SIMULATED RUN] This is a deterministic walkthrough of ${skill.name}'s governance path — no model was called and no real output was generated.`,
    skill.contextSources.length
      ? `Grounding boundary: ${skill.contextSources.length} approved context source${skill.contextSources.length === 1 ? "" : "s"} available and treated as untrusted data until cited.`
      : "Grounding boundary: no context source is configured, so the response must disclose missing evidence.",
    selectedToolId
      ? requiresApproval
        ? `Action boundary: ${selectedToolId} was requested but paused for human approval.`
        : `Action boundary: ${selectedToolId} is allowed by policy for this test run.`
      : "Action boundary: no connector tool was requested.",
    "Recommended next action: review the trace, confirm evidence, then run evals before pilot approval.",
  ].join(" ");

  const run: Run = {
    id: runId,
    skillId: skill.id,
    useCaseId: skill.useCaseId,
    triggeredBy,
    status: requiresApproval ? "waiting_for_approval" : "completed",
    riskLevel: skill.riskLevel,
    currentStage: requiresApproval ? "Approval Gate" : "Response Delivered",
    costUsd: 0,
    latencyMs: 0,
    startedAt: timestamp,
    output: governedOutput,
    executionMode: "simulated",
    simulationReason,
    trace: [
      {
        label: "Request received",
        status: "completed",
        detail: "Test input accepted from Skill console (simulated walkthrough).",
        latencyMs: 0,
      },
      {
        label: "Identity check",
        status: "completed",
        detail: "User has builder and AI enablement director privileges.",
        latencyMs: 0,
      },
      {
        label: "Context retrieval",
        status: "completed",
        detail: `${skill.contextSources.length} approved context source${skill.contextSources.length === 1 ? "" : "s"} configured. No retrieval was executed in this simulated run.`,
        latencyMs: 0,
      },
      {
        label: "Policy check",
        status: "completed",
        detail: `${skill.allowedTools.length} allowed tools evaluated against autonomy tier.`,
        latencyMs: 0,
      },
      {
        label: "Prompt contract assembled",
        status: promptQuality.missingCritical.length ? "waiting" : "completed",
        detail: `${promptContract.id}: quality ${promptQuality.score}/100 (${promptQuality.grade}); ${promptQuality.passedChecks}/${promptQuality.totalChecks} controls present.`,
        latencyMs: 0,
      },
      {
        label: "Model call (simulated)",
        status: "completed",
        detail: `No provider was called. Router would select ${providerLabel(route.provider)}/${route.model}. ${route.reason}`,
        latencyMs: 0,
      },
      {
        label: "Tool request",
        status: requiresApproval ? "waiting" : "completed",
        detail: selectedToolId
          ? requiresApproval
            ? `${selectedToolId} requires human approval.`
            : `${selectedToolId} allowed by policy.`
          : "No tool was requested because the Skill has no allowed tools configured.",
        latencyMs: 0,
      },
    ],
  };

  const toolRequest =
    requiresApproval && selectedToolId
      ? {
          id: toolRequestId,
          skillId: skill.id,
          runId,
          user: triggeredBy,
          toolId: selectedToolId,
          reason: `Test run requested ${selectedToolId} inside ${skill.name}.`,
          riskLevel: skill.riskLevel,
          status: "pending" as const,
          requestedAt: timestamp,
        }
      : undefined;

  return {
    run,
    toolRequest,
    selectedToolId,
    requiresApproval,
    lane,
    route,
    prompt: {
      contractId: promptContract.id,
      contractVersion: promptContract.version,
      quality: promptQuality,
    },
  };
}
