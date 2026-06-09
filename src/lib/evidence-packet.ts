import type { ConnectorEvent } from "./connector-events.ts";
import { deriveAgentControlPlane } from "./agent-control-plane.ts";
import { verifyAuditChain, type AuditIntegrityVerification } from "./audit-integrity.ts";
import type { EvaluationArtifact } from "./evaluation-runner.ts";
import type { HarnessTraceRecord } from "./trace-store.ts";
import type { EnterpriseWorkspace } from "./workspace-schema.ts";

export type EvidencePacketItem = {
  id: string;
  type: "use_case" | "skill" | "run_trace" | "eval" | "governance" | "connector" | "security" | "audit" | "roi";
  title: string;
  control: string;
  riskLevel: string;
  evidence: string;
  sourceId?: string;
  createdAt?: string;
};

export type EvidencePacket = {
  schema: "enterprise-ai-enablement-os.evidence-packet.v2";
  organizationId: string;
  generatedAt: string;
  summary: {
    totalItems: number;
    useCases: number;
    skills: number;
    traces: number;
    evalArtifacts: number;
    governanceReviews: number;
    connectorEvents: number;
    securityFindings: number;
    auditLogs: number;
    estimatedAnnualValue: number;
  };
  controls: {
    nistAiRmf: number;
    iso42001: number;
    euAiAct: number;
    owaspLlmMcp: number;
  };
  auditIntegrity: AuditIntegrityVerification;
  items: EvidencePacketItem[];
  gaps: string[];
  markdown: string;
};

function pct(complete: number, total: number) {
  return total <= 0 ? 0 : Math.min(100, Math.round((complete / total) * 100));
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function annualValueEstimate(useCase: EnterpriseWorkspace["useCases"][number]) {
  return Math.round(((useCase.monthlyVolume * useCase.avgHandlingTimeMinutes) / 60) * 65 * 12 * 0.35);
}

function buildMarkdown(packet: Omit<EvidencePacket, "markdown">) {
  const lines = [
    `# ${packet.organizationId} AI Enablement Evidence Packet`,
    "",
    `Generated: ${packet.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Evidence items: ${packet.summary.totalItems}`,
    `- Use cases: ${packet.summary.useCases}`,
    `- Skills: ${packet.summary.skills}`,
    `- Harness traces: ${packet.summary.traces}`,
    `- Eval evidence records: ${packet.summary.evalArtifacts}`,
    `- Governance reviews: ${packet.summary.governanceReviews}`,
    `- Connector events: ${packet.summary.connectorEvents}`,
    `- Agent security findings: ${packet.summary.securityFindings}`,
    `- Estimated annual value: ${money(packet.summary.estimatedAnnualValue)}`,
    `- Audit integrity: ${packet.auditIntegrity.verified ? "verified" : "needs attention"} (${packet.auditIntegrity.sealed}/${packet.auditIntegrity.checked} sealed)`,
    "",
    "## Control Coverage",
    "",
    `- NIST AI RMF: ${packet.controls.nistAiRmf}%`,
    `- ISO/IEC 42001: ${packet.controls.iso42001}%`,
    `- EU AI Act: ${packet.controls.euAiAct}%`,
    `- OWASP LLM/MCP: ${packet.controls.owaspLlmMcp}%`,
    "",
    "## Evidence",
    "",
    ...packet.items.slice(0, 100).flatMap((item) => [
      `### ${item.title}`,
      "",
      `- Type: ${item.type}`,
      `- Control: ${item.control}`,
      `- Risk: ${item.riskLevel}`,
      `- Evidence: ${item.evidence}`,
      item.sourceId ? `- Source: ${item.sourceId}` : "",
      "",
    ].filter(Boolean)),
  ];

  if (packet.gaps.length) {
    lines.push("## Gaps", "", ...packet.gaps.map((gap) => `- ${gap}`), "");
  }

  return lines.join("\n");
}

export function buildEvidencePacket(params: {
  workspace: EnterpriseWorkspace;
  traces?: HarnessTraceRecord[];
  evalArtifacts?: EvaluationArtifact[];
  connectorEvents?: ConnectorEvent[];
}): EvidencePacket {
  const { workspace } = params;
  const traces = params.traces ?? [];
  const evalArtifacts = params.evalArtifacts ?? [];
  const connectorEvents = params.connectorEvents ?? [];
  const artifactResultIds = new Set(evalArtifacts.map((artifact) => artifact.result.id));
  const workspaceEvalResults = workspace.evalResults.filter((result) => !artifactResultIds.has(result.id));
  const agentControlPlane = deriveAgentControlPlane({
    skills: workspace.skills,
    runs: workspace.runs,
    toolRequests: workspace.toolRequests,
    auditLogs: workspace.auditLogs,
    contextSources: workspace.contextSources,
  });
  const estimatedAnnualValue = workspace.useCases.reduce((sum, useCase) => sum + annualValueEstimate(useCase), 0);
  const auditIntegrity = verifyAuditChain(workspace.organizationId, workspace.auditLogs);

  const items: EvidencePacketItem[] = [
    ...workspace.useCases.map((useCase) => ({
      id: `use-case-${useCase.id}`,
      type: "use_case" as const,
      title: useCase.title,
      control: "NIST.MAP / ISO42001.PLANNING / EU_AI_ACT.RISK_MANAGEMENT",
      riskLevel: useCase.riskLevel,
      evidence: `${useCase.department} opportunity scored ${useCase.priorityScore}/100 with ${useCase.status} status and ${money(annualValueEstimate(useCase))} estimated annual value.`,
      sourceId: useCase.id,
      createdAt: useCase.createdAt,
    })),
    ...workspace.skills.map((skill) => ({
      id: `skill-${skill.id}`,
      type: "skill" as const,
      title: skill.name,
      control: "NIST.MANAGE / ISO42001.OPERATION / OWASP_LLM.TOOL_BOUNDARY",
      riskLevel: skill.riskLevel,
      evidence: `Version ${skill.version}; autonomy ${skill.autonomyTier}; ${skill.allowedTools.length} allowed tools; ${skill.contextSources.length} context sources; ${skill.evalPassRate}% eval score.`,
      sourceId: skill.id,
      createdAt: skill.updatedAt,
    })),
    ...traces.map((trace) => ({
      id: trace.id,
      type: "run_trace" as const,
      title: `Harness trace ${trace.runId}`,
      control: "NIST.MEASURE / OWASP_LLM.LOGGING / ISO42001.MONITORING",
      riskLevel: trace.riskLevel,
      evidence: `${trace.status} run using ${trace.route.provider}/${trace.route.model}; ${trace.run.trace.length} trace steps; prompt contract ${trace.prompt.contractId}; ${trace.model.inputTokens + trace.model.outputTokens} tokens.`,
      sourceId: trace.runId,
      createdAt: trace.createdAt,
    })),
    ...evalArtifacts.map((artifact) => ({
      id: artifact.id,
      type: "eval" as const,
      title: artifact.suiteName,
      control: "NIST.MEASURE / ISO42001.EVALUATION / OWASP_LLM.TESTING",
      riskLevel: artifact.passed ? "low" : "high",
      evidence: `${artifact.skillId} scored ${artifact.score}/100 against threshold ${artifact.threshold}; ${artifact.passed ? "passed" : "failed"}.`,
      sourceId: artifact.skillId,
      createdAt: artifact.createdAt,
    })),
    ...workspaceEvalResults.map((result) => ({
      id: `eval-${result.id}`,
      type: "eval" as const,
      title: result.suiteName,
      control: "NIST.MEASURE / ISO42001.EVALUATION / OWASP_LLM.TESTING",
      riskLevel: result.passed && result.criticalFailures === 0 ? "low" : "high",
      evidence: `${result.skillId} scored ${result.score}/100; ${result.passed ? "passed" : "failed"} with ${result.criticalFailures} critical failure${result.criticalFailures === 1 ? "" : "s"}.`,
      sourceId: result.skillId,
      createdAt: result.createdAt,
    })),
    ...workspace.governanceReviews.map((review) => ({
      id: `governance-${review.id}`,
      type: "governance" as const,
      title: review.title,
      control: "NIST.GOVERN / EU_AI_ACT.HUMAN_OVERSIGHT / ISO42001.REVIEW",
      riskLevel: review.riskLevel,
      evidence: `${review.reviewer} review is ${review.status}; blockers: ${review.blockers.join(", ") || "none"}.`,
      sourceId: review.id,
      createdAt: review.dueDate,
    })),
    ...connectorEvents.map((event) => ({
      id: event.id,
      type: "connector" as const,
      title: `Connector event ${event.toolId}`,
      control: "OWASP_LLM.MCP / NIST.MANAGE / ISO42001.OPERATION",
      riskLevel: event.decision.riskLevel,
      evidence: `${event.status}; policy ${event.decision.policyId}; ${event.decision.reason}`,
      sourceId: event.toolId,
      createdAt: event.createdAt,
    })),
    ...agentControlPlane.findings.map((finding) => ({
      id: `security-${finding.id}`,
      type: "security" as const,
      title: finding.title,
      control: finding.control,
      riskLevel: finding.severity,
      evidence: `${finding.evidence} Next action: ${finding.nextAction}`,
      sourceId: finding.runId ?? finding.agentId ?? finding.id,
      createdAt: finding.runId
        ? workspace.runs.find((run) => run.id === finding.runId)?.startedAt
        : undefined,
    })),
    ...workspace.auditLogs.slice(0, 500).map((log) => ({
      id: `audit-${log.id}`,
      type: "audit" as const,
      title: log.eventType,
      control: "ISO42001.CHANGE_RECORD / NIST.GOVERN",
      riskLevel: log.riskLevel,
      evidence: log.message,
      sourceId: log.id,
      createdAt: log.createdAt,
    })),
  ];

  const gaps = [
    workspace.useCases.length ? "" : "No scored use cases are present.",
    workspace.skills.length ? "" : "No governed Skills are present.",
    traces.length ? "" : "No durable Harness traces are present.",
    evalArtifacts.length || workspace.evalResults.length ? "" : "No eval evidence records are present.",
    workspace.governanceReviews.length ? "" : "No governance review records are present.",
    connectorEvents.length ? "" : "No connector execution events are present.",
    agentControlPlane.findings.some((finding) => finding.severity === "critical" || finding.severity === "high")
      ? "High-severity Agent Control Plane findings need containment evidence before board-ready launch."
      : "",
  ].filter(Boolean);

  const packetWithoutMarkdown = {
    schema: "enterprise-ai-enablement-os.evidence-packet.v2" as const,
    organizationId: workspace.organizationId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalItems: items.length,
      useCases: workspace.useCases.length,
      skills: workspace.skills.length,
      traces: traces.length,
      evalArtifacts: evalArtifacts.length + workspace.evalResults.length,
      governanceReviews: workspace.governanceReviews.length,
      connectorEvents: connectorEvents.length,
      securityFindings: agentControlPlane.findings.length,
      auditLogs: workspace.auditLogs.length,
      estimatedAnnualValue,
    },
    controls: {
      nistAiRmf: pct(items.filter((item) => item.control.includes("NIST")).length, 6),
      iso42001: pct(items.filter((item) => item.control.includes("ISO42001")).length, 6),
      euAiAct: pct(items.filter((item) => item.control.includes("EU_AI_ACT")).length, 3),
      owaspLlmMcp: pct(items.filter((item) => item.control.includes("OWASP_LLM")).length, 4),
    },
    auditIntegrity,
    items,
    gaps,
  };

  return {
    ...packetWithoutMarkdown,
    markdown: buildMarkdown(packetWithoutMarkdown),
  };
}
