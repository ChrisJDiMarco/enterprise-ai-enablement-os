import type { AuditLog, ContextSource, RiskLevel, Run, Skill, ToolRequest } from "./enterprise-ai-data.ts";
import { getUserName } from "./enterprise-ai-data.ts";
import type { ConnectorReadinessSummary } from "./enterprise-connectors.ts";

export type AgentAssetStatus = "active" | "learning" | "restricted" | "disabled" | "unmanaged";
export type AgentSecurityFindingSeverity = "low" | "medium" | "high" | "critical";
export type AgentSecurityFindingType =
  | "prompt_injection"
  | "behavior_deviation"
  | "tool_boundary"
  | "external_egress"
  | "privilege_escalation"
  | "shadow_agent"
  | "baseline_gap"
  | "connector_gap";

export type AgentAsset = {
  id: string;
  name: string;
  subject: string;
  owner: string;
  status: AgentAssetStatus;
  riskLevel: RiskLevel;
  autonomyTier: Skill["autonomyTier"];
  tools: string[];
  contextSources: string[];
  lastRun: string;
  runCount: number;
  approvalCount: number;
  killSwitchEngaged: boolean;
  blastRadius: "contained" | "departmental" | "enterprise" | "restricted";
  nextAction: string;
};

export type AgentBehaviorBaseline = {
  skillId: string;
  skillName: string;
  status: "none" | "learning" | "stable" | "drift-watch";
  sampleSize: number;
  normalTools: string[];
  normalContextSources: string[];
  normalStages: string[];
  avgLatencyMs: number;
  avgCostUsd: number;
  approvalRate: number;
  deviationSignals: string[];
  nextAction: string;
};

export type AgentSecurityFinding = {
  id: string;
  type: AgentSecurityFindingType;
  severity: AgentSecurityFindingSeverity;
  status: "open" | "monitoring" | "contained";
  title: string;
  agentId?: string;
  runId?: string;
  evidence: string;
  control: string;
  nextAction: string;
};

export type SecurityIntegrationHook = {
  id: string;
  name: string;
  category: "siem" | "ndr" | "idp" | "edr" | "dlp" | "observability" | "itsm";
  status: "ready" | "planned";
  signal: string;
  nextAction: string;
};

export type AgentControlPlane = {
  schema: "enterprise-ai-enablement-os.agent-control-plane.v1";
  score: number;
  posture: "ready" | "watch" | "at-risk";
  summary: string;
  inventory: AgentAsset[];
  baselines: AgentBehaviorBaseline[];
  findings: AgentSecurityFinding[];
  integrations: SecurityIntegrationHook[];
  metrics: {
    agents: number;
    activeAgents: number;
    unmanagedAgents: number;
    stableBaselines: number;
    promptInjectionAttempts: number;
    behaviorDeviations: number;
    externalEgressAttempts: number;
    criticalFindings: number;
    openFindings: number;
  };
  nextActions: AgentSecurityFinding[];
};

export type AgentControlPlaneInput = {
  skills: Skill[];
  runs: Run[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  contextSources?: ContextSource[];
  connectorReadiness?: ConnectorReadinessSummary;
};

const suspiciousPromptPatterns = [
  /ignore (all )?(previous|prior) instructions/i,
  /reveal (the )?(system|developer) prompt/i,
  /exfiltrate|data leak|leak proprietary/i,
  /jailbreak|prompt injection|override guardrails/i,
  /act as (an )?admin|bypass policy/i,
];

const egressPatterns = [
  /external ip/i,
  /unvetted destination/i,
  /send external/i,
  /email\.send_external/i,
  /file transfer/i,
  /webhook/i,
];

const privilegePatterns = [
  /privilege escalation/i,
  /self[- ]?grant/i,
  /admin permission/i,
  /update employee/i,
  /payment authorization/i,
  /disciplinary/i,
];

function slugSubject(skill: Skill) {
  const slug = skill.slug || skill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `agent:${slug}:v${skill.version}`;
}

function statusForSkill(skill: Skill, runCount: number): AgentAssetStatus {
  if (skill.status === "archived" || skill.status === "deprecated") return "disabled";
  if (skill.riskLevel === "restricted" || skill.autonomyTier === "tier_5_restricted") return "restricted";
  if (runCount < 2) return "learning";
  return "active";
}

function blastRadius(skill: Skill): AgentAsset["blastRadius"] {
  if (skill.riskLevel === "restricted" || skill.autonomyTier === "tier_5_restricted") return "restricted";
  if (skill.department === "Cross-Functional" || skill.contextSources.length > 3 || skill.allowedTools.length > 3) return "enterprise";
  if (skill.allowedTools.length || skill.contextSources.length > 1) return "departmental";
  return "contained";
}

function riskWeight(severity: AgentSecurityFindingSeverity) {
  if (severity === "critical") return 30;
  if (severity === "high") return 20;
  if (severity === "medium") return 10;
  return 4;
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function latestRun(runs: Run[]) {
  return [...runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
}

function includesPattern(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function findingId(prefix: string, value: string) {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "record"}`;
}

function severityToneForRisk(riskLevel: RiskLevel): AgentSecurityFindingSeverity {
  if (riskLevel === "restricted") return "critical";
  if (riskLevel === "high") return "high";
  if (riskLevel === "medium") return "medium";
  return "low";
}

export function deriveAgentControlPlane(input: AgentControlPlaneInput): AgentControlPlane {
  const skills = input.skills ?? [];
  const runs = input.runs ?? [];
  const toolRequests = input.toolRequests ?? [];
  const auditLogs = input.auditLogs ?? [];
  const connectorReadiness = input.connectorReadiness;

  const inventory: AgentAsset[] = skills.map((skill) => {
    const skillRuns = runs.filter((run) => run.skillId === skill.id);
    const skillRequests = toolRequests.filter((request) => request.skillId === skill.id);
    const last = latestRun(skillRuns);
    const status = statusForSkill(skill, skillRuns.length);
    const killSwitchEngaged = status === "disabled";
    const scope = blastRadius(skill);
    return {
      id: skill.id,
      name: skill.name,
      subject: slugSubject(skill),
      owner: getUserName(skill.ownerId),
      status,
      riskLevel: skill.riskLevel,
      autonomyTier: skill.autonomyTier,
      tools: skill.allowedTools,
      contextSources: skill.contextSources,
      lastRun: last?.startedAt ?? "No runs",
      runCount: skillRuns.length,
      approvalCount: skillRequests.filter((request) => ["approved", "rejected", "pending"].includes(request.status)).length,
      killSwitchEngaged,
      blastRadius: scope,
      nextAction: killSwitchEngaged
        ? "Keep disabled until owner, scopes, and incident notes are reviewed."
        : status === "learning"
          ? "Run the Skill through normal pilot scenarios until a behavior baseline stabilizes."
          : scope === "enterprise" || scope === "restricted"
            ? "Review enterprise blast radius, approval gates, and least-privilege tool scope."
            : "Keep owner attestations and policy decision evidence current.",
    };
  });

  const baselines: AgentBehaviorBaseline[] = skills.map((skill) => {
    const skillRuns = runs.filter((run) => run.skillId === skill.id);
    const skillRequests = toolRequests.filter((request) => request.skillId === skill.id);
    const normalStages = uniq(skillRuns.flatMap((run) => run.trace.map((step) => step.label)));
    const normalTools = uniq(skillRequests.map((request) => request.toolId));
    const avgLatencyMs = skillRuns.length
      ? Math.round(skillRuns.reduce((sum, run) => sum + run.latencyMs, 0) / skillRuns.length)
      : 0;
    const avgCostUsd = skillRuns.length
      ? Number((skillRuns.reduce((sum, run) => sum + run.costUsd, 0) / skillRuns.length).toFixed(4))
      : 0;
    const approvalRate = skillRequests.length
      ? Math.round((skillRequests.filter((request) => ["approved", "rejected", "pending"].includes(request.status)).length / skillRequests.length) * 100)
      : 0;
    const deviations = [
      ...skillRequests
        .filter((request) => !skill.allowedTools.includes(request.toolId))
        .map((request) => `Tool outside Skill policy: ${request.toolId}`),
      ...skillRuns
        .filter((run) => run.latencyMs > Math.max(avgLatencyMs * 2.5, 30000))
        .map((run) => `Latency spike on ${run.id}`),
      ...skillRuns
        .filter((run) => run.costUsd > Math.max(avgCostUsd * 3, skill.costLimit * 0.75))
        .map((run) => `Cost spike on ${run.id}`),
    ];
    const status: AgentBehaviorBaseline["status"] = skillRuns.length === 0
      ? "none"
      : skillRuns.length < 3
        ? "learning"
        : deviations.length
          ? "drift-watch"
          : "stable";

    return {
      skillId: skill.id,
      skillName: skill.name,
      status,
      sampleSize: skillRuns.length,
      normalTools,
      normalContextSources: skill.contextSources,
      normalStages,
      avgLatencyMs,
      avgCostUsd,
      approvalRate,
      deviationSignals: uniq(deviations).slice(0, 6),
      nextAction:
        status === "stable"
          ? "Continue monitoring for tool, destination, latency, cost, and approval-rate drift."
          : status === "drift-watch"
            ? "Review drift signals, compare with approved workflow changes, and rerun evals before scaling."
            : "Capture more normal runs before increasing autonomy or adding tools.",
    };
  });

  const findings: AgentSecurityFinding[] = [];

  for (const run of runs) {
    const skill = skills.find((item) => item.id === run.skillId);
    const text = `${run.output} ${run.currentStage} ${run.trace.map((step) => `${step.label} ${step.detail}`).join(" ")}`;
    if (includesPattern(text, suspiciousPromptPatterns)) {
      findings.push({
        id: findingId("prompt-injection", run.id),
        type: "prompt_injection",
        severity: "high",
        status: run.status === "blocked" ? "contained" : "open",
        title: "Potential prompt injection or instruction override detected",
        agentId: run.skillId,
        runId: run.id,
        evidence: `${run.id}: suspicious instruction pattern appeared in output or trace text.`,
        control: "OWASP.LLM01 / OWASP.LLM05 / NIST.MEASURE",
        nextAction: "Inspect retrieved context, confirm untrusted-content boundaries, and rerun prompt-injection evals.",
      });
    }

    if (includesPattern(text, egressPatterns)) {
      findings.push({
        id: findingId("external-egress", run.id),
        type: "external_egress",
        severity: run.riskLevel === "low" ? "medium" : "high",
        status: run.status === "blocked" ? "contained" : "open",
        title: "Unexpected external destination or egress-like behavior",
        agentId: run.skillId,
        runId: run.id,
        evidence: `${run.id}: trace/output mentions external send, transfer, webhook, or unvetted destination.`,
        control: "OWASP.MCP07 / NIST.MANAGE / ISO42001.MONITORING",
        nextAction: "Validate destination allowlist, DLP policy, and broker approval evidence before resuming execution.",
      });
    }

    if (skill && skill.autonomyTier !== "tier_0_draft_only" && skill.autonomyTier !== "tier_1_read_only") {
      const hasApprovalEvidence = toolRequests.some((request) => request.runId === run.id);
      if (skill.allowedTools.length > 0 && !hasApprovalEvidence && skill.riskLevel !== "low") {
        findings.push({
          id: findingId("approval-gap", run.id),
          type: "behavior_deviation",
          severity: "medium",
          status: "monitoring",
          title: "Action-capable run has thin approval evidence",
          agentId: run.skillId,
          runId: run.id,
          evidence: `${run.id}: ${skill.name} has ${skill.allowedTools.length} allowed tool(s), but no broker approval record is attached to the run.`,
          control: "EUAI.HUMAN_OVERSIGHT / ISO42001.CONTROL",
          nextAction: "Confirm whether the run was read-only; otherwise require broker-mediated approval evidence.",
        });
      }
    }
  }

  for (const request of toolRequests) {
    const skill = skills.find((item) => item.id === request.skillId);
    if (skill && !skill.allowedTools.includes(request.toolId)) {
      findings.push({
        id: findingId("tool-boundary", request.id),
        type: "tool_boundary",
        severity: "critical",
        status: request.status === "blocked" || request.status === "rejected" ? "contained" : "open",
        title: "Tool request is outside the Skill allowlist",
        agentId: request.skillId,
        runId: request.runId,
        evidence: `${request.toolId} was requested by ${skill.name}, but it is not in the Skill allowlist.`,
        control: "OWASP.MCP04 / NIST.MANAGE",
        nextAction: "Block execution, review policy drift, and require owner approval for any allowlist change.",
      });
    }
    if (includesPattern(`${request.toolId} ${request.reason}`, privilegePatterns)) {
      findings.push({
        id: findingId("privilege", request.id),
        type: "privilege_escalation",
        severity: severityToneForRisk(request.riskLevel),
        status: request.status === "blocked" || request.status === "rejected" ? "contained" : "open",
        title: "Privileged action requires security review",
        agentId: request.skillId,
        runId: request.runId,
        evidence: `${request.toolId}: ${request.reason}`,
        control: "NIST.GOVERN / EUAI.HUMAN_OVERSIGHT",
        nextAction: "Require Security/Privacy approval, validate role scope, and preserve broker decision evidence.",
      });
    }
  }

  for (const log of auditLogs) {
    const text = `${log.eventType} ${log.actor} ${log.message}`;
    if (includesPattern(text, suspiciousPromptPatterns)) {
      findings.push({
        id: findingId("audit-prompt-injection", log.id),
        type: "prompt_injection",
        severity: "high",
        status: log.eventType.includes("blocked") || log.message.toLowerCase().includes("blocked") ? "contained" : "open",
        title: "Prompt injection signal appeared in audit evidence",
        evidence: log.message,
        control: "OWASP.LLM01 / ISO42001.MONITORING",
        nextAction: "Attach this audit event to the red-team regression suite and validate affected Skills.",
      });
    }
    if (includesPattern(text, egressPatterns)) {
      findings.push({
        id: findingId("audit-egress", log.id),
        type: "external_egress",
        severity: log.riskLevel === "low" ? "medium" : "high",
        status: log.eventType.includes("blocked") ? "contained" : "open",
        title: "Audit log references external egress behavior",
        evidence: log.message,
        control: "OWASP.MCP07 / DLP.EGRESS",
        nextAction: "Correlate this event with SIEM/NDR/DLP telemetry and verify destination allowlist.",
      });
    }
    if (/unsanctioned|shadow ai|unmanaged agent|unknown agent/i.test(text)) {
      findings.push({
        id: findingId("shadow-agent", log.id),
        type: "shadow_agent",
        severity: "high",
        status: "open",
        title: "Possible unmanaged agent activity",
        evidence: log.message,
        control: "NIST.IDENTIFY / ISO42001.ASSET_INVENTORY",
        nextAction: "Add the agent or MCP server to inventory, assign an owner, or block the endpoint.",
      });
    }
  }

  for (const asset of inventory) {
    if (asset.status !== "disabled" && asset.owner === "User not configured") {
      findings.push({
        id: findingId("owner-gap", asset.id),
        type: "baseline_gap",
        severity: "medium",
        status: "open",
        title: "Agent identity is missing an accountable owner",
        agentId: asset.id,
        evidence: `${asset.name} resolves to an unconfigured owner.`,
        control: "ISO42001.ACCOUNTABILITY / NIST.GOVERN",
        nextAction: "Assign a named business owner and reviewer group before expanding usage.",
      });
    }
  }

  for (const baseline of baselines) {
    const asset = inventory.find((item) => item.id === baseline.skillId);
    if (asset && ["departmental", "enterprise", "restricted"].includes(asset.blastRadius) && baseline.sampleSize < 3 && asset.status !== "disabled") {
      findings.push({
        id: findingId("baseline-gap", baseline.skillId),
        type: "baseline_gap",
        severity: asset.blastRadius === "restricted" ? "high" : "medium",
        status: "monitoring",
        title: "Behavior baseline is not mature enough for higher autonomy",
        agentId: baseline.skillId,
        evidence: `${baseline.skillName} has ${baseline.sampleSize} recorded run(s); stable baselines require at least 3 normal executions.`,
        control: "NIST.MEASURE / ISO42001.MONITORING",
        nextAction: "Run representative scenarios, then compare normal tools, context, cost, latency, and approvals before increasing autonomy.",
      });
    }
    for (const signal of baseline.deviationSignals) {
      findings.push({
        id: findingId("behavior-deviation", `${baseline.skillId}-${signal}`),
        type: "behavior_deviation",
        severity: "medium",
        status: "open",
        title: "Behavior deviation detected against baseline",
        agentId: baseline.skillId,
        evidence: signal,
        control: "NIST.MEASURE / OTEL.ANOMALY",
        nextAction: "Inspect recent changes, compare approved workflow spec, and rerun regression evals.",
      });
    }
  }

  if (connectorReadiness && !connectorReadiness.productionReady) {
    findings.push({
      id: "connector-gap-production-broker",
      type: "connector_gap",
      severity: "high",
      status: "open",
      title: "Connector/MCP broker is not production-ready",
      evidence: `${connectorReadiness.readyCount}/${connectorReadiness.requiredCount} connector families ready or broker-managed; mode ${connectorReadiness.brokerMode}.`,
      control: "OWASP.MCP / ISO42001.OPERATION",
      nextAction: "Activate an MCP broker or at least two native connector families before enabling production automation.",
    });
  }

  const dedupedFindings = Array.from(new Map(findings.map((finding) => [finding.id, finding])).values())
    .sort((a, b) => riskWeight(b.severity) - riskWeight(a.severity))
    .slice(0, 100);

  const integrations: SecurityIntegrationHook[] = [
    {
      id: "siem",
      name: "SIEM / security data lake",
      category: "siem",
      status: dedupedFindings.some((finding) => finding.type !== "baseline_gap") ? "ready" : "planned",
      signal: "Policy decisions, prompt-injection alerts, connector blocks, and audit integrity events.",
      nextAction: "Export Agent Control Plane findings into Splunk, Sentinel, Datadog, or the customer SIEM.",
    },
    {
      id: "ndr",
      name: "Network detection and response",
      category: "ndr",
      status: dedupedFindings.some((finding) => finding.type === "external_egress") ? "ready" : "planned",
      signal: "Agent-to-tool destination anomalies and unexpected external egress attempts.",
      nextAction: "Correlate MCP broker destinations with ExtraHop, Zscaler, Palo Alto, or network telemetry.",
    },
    {
      id: "idp",
      name: "Identity provider and SCIM",
      category: "idp",
      status: inventory.every((asset) => asset.owner !== "User not configured") && inventory.length ? "ready" : "planned",
      signal: "Agent subjects, owner identity, reviewer roles, and lifecycle deprovisioning.",
      nextAction: "Map agent owners/reviewers to Entra, Okta, or customer IdP groups.",
    },
    {
      id: "observability",
      name: "Agent observability",
      category: "observability",
      status: runs.length ? "ready" : "planned",
      signal: "Run traces, model route, latency, cost, approval waits, output policy, and error state.",
      nextAction: "Ship OTel-shaped spans for every Harness and connector stage.",
    },
    {
      id: "itsm",
      name: "ITSM / incident workflow",
      category: "itsm",
      status: dedupedFindings.some((finding) => ["critical", "high"].includes(finding.severity)) ? "ready" : "planned",
      signal: "High-severity AI incidents, owner assignment, containment, and remediation SLAs.",
      nextAction: "Create ServiceNow/Jira incidents from high-severity Agent Control Plane findings.",
    },
  ];

  const promptInjectionAttempts = dedupedFindings.filter((finding) => finding.type === "prompt_injection").length;
  const behaviorDeviations = dedupedFindings.filter((finding) => finding.type === "behavior_deviation").length;
  const externalEgressAttempts = dedupedFindings.filter((finding) => finding.type === "external_egress").length;
  const criticalFindings = dedupedFindings.filter((finding) => finding.severity === "critical").length;
  const openFindings = dedupedFindings.filter((finding) => finding.status === "open").length;
  const unmanagedAgents = inventory.filter((asset) => asset.status === "unmanaged" || asset.owner === "User not configured").length;
  const stableBaselines = baselines.filter((baseline) => baseline.status === "stable").length;
  const rawScore = 100
    - dedupedFindings.reduce((sum, finding) => sum + riskWeight(finding.severity), 0)
    + stableBaselines * 3
    - unmanagedAgents * 8;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const posture: AgentControlPlane["posture"] = criticalFindings || score < 55 ? "at-risk" : openFindings || score < 82 ? "watch" : "ready";

  return {
    schema: "enterprise-ai-enablement-os.agent-control-plane.v1",
    score,
    posture,
    summary: inventory.length
      ? `${inventory.length} governed agent${inventory.length === 1 ? "" : "s"}, ${stableBaselines} stable baseline${stableBaselines === 1 ? "" : "s"}, ${openFindings} open security finding${openFindings === 1 ? "" : "s"}, and ${promptInjectionAttempts} prompt-injection signal${promptInjectionAttempts === 1 ? "" : "s"} are visible.`
      : "No governed agent assets exist yet. Create a Skill to establish the first accountable agent identity.",
    inventory,
    baselines,
    findings: dedupedFindings,
    integrations,
    metrics: {
      agents: inventory.length,
      activeAgents: inventory.filter((asset) => asset.status === "active").length,
      unmanagedAgents,
      stableBaselines,
      promptInjectionAttempts,
      behaviorDeviations,
      externalEgressAttempts,
      criticalFindings,
      openFindings,
    },
    nextActions: dedupedFindings
      .filter((finding) => finding.status === "open")
      .sort((a, b) => riskWeight(b.severity) - riskWeight(a.severity))
      .slice(0, 5),
  };
}
