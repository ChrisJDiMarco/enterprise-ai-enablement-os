import type { AuditLog, Run, Skill, ToolRequest } from "@/lib/enterprise-ai-data";

export type AgentOpsCapabilityStatus = "ready" | "partial" | "gap";

export type AgentOpsCapability = {
  id:
    | "durable-runtime"
    | "guardrail-stack"
    | "connector-broker"
    | "telemetry"
    | "evaluation"
    | "governance-evidence";
  name: string;
  sourcePattern: string;
  status: AgentOpsCapabilityStatus;
  score: number;
  evidence: string;
  nextAction: string;
};

export type AgentOpsBlueprint = {
  score: number;
  status: AgentOpsCapabilityStatus;
  summary: string;
  capabilities: AgentOpsCapability[];
};

export type AgentOpsBlueprintInput = {
  runs: Run[];
  skills: Skill[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
};

function statusFromScore(score: number): AgentOpsCapabilityStatus {
  if (score >= 80) return "ready";
  if (score >= 45) return "partial";
  return "gap";
}

function capability(params: Omit<AgentOpsCapability, "status">): AgentOpsCapability {
  return {
    ...params,
    status: statusFromScore(params.score),
  };
}

export function deriveAgentOpsBlueprint(input: AgentOpsBlueprintInput): AgentOpsBlueprint {
  const runs = input.runs ?? [];
  const skills = input.skills ?? [];
  const toolRequests = input.toolRequests ?? [];
  const auditLogs = input.auditLogs ?? [];

  const traceSteps = runs.flatMap((run) => run.trace);
  const hasTraceChain = runs.some((run) => run.trace.length >= 6);
  const hasWaitingRun = runs.some((run) => run.status === "waiting_for_approval");
  const hasPolicyTrace = traceSteps.some((step) => /policy|permission|guardrail|validation/i.test(step.label + " " + step.detail));
  const hasOutputValidation = traceSteps.some((step) => /output|validation|safety|grounding/i.test(step.label + " " + step.detail));
  const skillsWithTools = skills.filter((skill) => skill.allowedTools.length > 0);
  const approvedOrPendingToolRequest = toolRequests.some((request) => ["approved", "pending"].includes(request.status));
  const blockedOrRejectedToolRequest = toolRequests.some((request) => ["blocked", "rejected"].includes(request.status));
  const hasAuditChain = auditLogs.length > 0;
  const hasEvalEvidence = skills.some((skill) => skill.evalPassRate >= 90);
  const hasRiskClassifiedSkills = skills.some((skill) => skill.riskLevel && skill.autonomyTier);

  const capabilities: AgentOpsCapability[] = [
    capability({
      id: "durable-runtime",
      name: "Durable runtime and resumable state",
      sourcePattern: "LangGraph / Microsoft Agent Framework",
      score: hasTraceChain ? (hasWaitingRun ? 78 : 64) : runs.length ? 42 : 18,
      evidence: hasTraceChain
        ? `${runs.length} run${runs.length === 1 ? "" : "s"} with step-level trace history${hasWaitingRun ? " and at least one paused approval state" : ""}.`
        : "No complete execution trace has been captured yet.",
      nextAction: hasWaitingRun
        ? "Persist approval checkpoints with resume tokens and replay/fork metadata."
        : "Add durable checkpoints at every workflow node plus resume/fork controls for long-running runs.",
    }),
    capability({
      id: "guardrail-stack",
      name: "Input, tool, and output guardrail stack",
      sourcePattern: "OpenAI Agents SDK / ADK Plugins",
      score: hasPolicyTrace && hasOutputValidation ? 88 : hasPolicyTrace ? 62 : 28,
      evidence: hasPolicyTrace
        ? `${traceSteps.filter((step) => /policy|permission|validation|safety/i.test(step.label + " " + step.detail)).length} policy or validation trace event${traceSteps.length === 1 ? "" : "s"} detected.`
        : "No policy or validation trace events detected.",
      nextAction: hasPolicyTrace && hasOutputValidation
        ? "Promote guardrails into global pre-run, pre-tool, post-tool, and post-output hooks."
        : "Add explicit user-input, connector-request, tool-output, and final-output gates to every run.",
    }),
    capability({
      id: "connector-broker",
      name: "Brokered connector and MCP authorization",
      sourcePattern: "MCP architecture and OAuth resource scoping",
      score: skillsWithTools.length && (approvedOrPendingToolRequest || blockedOrRejectedToolRequest) ? 86 : skillsWithTools.length ? 58 : 22,
      evidence: skillsWithTools.length
        ? `${skillsWithTools.length} Skill${skillsWithTools.length === 1 ? "" : "s"} expose governed tools; ${toolRequests.length} broker request${toolRequests.length === 1 ? "" : "s"} recorded.`
        : "No Skill has an allowed connector policy yet.",
      nextAction: approvedOrPendingToolRequest || blockedOrRejectedToolRequest
        ? "Add per-connector OAuth audience binding, scope diffing, and live capability refresh."
        : "Route every connector through the broker with discovered schema, risk tier, owner, scopes, and approval policy.",
    }),
    capability({
      id: "telemetry",
      name: "GenAI observability and cost telemetry",
      sourcePattern: "OpenTelemetry GenAI conventions",
      score: hasAuditChain && runs.length ? 74 : hasAuditChain || runs.length ? 46 : 14,
      evidence: hasAuditChain || runs.length
        ? `${auditLogs.length} audit log${auditLogs.length === 1 ? "" : "s"} and ${runs.length} traceable run${runs.length === 1 ? "" : "s"} available.`
        : "No traceable run or audit event exists yet.",
      nextAction: "Export OTel-shaped spans for model calls, agents, MCP tools, token usage, latency, errors, and approval gates.",
    }),
    capability({
      id: "evaluation",
      name: "Continuous eval and red-team loop",
      sourcePattern: "OpenAI evals / ADK evaluation",
      score: hasEvalEvidence ? 82 : skills.some((skill) => skill.evalPassRate > 0) ? 54 : 20,
      evidence: hasEvalEvidence
        ? `${skills.filter((skill) => skill.evalPassRate >= 90).length} Skill${skills.filter((skill) => skill.evalPassRate >= 90).length === 1 ? "" : "s"} exceed a 90% eval pass rate.`
        : "No Skill has strong launch eval evidence yet.",
      nextAction: "Run regression, tool-safety, prompt-injection, grounding, latency, and cost evals on every Skill version before promotion.",
    }),
    capability({
      id: "governance-evidence",
      name: "Governance evidence and control mapping",
      sourcePattern: "NIST AI RMF / ISO 42001 / OWASP LLM",
      score: hasAuditChain && hasRiskClassifiedSkills && hasEvalEvidence ? 84 : hasAuditChain || hasRiskClassifiedSkills ? 58 : 24,
      evidence: hasRiskClassifiedSkills
        ? `${skills.length} Skill${skills.length === 1 ? "" : "s"} carry risk and autonomy metadata; ${auditLogs.length} audit event${auditLogs.length === 1 ? "" : "s"} recorded.`
        : "Risk, autonomy, and audit evidence are not yet sufficient for executive assurance.",
      nextAction: "Attach every use case, Skill, run, eval, exception, and ROI assumption to mapped NIST/ISO/EU/OWASP controls.",
    }),
  ];

  const score = Math.round(capabilities.reduce((sum, item) => sum + item.score, 0) / capabilities.length);
  const status = statusFromScore(score);
  const ready = capabilities.filter((item) => item.status === "ready").length;
  const partial = capabilities.filter((item) => item.status === "partial").length;

  return {
    score,
    status,
    summary:
      capabilities.length === ready
        ? "The Harness matches the core production patterns for enterprise agent operations."
        : `${ready} ready, ${partial} partial, ${capabilities.length - ready - partial} gap${capabilities.length - ready - partial === 1 ? "" : "s"} against the enterprise agent-ops blueprint.`,
    capabilities,
  };
}
