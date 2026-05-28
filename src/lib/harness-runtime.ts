import type { AIProviderSettings, ModelRouteDecision, ModelTaskLane } from "@/lib/model-router";
import { providerLabel, selectModelForTask } from "@/lib/model-router";
import type { Run, Skill, Tool, ToolRequest } from "@/lib/enterprise-ai-data";

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

  const run: Run = {
    id: runId,
    skillId: skill.id,
    useCaseId: skill.useCaseId,
    triggeredBy,
    status: requiresApproval ? "waiting_for_approval" : "completed",
    riskLevel: skill.riskLevel,
    currentStage: requiresApproval ? "Approval Gate" : "Response Delivered",
    costUsd: skill.costLimit * 0.42,
    latencyMs: 3880,
    startedAt: timestamp,
    output:
      skill.allowedTools.length > 0
        ? "Generated a governed test response using configured prompt, context, tool policy, and approval controls."
        : "Generated a governed test response without tool execution because no connector tools are configured for this Skill.",
    trace: [
      {
        label: "Request received",
        status: "completed",
        detail: "Test input accepted from Skill console.",
        latencyMs: 18,
      },
      {
        label: "Identity check",
        status: "completed",
        detail: "User has builder and AI enablement director privileges.",
        latencyMs: 52,
      },
      {
        label: "Context retrieval",
        status: "completed",
        detail: `${skill.contextSources.length} approved context sources filtered by permission.`,
        latencyMs: 610,
      },
      {
        label: "Policy check",
        status: "completed",
        detail: `${skill.allowedTools.length} allowed tools evaluated against autonomy tier.`,
        latencyMs: 170,
      },
      {
        label: "Model call",
        status: "completed",
        detail: `${providerLabel(route.provider)}/${route.model} selected by router. ${route.reason}`,
        latencyMs: 2120,
      },
      {
        label: "Tool request",
        status: requiresApproval ? "waiting" : "completed",
        detail: selectedToolId
          ? requiresApproval
            ? `${selectedToolId} requires human approval.`
            : `${selectedToolId} allowed by policy.`
          : "No tool was requested because the Skill has no allowed tools configured.",
        latencyMs: requiresApproval ? 0 : 390,
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
  };
}
