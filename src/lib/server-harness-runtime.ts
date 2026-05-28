import type { AIProviderSettings, ModelRouteDecision, ModelTaskLane } from "@/lib/model-router";
import type { Run, Skill, Tool, ToolRequest } from "@/lib/enterprise-ai-data";
import { evaluateContextPolicy, evaluateOutputPolicy, evaluateToolPolicy, PolicyDecision } from "@/lib/policy-engine";
import { generateWithModelProvider } from "@/lib/model-provider";

export type ServerHarnessInput = {
  skill: Skill;
  tools: Tool[];
  settings: AIProviderSettings;
  triggeredBy: string;
  timestamp: string;
  runId: string;
  toolRequestId: string;
  message?: string;
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

function assembleUserPrompt(input: ServerHarnessInput, allowedContextCount: number) {
  return [
    input.message || "Run a governed Skill test using the current Skill configuration.",
    "",
    `Skill: ${input.skill.name}`,
    `Risk level: ${input.skill.riskLevel}`,
    `Autonomy tier: ${input.skill.autonomyTier}`,
    `Allowed context sources: ${allowedContextCount}`,
    `Allowed tools: ${input.skill.allowedTools.join(", ") || "none"}`,
    "Return a concise, enterprise-safe response. Do not claim that external systems were changed unless the Harness approved and executed a tool.",
  ].join("\n");
}

export async function runServerHarnessSkill(input: ServerHarnessInput): Promise<ServerHarnessResult> {
  const lane = selectRuntimeLane(input.skill);
  const selectedToolId = input.skill.allowedTools[0] ?? "";
  const selectedTool = input.tools.find((tool) => tool.id === selectedToolId);
  const contextDecision = evaluateContextPolicy(input.skill);
  const toolDecision = evaluateToolPolicy({
    skill: input.skill,
    tool: selectedTool,
    toolId: selectedToolId,
  });

  const modelResult = await generateWithModelProvider({
    settings: input.settings,
    lane,
    system: input.skill.systemPrompt,
    user: assembleUserPrompt(input, contextDecision.allowedSourceIds.length),
    temperature: input.skill.temperature,
    maxTokens: input.skill.maxTokens,
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
    costUsd: input.skill.costLimit * (modelResult.localFallback ? 0.05 : 0.42),
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
    },
  };
}
