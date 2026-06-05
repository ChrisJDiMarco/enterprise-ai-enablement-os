import { deriveProductionLaunchSequence } from "./production-launch-sequence.ts";
import type { ProductionReadiness } from "./ui/types.ts";
import type { EvidencePacket } from "./evidence-packet.ts";
import type { EnterpriseWorkspace } from "./workspace-schema.ts";

export type CustomerLaunchPacket = {
  schema: "enterprise-ai-enablement-os.customer-launch-packet.v1";
  organizationId: string;
  organizationName: string;
  generatedAt: string;
  launchStatus: "ready" | "needs-work" | "blocked";
  launchScore: number;
  executiveSummary: string;
  recommendedNextMove: {
    title: string;
    owner: string;
    action: string;
    verify: string;
  };
  operatingSnapshot: {
    useCases: number;
    skills: number;
    pilots: number;
    runs: number;
    governanceReviews: number;
    evalArtifacts: number;
    evidenceItems: number;
    estimatedAnnualValue: number;
  };
  launchSequence: ReturnType<typeof deriveProductionLaunchSequence>;
  manualActions: NonNullable<ProductionReadiness["manualActions"]>;
  evidence: {
    schema: EvidencePacket["schema"];
    summary: EvidencePacket["summary"];
    controls: EvidencePacket["controls"];
    auditIntegrity: EvidencePacket["auditIntegrity"];
    gaps: EvidencePacket["gaps"];
    topItems: EvidencePacket["items"];
  };
  markdown: string;
};

function statusFromReadiness(readiness: ProductionReadiness | null): CustomerLaunchPacket["launchStatus"] {
  const status = readiness?.customerLaunchContract?.status;
  if (status === "ready" || status === "blocked") return status;
  if (readiness?.status === "blocked") return "blocked";
  return "needs-work";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function firstManualAction(readiness: ProductionReadiness | null) {
  return readiness?.manualActions?.[0] ?? null;
}

function executiveSummary(params: {
  workspace: EnterpriseWorkspace;
  readiness: ProductionReadiness | null;
  evidencePacket: EvidencePacket;
  launchStatus: CustomerLaunchPacket["launchStatus"];
}) {
  const contract = params.readiness?.customerLaunchContract;
  const statusText =
    params.launchStatus === "ready"
      ? "ready for a controlled customer launch"
      : params.launchStatus === "blocked"
        ? "blocked for customer launch until production controls are completed"
        : "ready for private evaluation with documented launch work remaining";
  const value = money(params.evidencePacket.summary.estimatedAnnualValue);
  const nextAction = firstManualAction(params.readiness);

  return [
    `${params.workspace.organization.name} is ${statusText}.`,
    `The launch contract score is ${contract?.score ?? 0}/100 with ${contract?.readyCount ?? 0} ready domains, ${contract?.needsWorkCount ?? 0} needs-work domains, and ${contract?.blockedCount ?? 0} blocked domains.`,
    `The current evidence packet contains ${params.evidencePacket.summary.totalItems} evidence items across use cases, Skills, traces, evals, governance, connectors, audit logs, and ROI assumptions, with ${value} in estimated annual value.`,
    nextAction
      ? `The recommended next move is "${nextAction.title}" owned by ${nextAction.owner}.`
      : "No launch blockers remain; the next move is a controlled pilot launch and executive readout.",
  ].join(" ");
}

function buildMarkdown(packet: Omit<CustomerLaunchPacket, "markdown">) {
  const lines = [
    `# ${packet.organizationName} Customer Launch Packet`,
    "",
    `Generated: ${packet.generatedAt}`,
    `Status: ${packet.launchStatus}`,
    `Launch score: ${packet.launchScore}/100`,
    "",
    "## Executive Summary",
    "",
    packet.executiveSummary,
    "",
    "## Recommended Next Move",
    "",
    `- Title: ${packet.recommendedNextMove.title}`,
    `- Owner: ${packet.recommendedNextMove.owner}`,
    `- Action: ${packet.recommendedNextMove.action}`,
    `- Verify: ${packet.recommendedNextMove.verify}`,
    "",
    "## Operating Snapshot",
    "",
    `- Use cases: ${packet.operatingSnapshot.useCases}`,
    `- Skills: ${packet.operatingSnapshot.skills}`,
    `- Active pilots: ${packet.operatingSnapshot.pilots}`,
    `- Harness runs: ${packet.operatingSnapshot.runs}`,
    `- Governance reviews: ${packet.operatingSnapshot.governanceReviews}`,
    `- Eval artifacts: ${packet.operatingSnapshot.evalArtifacts}`,
    `- Evidence items: ${packet.operatingSnapshot.evidenceItems}`,
    `- Estimated annual value: ${money(packet.operatingSnapshot.estimatedAnnualValue)}`,
    "",
    "## Launch Sequence",
    "",
    ...packet.launchSequence.flatMap((step) => [
      `### ${step.label}`,
      "",
      `- Owner: ${step.owner}`,
      `- Status: ${step.status}`,
      `- Summary: ${step.summary}`,
      step.env.length ? `- Env: ${step.env.join(", ")}` : "- Env: none",
      step.verify.length ? `- Verify: ${step.verify.join(" | ")}` : "- Verify: no action required",
      "",
    ]),
    "## Manual Actions",
    "",
    ...(packet.manualActions.length
      ? packet.manualActions.flatMap((action, index) => [
          `${index + 1}. [${action.severity.toUpperCase()}] ${action.title}`,
          `   Owner: ${action.owner}`,
          `   Action: ${action.action}`,
          `   Why: ${action.why}`,
          action.env.length ? `   Env: ${action.env.join(", ")}` : "",
          `   Verify: ${action.verify}`,
          "",
        ].filter(Boolean))
      : ["All launch actions are complete.", ""]),
    "## Evidence Summary",
    "",
    `- Evidence packet schema: ${packet.evidence.schema}`,
    `- Audit integrity: ${packet.evidence.auditIntegrity.verified ? "verified" : "needs attention"}`,
    `- NIST AI RMF coverage: ${packet.evidence.controls.nistAiRmf}%`,
    `- ISO/IEC 42001 coverage: ${packet.evidence.controls.iso42001}%`,
    `- EU AI Act coverage: ${packet.evidence.controls.euAiAct}%`,
    `- OWASP LLM/MCP coverage: ${packet.evidence.controls.owaspLlmMcp}%`,
    "",
  ];

  if (packet.evidence.gaps.length) {
    lines.push("## Evidence Gaps", "", ...packet.evidence.gaps.map((gap) => `- ${gap}`), "");
  }

  return lines.join("\n");
}

export function buildCustomerLaunchPacket(params: {
  workspace: EnterpriseWorkspace;
  readiness: ProductionReadiness | null;
  evidencePacket: EvidencePacket;
}): CustomerLaunchPacket {
  const { workspace, readiness, evidencePacket } = params;
  const launchStatus = statusFromReadiness(readiness);
  const launchScore = readiness?.customerLaunchContract?.score ?? 0;
  const nextAction = firstManualAction(readiness);
  const packetWithoutMarkdown = {
    schema: "enterprise-ai-enablement-os.customer-launch-packet.v1" as const,
    organizationId: workspace.organizationId,
    organizationName: workspace.organization.name,
    generatedAt: new Date().toISOString(),
    launchStatus,
    launchScore,
    executiveSummary: executiveSummary({ workspace, readiness, evidencePacket, launchStatus }),
    recommendedNextMove: nextAction
      ? {
          title: nextAction.title,
          owner: nextAction.owner,
          action: nextAction.action,
          verify: nextAction.verify,
        }
      : {
          title: "Launch controlled pilot",
          owner: "Operations",
          action: "Invite the approved pilot group, run the first governed Skill, and generate the executive readout.",
          verify: "Confirm pilot run traces, eval artifacts, governance approvals, and adoption metrics are present.",
        },
    operatingSnapshot: {
      useCases: workspace.useCases.length,
      skills: workspace.skills.length,
      pilots: workspace.useCases.filter((item) => ["approved_for_pilot", "in_pilot", "measuring"].includes(item.status)).length,
      runs: workspace.runs.length,
      governanceReviews: workspace.governanceReviews.length,
      evalArtifacts: evidencePacket.summary.evalArtifacts,
      evidenceItems: evidencePacket.summary.totalItems,
      estimatedAnnualValue: evidencePacket.summary.estimatedAnnualValue,
    },
    launchSequence: deriveProductionLaunchSequence(readiness),
    manualActions: readiness?.manualActions ?? [],
    evidence: {
      schema: evidencePacket.schema,
      summary: evidencePacket.summary,
      controls: evidencePacket.controls,
      auditIntegrity: evidencePacket.auditIntegrity,
      gaps: evidencePacket.gaps,
      topItems: evidencePacket.items.slice(0, 25),
    },
  };

  return {
    ...packetWithoutMarkdown,
    markdown: buildMarkdown(packetWithoutMarkdown),
  };
}
