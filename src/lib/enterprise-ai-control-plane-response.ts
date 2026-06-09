import {
  agentPermissionSurfaces,
  compliancePacks,
  controlTowerPillars,
  deriveEnterpriseAiControlPlane,
  financeValueControls,
  incidentResponsePlays,
  shadowAiDiscoveries,
  vendorRiskRecords,
  workflowRedesignPlays,
} from "./enterprise-ai-control-plane.ts";
import type { AuditLog } from "./enterprise-ai-data.ts";
import { getEnterpriseConnectorReadiness } from "./enterprise-connectors.ts";
import { getProviderReadiness } from "./provider-registry.ts";
import type { EnterpriseWorkspace } from "./workspace-schema.ts";

type RuntimeEnv = Record<string, string | undefined>;

export type EnterpriseAiControlPlaneResponse = ReturnType<typeof buildEnterpriseAiControlPlaneResponse>;

function line(value = "") {
  return value;
}

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function markdownCell(value: string | number | boolean) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function statusLabel(value: string) {
  return titleCase(value).replace("Ai", "AI");
}

function scoreLabel(value: number) {
  return `${Math.round(value)}/100`;
}

export function buildEnterpriseAiControlPlaneResponse({
  workspace,
  auditLogs = [],
  configuredSecretNames = [],
  generatedAt = new Date().toISOString(),
  env = process.env,
}: {
  workspace: EnterpriseWorkspace;
  auditLogs?: AuditLog[];
  configuredSecretNames?: string[];
  generatedAt?: string;
  env?: RuntimeEnv;
}) {
  const evidenceLogs = auditLogs.length ? auditLogs : workspace.auditLogs;
  const providers = getProviderReadiness(env, configuredSecretNames);
  const externalProviders = providers.filter((provider) => provider.id !== "local");
  const connectorReadiness = getEnterpriseConnectorReadiness(env, configuredSecretNames);
  const connectorReadyCount = connectorReadiness.connectors.filter((connector) =>
    connector.status === "ready" || connector.status === "broker-managed",
  ).length;
  const controlPlane = deriveEnterpriseAiControlPlane({
    useCases: workspace.useCases,
    skills: workspace.skills,
    runs: workspace.runs,
    governanceReviews: workspace.governanceReviews,
    evalResults: workspace.evalResults,
    auditLogs: evidenceLogs,
    toolRequests: workspace.toolRequests,
    workSignals: workspace.workSignals,
    providerCount: externalProviders.length,
    providerReadyCount: externalProviders.filter((provider) => provider.configured).length,
    connectorCount: connectorReadiness.connectors.length,
    connectorReadyCount,
    metrics: {
      annualValue: workspace.skills.reduce((sum, skill) => sum + skill.valueDelivered, 0),
      adoptionRate: workspace.skills.length
        ? Math.round(
            (workspace.skills.filter((skill) => skill.adoptionCount > 0).length / workspace.skills.length) * 100,
          )
        : 0,
      hoursSaved: workspace.skills.reduce((sum, skill) => sum + skill.runs * 0.2, 0),
    },
  });

  return {
    schema: "enterprise-ai-enablement-os.enterprise-control-plane.v1",
    generatedAt,
    organizationId: workspace.organizationId,
    organization: {
      name: workspace.organization.name,
      workspaceLabel: workspace.organization.workspaceLabel,
      workspaceMode: workspace.workspaceMode,
    },
    privacyBoundary:
      "This control plane is derived from governed workspace records, tenant readiness signals, runtime traces, connector decisions, and redacted work metadata. Raw employee messages are not required.",
    controlPlane,
    catalogs: {
      controlTowerPillars,
      shadowAiDiscoveries,
      agentPermissionSurfaces,
      vendorRiskRecords,
      compliancePacks,
      incidentResponsePlays,
      workflowRedesignPlays,
      financeValueControls,
    },
    readinessInputs: {
      providers: {
        total: externalProviders.length,
        ready: externalProviders.filter((provider) => provider.configured).length,
        items: providers.map((provider) => ({
          id: provider.id,
          label: provider.label,
          configured: provider.configured,
          protocol: provider.protocol,
          missing: provider.missing,
        })),
      },
      connectors: {
        brokerMode: connectorReadiness.brokerMode,
        brokerConfigured: connectorReadiness.brokerConfigured,
        total: connectorReadiness.connectors.length,
        ready: connectorReadyCount,
        productionReady: connectorReadiness.productionReady,
        items: connectorReadiness.connectors.map((connector) => ({
          id: connector.id,
          label: connector.label,
          system: connector.system,
          status: connector.status,
          executionMode: connector.executionMode,
          missingSecrets: connector.missingSecrets,
          configuredSecretCount: connector.configuredSecrets.length,
          requiredScopes: connector.requiredScopes,
        })),
      },
      evidence: {
        auditLogs: evidenceLogs.length,
        runs: workspace.runs.length,
        evalResults: workspace.evalResults.length,
        governanceReviews: workspace.governanceReviews.length,
        toolRequests: workspace.toolRequests.length,
        workSignals: workspace.workSignals.length,
      },
    },
  };
}

export function formatEnterpriseAiControlPlaneMarkdown(payload: EnterpriseAiControlPlaneResponse) {
  const { controlPlane, readinessInputs, catalogs } = payload;
  const capabilities = [...controlPlane.capabilities].sort((a, b) => a.score - b.score);
  const priorityActions = controlPlane.priorityActions.length
    ? controlPlane.priorityActions
    : capabilities.slice(0, 3);
  const providerGaps = readinessInputs.providers.items
    .filter((provider) => !provider.configured && provider.id !== "local")
    .map((provider) => `${provider.label} (${provider.missing.join(", ") || "missing configuration"})`);
  const connectorGaps = readinessInputs.connectors.items
    .filter((connector) => connector.status !== "ready" && connector.status !== "broker-managed")
    .map((connector) => `${connector.label} (${connector.missingSecrets.join(", ") || connector.status})`);

  const lines = [
    `# ${payload.organization.name} Enterprise AI Control Plane`,
    line(),
    `Generated: ${payload.generatedAt}`,
    `Organization ID: ${payload.organizationId}`,
    `Workspace: ${payload.organization.workspaceLabel} (${payload.organization.workspaceMode})`,
    `Posture: ${statusLabel(controlPlane.posture)}`,
    `Control score: ${scoreLabel(controlPlane.score)}`,
    line(),
    "## Executive Summary",
    line(),
    controlPlane.summary,
    line(),
    "## Capability Ledger",
    line(),
    "| Capability | Status | Score | Current value | Next action |",
    "| --- | --- | ---: | --- | --- |",
    ...controlPlane.capabilities.map((capability) =>
      [
        markdownCell(capability.title),
        markdownCell(statusLabel(capability.status)),
        markdownCell(scoreLabel(capability.score)),
        markdownCell(capability.value),
        markdownCell(capability.nextAction),
      ].join(" | "),
    ).map((row) => `| ${row} |`),
    line(),
    "## Priority Actions",
    line(),
    ...priorityActions.flatMap((capability, index) => [
      `${index + 1}. ${capability.title}`,
      `   Status: ${statusLabel(capability.status)} (${scoreLabel(capability.score)})`,
      `   Action: ${capability.nextAction}`,
      `   Evidence: ${capability.helper}`,
      line(),
    ]),
    "## Readiness Inputs",
    line(),
    `- Model providers: ${readinessInputs.providers.ready}/${readinessInputs.providers.total} external providers configured.`,
    `- Connectors: ${readinessInputs.connectors.ready}/${readinessInputs.connectors.total} connector surfaces ready; broker mode ${readinessInputs.connectors.brokerMode}.`,
    `- Evidence records: ${readinessInputs.evidence.auditLogs} audit logs, ${readinessInputs.evidence.runs} runs, ${readinessInputs.evidence.evalResults} eval results, ${readinessInputs.evidence.governanceReviews} governance reviews, ${readinessInputs.evidence.toolRequests} tool requests, ${readinessInputs.evidence.workSignals} work signals.`,
    providerGaps.length ? `- Provider gaps: ${providerGaps.join("; ")}.` : "- Provider gaps: none reported.",
    connectorGaps.length ? `- Connector gaps: ${connectorGaps.join("; ")}.` : "- Connector gaps: none reported.",
    line(),
    "## Governance Catalogs",
    line(),
    `- Compliance packs: ${catalogs.compliancePacks.map((pack) => pack.name).join(", ")}.`,
    `- Incident plays: ${catalogs.incidentResponsePlays.length} playbooks covering ${catalogs.incidentResponsePlays.map((play) => play.trigger).join("; ")}.`,
    `- Permission surfaces: ${catalogs.agentPermissionSurfaces.map((surface) => surface.surface).join(", ")}.`,
    `- Finance controls: ${catalogs.financeValueControls.map((control) => control.control).join(", ")}.`,
    line(),
    "## Operating Metrics",
    line(),
    `- Governed assets: ${controlPlane.metrics.governedAssets}`,
    `- Shadow AI candidates: ${controlPlane.metrics.shadowCandidates}`,
    `- High-risk assets: ${controlPlane.metrics.highRiskAssets}`,
    `- Open reviews: ${controlPlane.metrics.openReviews}`,
    `- Permissioned Skills: ${controlPlane.metrics.permissionedSkills}`,
    `- Traceable runs: ${controlPlane.metrics.traceableRuns}`,
    `- Compliance coverage: ${controlPlane.metrics.complianceCoverage}%`,
    `- Incident readiness: ${controlPlane.metrics.incidentReadiness}%`,
    `- Value confidence: ${controlPlane.metrics.valueConfidence}%`,
    line(),
    "## Privacy Boundary",
    line(),
    payload.privacyBoundary,
    line(),
  ];

  return lines.join("\n");
}
