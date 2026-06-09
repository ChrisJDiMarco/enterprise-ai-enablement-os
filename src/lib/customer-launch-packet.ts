import { deriveProductionLaunchSequence } from "./production-launch-sequence.ts";
import type { ProductionReadiness } from "./ui/types.ts";
import {
  buildEnterpriseAiControlPlaneResponse,
  type EnterpriseAiControlPlaneResponse,
} from "./enterprise-ai-control-plane-response.ts";
import { deriveEnterpriseMaturity } from "./enterprise-maturity.ts";
import { deriveIntegrationBlueprint } from "./integration-blueprint.ts";
import { derivePrimetimeLaunchGate, type PrimetimeLaunchGate } from "./primetime-launch-gate.ts";
import type { EvidencePacket } from "./evidence-packet.ts";
import type { EnterpriseWorkspace } from "./workspace-schema.ts";

type LaunchEvidenceAcceptanceStatus = "met" | "partial" | "missing";

export type LaunchEvidenceAcceptanceCriterion = {
  id: string;
  label: string;
  status: LaunchEvidenceAcceptanceStatus;
  evidence: string;
  requiredFor: "pilot" | "production";
  nextAction: string;
};

export type LaunchControlPlaneSnapshot = {
  schema: EnterpriseAiControlPlaneResponse["schema"];
  posture: EnterpriseAiControlPlaneResponse["controlPlane"]["posture"];
  score: number;
  summary: string;
  metrics: EnterpriseAiControlPlaneResponse["controlPlane"]["metrics"];
  priorityActions: EnterpriseAiControlPlaneResponse["controlPlane"]["priorityActions"];
  readinessInputs: EnterpriseAiControlPlaneResponse["readinessInputs"];
  privacyBoundary: string;
};

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
  primetimeGate: PrimetimeLaunchGate;
  enterpriseControlPlane: LaunchControlPlaneSnapshot;
  acceptanceCriteria: LaunchEvidenceAcceptanceCriterion[];
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

function buildRecommendedNextMove(params: {
  readiness: ProductionReadiness | null;
  launchStatus: CustomerLaunchPacket["launchStatus"];
  acceptanceCriteria: LaunchEvidenceAcceptanceCriterion[];
}): CustomerLaunchPacket["recommendedNextMove"] {
  const manualAction = firstManualAction(params.readiness);
  if (manualAction) {
    return {
      title: manualAction.title,
      owner: manualAction.owner,
      action: manualAction.action,
      verify: manualAction.verify,
    };
  }

  if (params.launchStatus === "ready") {
    return {
      title: "Launch controlled pilot",
      owner: "Operations",
      action: "Invite the approved pilot group, run the first governed Skill, and generate the executive readout.",
      verify: "Confirm pilot run traces, eval evidence records, governance approvals, and adoption metrics are present.",
    };
  }

  if (!params.readiness) {
    return {
      title: "Run launch readiness check",
      owner: "Operations",
      action: "Load tenant readiness evidence, run production preflight, and confirm runtime, evidence, and launch contract domains before inviting a pilot group.",
      verify: "Confirm readiness evidence is loaded, production runtime status is known, and the customer launch contract has a current score.",
    };
  }

  if (!params.readiness.customerLaunchContract) {
    return {
      title: "Generate customer launch contract",
      owner: "Operations",
      action: "Refresh tenant readiness evidence and rebuild the customer launch contract so launch domains, scores, and owners are explicit before any pilot decision.",
      verify: "Confirm the launch packet includes a customer launch contract score, ready/needs-work/blocked domain counts, and ordered next actions.",
    };
  }

  const contractAction = params.readiness.customerLaunchContract?.nextActions?.[0];
  if (contractAction) {
    return {
      title: `Complete ${contractAction.label}`,
      owner: contractAction.owner,
      action: contractAction.nextAction,
      verify: `Rerun the launch packet and confirm ${contractAction.label} is ready.`,
    };
  }

  const criterion = params.acceptanceCriteria.find((item) => item.status !== "met");
  if (criterion) {
    return {
      title: `Close ${criterion.label}`,
      owner: criterion.requiredFor === "production" ? "Operations" : "AI Product Owner",
      action: criterion.nextAction,
      verify: `Rerun the launch packet and confirm ${criterion.label} is met.`,
    };
  }

  return {
    title: "Review launch contract gaps",
    owner: "Operations",
    action: "Refresh readiness evidence and reconcile any needs-work launch domains before pilot invitation.",
    verify: "Confirm the launch contract status is ready or has explicit manual actions.",
  };
}

function launchStatusText(params: {
  readiness: ProductionReadiness | null;
  launchStatus: CustomerLaunchPacket["launchStatus"];
}) {
  if (!params.readiness) {
    return "not ready for launch review until tenant readiness evidence is loaded";
  }

  if (!params.readiness.customerLaunchContract) {
    return params.launchStatus === "blocked"
      ? "blocked for customer launch until production controls are completed and the customer launch contract is regenerated"
      : "not ready for customer launch review until the customer launch contract is generated";
  }

  if (params.launchStatus === "ready") return "ready for a controlled customer launch";
  if (params.launchStatus === "blocked") return "blocked for customer launch until production controls are completed";
  return "ready for private evaluation with documented launch work remaining";
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function statusFromBoolean(complete: boolean, partial: boolean): LaunchEvidenceAcceptanceStatus {
  if (complete) return "met";
  if (partial) return "partial";
  return "missing";
}

function workflowSummary(workspace: EnterpriseWorkspace) {
  const nodeCount = workspace.workflow.nodes.length;
  const published = workspace.workflow.status === "Published";
  return {
    nodeCount,
    status: workspace.workflow.status,
    valid: published && nodeCount > 0,
    issues: nodeCount && !published ? 1 : nodeCount ? 0 : 1,
    warnings: nodeCount && !published ? 1 : 0,
  };
}

function workspaceMetrics(workspace: EnterpriseWorkspace, evidencePacket: EvidencePacket) {
  const adoptionRate = pct(workspace.skills.filter((skill) => skill.adoptionCount > 0).length, workspace.skills.length);
  const hoursSaved = Math.round(workspace.skills.reduce((sum, skill) => sum + skill.runs * 0.2, 0));
  return {
    annualValue: evidencePacket.summary.estimatedAnnualValue,
    adoptionRate,
    hoursSaved,
  };
}

function buildPrimetimeGate(params: {
  workspace: EnterpriseWorkspace;
  readiness: ProductionReadiness | null;
  evidencePacket: EvidencePacket;
}) {
  const workflow = workflowSummary(params.workspace);
  const metrics = workspaceMetrics(params.workspace, params.evidencePacket);
  const enterpriseMaturity = deriveEnterpriseMaturity({
    useCases: params.workspace.useCases,
    skills: params.workspace.skills,
    runs: params.workspace.runs,
    toolRequests: params.workspace.toolRequests,
    auditLogs: params.workspace.auditLogs,
    governanceReviews: params.workspace.governanceReviews,
    evalResults: params.workspace.evalResults,
    workSignals: params.workspace.workSignals,
    tools: params.workspace.tools,
    contextSources: params.workspace.contextSources,
    report: params.workspace.report,
    metrics,
    workflow,
    productionReadiness: params.readiness,
  });
  const integrationBlueprint = deriveIntegrationBlueprint({
    tools: params.workspace.tools,
    contextSources: params.workspace.contextSources,
    useCases: params.workspace.useCases,
    skills: params.workspace.skills,
    runs: params.workspace.runs,
    toolRequests: params.workspace.toolRequests,
    productionReadiness: params.readiness,
  });

  return derivePrimetimeLaunchGate({
    useCases: params.workspace.useCases,
    skills: params.workspace.skills,
    runs: params.workspace.runs,
    governanceReviews: params.workspace.governanceReviews,
    evalResults: params.workspace.evalResults,
    report: params.workspace.report,
    productionReadiness: params.readiness,
    enterpriseMaturity,
    integrationBlueprint,
    workflow,
  });
}

function buildControlPlaneSnapshot(controlPlane: EnterpriseAiControlPlaneResponse): LaunchControlPlaneSnapshot {
  return {
    schema: controlPlane.schema,
    posture: controlPlane.controlPlane.posture,
    score: controlPlane.controlPlane.score,
    summary: controlPlane.controlPlane.summary,
    metrics: controlPlane.controlPlane.metrics,
    priorityActions: controlPlane.controlPlane.priorityActions.slice(0, 5),
    readinessInputs: controlPlane.readinessInputs,
    privacyBoundary: controlPlane.privacyBoundary,
  };
}

function buildAcceptanceCriteria(params: {
  workspace: EnterpriseWorkspace;
  readiness: ProductionReadiness | null;
  evidencePacket: EvidencePacket;
  primetimeGate: PrimetimeLaunchGate;
  enterpriseControlPlane: LaunchControlPlaneSnapshot;
}): LaunchEvidenceAcceptanceCriterion[] {
  const launchGradeEvals = params.workspace.evalResults.filter(
    (result) => result.passed && result.score >= 90 && result.criticalFailures === 0,
  );
  const traceableRuns = params.workspace.runs.filter((run) => run.trace.length >= 6);
  const harnessTraceSummary = params.readiness?.harnessTraceSummary;
  const cleanHarnessTraceEvidence =
    (harnessTraceSummary?.completed ?? 0) > 0 &&
    (harnessTraceSummary?.failed ?? 0) === 0 &&
    (harnessTraceSummary?.promptQualityUnsafe ?? 0) === 0;
  const partialHarnessTraceEvidence = (harnessTraceSummary?.total ?? 0) > 0;
  const approvedReviews = params.workspace.governanceReviews.filter((review) =>
    ["approved", "approved_with_conditions"].includes(review.status),
  );
  const launchGatePilotBlockers = params.primetimeGate.blockers.filter((item) => item.requiredFor === "pilot");
  const productionRuntimeReady = params.readiness?.status === "ready";
  const productionRuntimePartial = params.readiness?.status === "degraded";
  const controlPlaneStrong = params.enterpriseControlPlane.score >= 70;
  const controlPlanePartial = params.enterpriseControlPlane.score >= 40;

  return [
    {
      id: "portfolio",
      label: "Scored opportunity portfolio",
      status: statusFromBoolean(params.workspace.useCases.length > 0, false),
      evidence: `${params.workspace.useCases.length} use case(s) captured; ${params.workspace.useCases.filter((item) => item.priorityScore > 0).length} have priority scores.`,
      requiredFor: "pilot",
      nextAction: "Capture and score the first priority use case before treating the OS as active.",
    },
    {
      id: "skill-package",
      label: "Governed Skill package",
      status: statusFromBoolean(
        params.workspace.skills.some((skill) => ["approved", "pilot", "production"].includes(skill.status)),
        params.workspace.skills.length > 0,
      ),
      evidence: `${params.workspace.skills.length} Skill package(s); ${params.workspace.skills.filter((skill) => ["approved", "pilot", "production"].includes(skill.status)).length} governed.`,
      requiredFor: "pilot",
      nextAction: "Convert the top opportunity into a Skill with prompt, model, context, tool policy, owner, and risk tier.",
    },
    {
      id: "evals",
      label: "Launch-grade eval evidence",
      status: statusFromBoolean(launchGradeEvals.length > 0, params.workspace.evalResults.length > 0),
      evidence: `${launchGradeEvals.length} launch-grade eval result(s); ${params.workspace.evalResults.length} total eval result(s).`,
      requiredFor: "pilot",
      nextAction: "Run launch readiness evals and resolve critical failures before governance approval.",
    },
    {
      id: "traces",
      label: "Traceable Harness execution",
      status: statusFromBoolean(
        traceableRuns.length > 0 || cleanHarnessTraceEvidence,
        params.workspace.runs.length > 0 || partialHarnessTraceEvidence,
      ),
      evidence: `${traceableRuns.length} workspace traceable run(s); ${params.workspace.runs.length} workspace run(s); ${harnessTraceSummary?.completed ?? 0}/${harnessTraceSummary?.total ?? 0} durable Harness trace(s) completed.`,
      requiredFor: "pilot",
      nextAction: "Run the selected Skill through the Harness with identity, context, policy, model, tool, validation, and audit trace steps.",
    },
    {
      id: "governance",
      label: "Human governance decision",
      status: statusFromBoolean(approvedReviews.length > 0, params.workspace.governanceReviews.length > 0),
      evidence: `${approvedReviews.length} approved or conditionally approved review(s); ${params.workspace.governanceReviews.length} total review(s).`,
      requiredFor: "pilot",
      nextAction: "Submit the Skill for security, legal, privacy, and business review and resolve open blockers.",
    },
    {
      id: "proof-packet",
      label: "Audit-ready proof packet",
      status: statusFromBoolean(
        params.evidencePacket.summary.totalItems >= 5 && params.evidencePacket.auditIntegrity.verified,
        params.evidencePacket.summary.totalItems > 0,
      ),
      evidence: `${params.evidencePacket.summary.totalItems} evidence item(s); audit chain ${params.evidencePacket.auditIntegrity.verified ? "verified" : "needs attention"}.`,
      requiredFor: "pilot",
      nextAction: "Generate evidence after use case, Skill, eval, trace, governance, connector, audit, and ROI records exist.",
    },
    {
      id: "primetime-gate",
      label: "Primetime launch gate",
      status: statusFromBoolean(launchGatePilotBlockers.length === 0 && params.primetimeGate.status !== "blocked", params.primetimeGate.score >= 50),
      evidence: `${params.primetimeGate.status} at ${params.primetimeGate.score}/100; ${launchGatePilotBlockers.length} pilot blocker(s).`,
      requiredFor: "production",
      nextAction: params.primetimeGate.nextAction.nextAction,
    },
    {
      id: "production-runtime",
      label: "Production runtime controls",
      status: statusFromBoolean(productionRuntimeReady, productionRuntimePartial),
      evidence: `${params.readiness?.status ?? "unknown"} runtime readiness; ${(params.readiness?.manualActions ?? []).length} manual launch action(s).`,
      requiredFor: "production",
      nextAction: "Configure SSO, durable persistence, tenant secret encryption, provider routing, connector broker, workflow engine, observability, backups, and continuous eval cadence.",
    },
    {
      id: "enterprise-control-plane",
      label: "Enterprise AI control plane",
      status: statusFromBoolean(controlPlaneStrong, controlPlanePartial),
      evidence: `${params.enterpriseControlPlane.posture} posture at ${params.enterpriseControlPlane.score}/100; ${params.enterpriseControlPlane.priorityActions.length} priority action(s).`,
      requiredFor: "production",
      nextAction:
        params.enterpriseControlPlane.priorityActions[0]?.nextAction ||
        "Strengthen system of record, permission graph, incident operations, vendor governance, compliance evidence, and value controls.",
    },
  ];
}

function executiveSummary(params: {
  workspace: EnterpriseWorkspace;
  readiness: ProductionReadiness | null;
  evidencePacket: EvidencePacket;
  launchStatus: CustomerLaunchPacket["launchStatus"];
  primetimeGate: PrimetimeLaunchGate;
  enterpriseControlPlane: LaunchControlPlaneSnapshot;
  recommendedNextMove: CustomerLaunchPacket["recommendedNextMove"];
}) {
  const contract = params.readiness?.customerLaunchContract;
  const statusText = launchStatusText({ readiness: params.readiness, launchStatus: params.launchStatus });
  const value = money(params.evidencePacket.summary.estimatedAnnualValue);

  return [
    `${params.workspace.organization.name} is ${statusText}.`,
    `The launch contract score is ${contract?.score ?? 0}/100 with ${contract?.readyCount ?? 0} ready domains, ${contract?.needsWorkCount ?? 0} needs-work domains, and ${contract?.blockedCount ?? 0} blocked domains.`,
    `The primetime launch gate is ${params.primetimeGate.status} at ${params.primetimeGate.score}/100, and the enterprise AI control plane is ${params.enterpriseControlPlane.posture} at ${params.enterpriseControlPlane.score}/100.`,
    `The current evidence packet contains ${params.evidencePacket.summary.totalItems} evidence items across use cases, Skills, traces, evals, governance, connectors, audit logs, and ROI assumptions, with ${value} in estimated annual value.`,
    params.launchStatus === "ready"
      ? `No launch blockers remain; the recommended next move is "${params.recommendedNextMove.title}" owned by ${params.recommendedNextMove.owner}.`
      : `The recommended next move is "${params.recommendedNextMove.title}" owned by ${params.recommendedNextMove.owner}.`,
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
    `- Eval evidence records: ${packet.operatingSnapshot.evalArtifacts}`,
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
    "## Primetime Launch Gate",
    "",
    `- Status: ${packet.primetimeGate.status}`,
    `- Score: ${packet.primetimeGate.score}/100`,
    `- Summary: ${packet.primetimeGate.summary}`,
    `- Next action: ${packet.primetimeGate.nextAction.label} - ${packet.primetimeGate.nextAction.nextAction}`,
    "",
    "| Gate | Required for | Status | Evidence |",
    "| --- | --- | --- | --- |",
    ...packet.primetimeGate.items.map((item) =>
      `| ${item.label} | ${item.requiredFor} | ${item.status} | ${item.evidence.replace(/\|/g, "\\|")} |`,
    ),
    "",
    "## Enterprise AI Control Plane",
    "",
    `- Posture: ${packet.enterpriseControlPlane.posture}`,
    `- Score: ${packet.enterpriseControlPlane.score}/100`,
    `- Summary: ${packet.enterpriseControlPlane.summary}`,
    `- Governed assets: ${packet.enterpriseControlPlane.metrics.governedAssets}`,
    `- Shadow AI candidates: ${packet.enterpriseControlPlane.metrics.shadowCandidates}`,
    `- Permissioned Skills: ${packet.enterpriseControlPlane.metrics.permissionedSkills}`,
    `- Traceable runs: ${packet.enterpriseControlPlane.metrics.traceableRuns}`,
    `- Privacy boundary: ${packet.enterpriseControlPlane.privacyBoundary}`,
    "",
    ...(packet.enterpriseControlPlane.priorityActions.length
      ? [
          "### Control Plane Priority Actions",
          "",
          ...packet.enterpriseControlPlane.priorityActions.flatMap((action, index) => [
            `${index + 1}. ${action.title}`,
            `   Status: ${action.status} (${action.score}/100)`,
            `   Action: ${action.nextAction}`,
            "",
          ]),
        ]
      : []),
    "## Evidence Acceptance Criteria",
    "",
    "| Criterion | Required for | Status | Evidence | Next action |",
    "| --- | --- | --- | --- | --- |",
    ...packet.acceptanceCriteria.map((criterion) =>
      [
        criterion.label,
        criterion.requiredFor,
        criterion.status,
        criterion.evidence,
        criterion.nextAction,
      ].map((cell) => cell.replace(/\|/g, "\\|")).join(" | "),
    ).map((row) => `| ${row} |`),
    "",
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
  controlPlane?: EnterpriseAiControlPlaneResponse;
  configuredSecretNames?: string[];
}): CustomerLaunchPacket {
  const { workspace, readiness, evidencePacket } = params;
  const launchStatus = statusFromReadiness(readiness);
  const launchScore = readiness?.customerLaunchContract?.score ?? 0;
  const primetimeGate = buildPrimetimeGate({ workspace, readiness, evidencePacket });
  const enterpriseControlPlane = buildControlPlaneSnapshot(
    params.controlPlane ??
      buildEnterpriseAiControlPlaneResponse({
        workspace,
        auditLogs: workspace.auditLogs,
        configuredSecretNames: params.configuredSecretNames,
      }),
  );
  const acceptanceCriteria = buildAcceptanceCriteria({
    workspace,
    readiness,
    evidencePacket,
    primetimeGate,
    enterpriseControlPlane,
  });
  const recommendedNextMove = buildRecommendedNextMove({ readiness, launchStatus, acceptanceCriteria });
  const packetWithoutMarkdown = {
    schema: "enterprise-ai-enablement-os.customer-launch-packet.v1" as const,
    organizationId: workspace.organizationId,
    organizationName: workspace.organization.name,
    generatedAt: new Date().toISOString(),
    launchStatus,
    launchScore,
    executiveSummary: executiveSummary({
      workspace,
      readiness,
      evidencePacket,
      launchStatus,
      primetimeGate,
      enterpriseControlPlane,
      recommendedNextMove,
    }),
    recommendedNextMove,
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
    primetimeGate,
    enterpriseControlPlane,
    acceptanceCriteria,
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
