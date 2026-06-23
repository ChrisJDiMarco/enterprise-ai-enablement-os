import { useEffect, useState } from "react";
import type { BrokerHealth } from "@/lib/connector-broker-health";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  Database,
  KeyRound,
  LockKeyhole,
  Network,
  SearchCheck,
  ShieldCheck,
  TestTube2,
} from "lucide-react";

import { PageHeader } from "@/components/shell";
import { Badge, Button, DataTable, MiniMetric, Panel, SectionTitle } from "@/components/ui";
import type { IntegrationBlueprint, IntegrationZone } from "@/lib/integration-blueprint";
import { openClawIntegration, openClawLaunchReadiness, openClawStatusTone } from "@/lib/openclaw-integration";
import type { ProviderReadiness } from "@/lib/provider-registry";
import {
  buildRuntimeControlIntelligence,
  runtimeAdapterManifests,
  type NormalizedRuntimeAssetRecord,
  type RuntimeAdapterManifestId,
  type RuntimeAdapterRecord,
  type RuntimeControlHealthGrade,
  type RuntimeControlNextAction,
  type RuntimeImportAuditRecord,
  type RuntimeImportJobRecord,
} from "@/lib/runtime-control-plane";
import type { ProductionReadiness, View } from "@/lib/ui/types";

function connectorTone(status: string): "green" | "blue" | "amber" | "red" | "slate" {
  if (status === "ready") return "green";
  if (status === "broker-managed") return "blue";
  if (status === "partial") return "amber";
  if (status === "missing") return "red";
  return "slate";
}

function zoneTone(status: IntegrationZone["status"]): "green" | "amber" | "red" {
  if (status === "ready") return "green";
  if (status === "partial") return "amber";
  return "red";
}

function runtimeGradeTone(grade: RuntimeControlHealthGrade): "green" | "blue" | "amber" | "red" {
  if (grade === "launch_ready") return "green";
  if (grade === "controlled") return "blue";
  if (grade === "forming") return "amber";
  return "red";
}

function runtimeRiskTone(risk: string): "green" | "amber" | "red" | "slate" {
  if (risk === "restricted" || risk === "high") return "red";
  if (risk === "medium") return "amber";
  if (risk === "low") return "green";
  return "slate";
}

const connectorViewLabels: Partial<Record<View, string>> = {
  admin: "Settings",
  broker: "Tool Permissions",
  connectors: "Connect Apps",
  estate: "AI Inventory",
  evidence: "Proof Ledger",
  evals: "Quality Evals",
  governance: "Risk Review",
  launch: "Launch Plan",
  roi: "Value & ROI",
  skills: "AI Skills",
};

const connectorCategoryLabels: Record<string, string> = {
  collaboration: "Collab",
  ticketing: "Ticketing",
  knowledge: "Knowledge",
  hris: "HRIS",
  identity: "Identity",
  crm: "CRM",
  source_control: "Code",
  support: "Support",
  data_warehouse: "Data",
  lakehouse: "Lakehouse",
  erp: "ERP",
  revenue: "Revenue",
  observability: "AI telemetry",
  evals: "Evals",
};

function connectorViewLabel(view: View) {
  return connectorViewLabels[view] ?? view;
}

function connectorCategoryLabel(category: string) {
  return connectorCategoryLabels[category] ?? category.replaceAll("_", " ");
}

export function ConnectorSetup({
  productionReadiness,
  integrationBlueprint,
  providerVault,
  runtimeAdapters,
  runtimeImportJobs,
  normalizedRuntimeAssets,
  runtimeImportAudits,
  onTestRuntimeAdapter,
  onCommitRuntimeImport,
  onSaveConnectorSecrets,
  onOpenView,
  onOpenSettings,
}: {
  productionReadiness: ProductionReadiness | null;
  integrationBlueprint: IntegrationBlueprint;
  providerVault: ProviderReadiness[];
  runtimeAdapters: RuntimeAdapterRecord[];
  runtimeImportJobs: RuntimeImportJobRecord[];
  normalizedRuntimeAssets: NormalizedRuntimeAssetRecord[];
  runtimeImportAudits: RuntimeImportAuditRecord[];
  onTestRuntimeAdapter: (manifestId: RuntimeAdapterManifestId) => void;
  onCommitRuntimeImport: (manifestId: RuntimeAdapterManifestId) => void;
  onSaveConnectorSecrets: (secrets: Record<string, string>) => Promise<void>;
  onOpenView: (view: View) => void;
  onOpenSettings: () => void;
}) {
  const [connectorSecretDraft, setConnectorSecretDraft] = useState<Record<string, string>>({});
  const [savingConnectorSecrets, setSavingConnectorSecrets] = useState(false);
  const [brokerHealth, setBrokerHealth] = useState<BrokerHealth | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/connectors/health")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && payload?.broker) setBrokerHealth(payload.broker as BrokerHealth);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const [selectedRuntimeManifestId, setSelectedRuntimeManifestId] = useState<RuntimeAdapterManifestId>("langfuse");
  const catalog = productionReadiness?.connectors?.catalog;
  const connectors = catalog?.connectors ?? [];
  const readyConnectors = connectors.filter((connector) => connector.status === "ready" || connector.status === "broker-managed");
  const missingSecrets = connectors.reduce((sum, connector) => sum + connector.missingSecrets.length, 0);
  const selectedRuntimeManifest = runtimeAdapterManifests.find((manifest) => manifest.id === selectedRuntimeManifestId) ?? runtimeAdapterManifests[0];
  const selectedRuntimeAdapter = runtimeAdapters.find((adapter) => adapter.manifestId === selectedRuntimeManifest.id);
  const selectedRuntimeJob = runtimeImportJobs.find((job) => job.manifestId === selectedRuntimeManifest.id);
  const selectedRuntimeAssets = normalizedRuntimeAssets.filter((asset) => asset.manifestId === selectedRuntimeManifest.id);
  const activeRuntimeAdapters = runtimeAdapters.filter((adapter) => adapter.status === "active").length;
  const runtimeEvidenceGaps = normalizedRuntimeAssets.reduce((sum, asset) => sum + asset.evidenceGaps.length + asset.missingMappings.length, 0);
  const runtimeProofCount =
    normalizedRuntimeAssets.reduce((sum, asset) => sum + asset.proofIds.length, 0) +
    runtimeImportAudits.filter((audit) => audit.action === "runtime_import_committed" || audit.action === "adapter_tested").length;
  const runtimeIntelligence = buildRuntimeControlIntelligence({
    adapters: runtimeAdapters,
    importJobs: runtimeImportJobs,
    runtimeAssets: normalizedRuntimeAssets,
    importAudits: runtimeImportAudits,
  });
  const connectorCoverage = Object.values(
    connectors.reduce<Record<string, { category: string; total: number; ready: number; partial: number; missingSecrets: number }>>(
      (accumulator, connector) => {
        const current =
          accumulator[connector.category] ??
          (accumulator[connector.category] = { category: connector.category, total: 0, ready: 0, partial: 0, missingSecrets: 0 });
        current.total += 1;
        current.missingSecrets += connector.missingSecrets.length;
        if (connector.status === "ready" || connector.status === "broker-managed") current.ready += 1;
        if (connector.status === "partial") current.partial += 1;
        return accumulator;
      },
      {},
    ),
  ).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  const configuredProviders = providerVault.filter((provider) => provider.id !== "local" && provider.configured);
  const primaryModelReady = configuredProviders.length > 0;
  const setupSteps = [
    {
      label: "Identity",
      body: "Connect SSO groups, user departments, and approver roles so every AI action is bound to the requesting human.",
      view: "admin" as View,
      ready: Boolean(productionReadiness?.auth?.oidcConfigured),
    },
    {
      label: "Models",
      body: "Store one approved model provider first, then add specialist providers for classification, governance, workflows, and evals.",
      view: "admin" as View,
      ready: primaryModelReady,
    },
    {
      label: "Knowledge",
      body: "Connect SharePoint, Google Drive, Confluence, contract repositories, and approved data catalogs with source owners.",
      view: "context" as View,
      ready: integrationBlueprint.zones.find((zone) => zone.id === "knowledge")?.status === "ready",
    },
    {
      label: "Work systems",
      body: "Connect Slack/Teams, Jira/ServiceNow, Workday, finance, procurement, and CRM tools behind Broker policy.",
      view: "broker" as View,
      ready: readyConnectors.length > 0,
    },
    {
      label: "Evidence",
      body: "Send connector events, policy decisions, evals, and approvals into the Evidence Ledger for audits and board proof.",
      view: "evidence" as View,
      ready: integrationBlueprint.zones.find((zone) => zone.id === "observability")?.status === "ready",
    },
  ];
  const setupComplete = setupSteps.filter((step) => step.ready).length;
  const nextConnector =
    connectors.find((connector) => connector.status === "partial") ??
    connectors.find((connector) => connector.status === "missing") ??
    connectors.find((connector) => !["ready", "broker-managed"].includes(connector.status)) ??
    connectors[0];
  const nextConnectorChecklist = nextConnector?.activationChecklist ?? [];
  const nextPendingConnectorStep = nextConnectorChecklist.find((item) => item.status === "pending");
  const nextConnectorCompletedControls = nextConnectorChecklist.filter((item) => item.status === "complete").length;
  const nextConnectorSecretRows = nextConnector
    ? [
        ...nextConnector.requiredSecretNames.map((name) => ({
          name,
          required: true,
          ready: nextConnector.configuredSecrets.includes(name),
        })),
        ...(nextConnector.optionalSecretNames ?? [])
          .filter((name) => !nextConnector.requiredSecretNames.includes(name))
          .map((name) => ({
            name,
            required: false,
            ready: nextConnector.configuredSecrets.includes(name),
          })),
      ]
    : [];
  const brokerTokenAccepted = Boolean(catalog?.brokerAuthenticated);
  const brokerRuntimeSecretRows = [
    {
      name: "MCP_BROKER_URL",
      label: "MCP broker URL",
      type: "url",
      ready: catalog?.brokerMode === "mcp-broker" && Boolean(catalog?.brokerUrlConfigured),
      badge: catalog?.brokerMode === "mcp-broker" && catalog.brokerUrlConfigured ? "active route" : "route option",
      helper: "Use this for an MCP-compatible connector broker endpoint.",
    },
    {
      name: "MCP_BROKER_TOKEN",
      label: "MCP broker token",
      type: "password",
      ready: catalog?.brokerMode === "mcp-broker" && brokerTokenAccepted,
      badge: catalog?.brokerMode === "mcp-broker" && brokerTokenAccepted ? "token accepted" : "alternative token",
      helper: "Bearer token used when calling the MCP broker execution endpoint.",
    },
    {
      name: "CONNECTOR_BROKER_URL",
      label: "Custom broker URL",
      type: "url",
      ready: catalog?.brokerMode === "connector-broker" && Boolean(catalog?.brokerUrlConfigured),
      badge: catalog?.brokerMode === "connector-broker" && catalog.brokerUrlConfigured ? "active route" : "route option",
      helper: "Use this for a custom connector broker that exposes the OS execution contract.",
    },
    {
      name: "CONNECTOR_BROKER_TOKEN",
      label: "Custom broker token",
      type: "password",
      ready: brokerTokenAccepted && catalog?.brokerMode !== "policy-only",
      badge: brokerTokenAccepted && catalog?.brokerMode !== "policy-only" ? "token accepted" : "alternative token",
      helper: "Accepted as the custom broker token, and as the fallback token for MCP broker mode.",
    },
  ] as const;
  const tenantVaultSecretNames = new Set([
    ...nextConnectorSecretRows.map((secret) => secret.name),
    ...brokerRuntimeSecretRows.map((secret) => secret.name),
  ]);
  const connectorSecretPayload = Object.fromEntries(
    Object.entries(connectorSecretDraft)
      .map(([name, value]) => [name, value.trim()] as const)
      .filter(([name, value]) => tenantVaultSecretNames.has(name) && value.length > 0),
  );
  const connectorSecretDraftCount = Object.keys(connectorSecretPayload).length;
  const connectorSecretSaveDisabledReason = savingConnectorSecrets
    ? "Connector secrets are already being saved."
    : !connectorSecretDraftCount
      ? "Enter at least one broker or connector secret value before saving to the tenant vault."
      : "";
  const brokerMissingSecretLabel = (catalog?.brokerMissingSecretNames?.length
    ? catalog.brokerMissingSecretNames
    : ["MCP_BROKER_TOKEN", "CONNECTOR_BROKER_TOKEN"]).join(" or ");
  const implementationSteps = nextConnector
    ? [
        {
          label: "Create integration app",
          owner: "Customer Admin",
          body: nextConnector.setupAction,
          icon: BookOpen,
        },
        {
          label: "Store tenant secrets",
          owner: "Security",
          body: nextConnector.missingSecrets.length
            ? `Add ${nextConnector.missingSecrets.join(", ")} to the tenant vault or route this connector through the broker.`
            : "Required native secrets are present. Rotate in the tenant vault when needed.",
          icon: LockKeyhole,
        },
        {
          label: "Run permission tests",
          owner: "Integrations",
          body: "Run one safe read test, one approval-gated write/send test, and preserve response metadata for evidence.",
          icon: TestTube2,
        },
      ]
    : [];
  const connectorStackPlan = [
    {
      label: "Identity",
      proof: productionReadiness?.auth?.oidcConfigured ? "SSO configured" : "SSO groups and approver roles needed",
      ready: Boolean(productionReadiness?.auth?.oidcConfigured),
      view: "admin" as View,
    },
    {
      label: "Model lane",
      proof: primaryModelReady ? "Approved model provider ready" : "Add an approved model provider",
      ready: primaryModelReady,
      view: "admin" as View,
    },
    {
      label: "First connector",
      proof: nextConnector
        ? `${nextConnector.label} · ${nextConnector.activationState?.replace("-", " ") ?? nextConnector.status}`
        : "No connector catalog loaded",
      ready: Boolean(nextConnector && ["ready", "broker-managed"].includes(nextConnector.status)),
      view: "connectors" as View,
    },
    {
      label: "Broker policy",
      proof: catalog?.brokerConfigured
        ? catalog.brokerMode
        : catalog?.brokerUrlConfigured
          ? `Broker auth pending: ${(catalog.brokerMissingSecretNames ?? ["broker token"]).join(" or ")}`
          : "Policy-only until broker URL is configured",
      ready: Boolean(catalog?.brokerConfigured),
      view: "broker" as View,
    },
    {
      label: "Evidence chain",
      proof: integrationBlueprint.zones.find((zone) => zone.id === "observability")?.evidence ?? "Trace, approval, eval, and connector events",
      ready: integrationBlueprint.zones.find((zone) => zone.id === "observability")?.status === "ready",
      view: "evidence" as View,
    },
  ];

  function openConnectorVaultForm() {
    document.getElementById("connector-vault-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveConnectorSecretDraft() {
    if (!connectorSecretDraftCount || savingConnectorSecrets) return;
    setSavingConnectorSecrets(true);
    try {
      await onSaveConnectorSecrets(connectorSecretPayload);
      setConnectorSecretDraft((current) => {
        const next = { ...current };
        Object.keys(connectorSecretPayload).forEach((name) => {
          delete next[name];
        });
        return next;
      });
    } catch {
      // Toasts are emitted by the page save handler; keep draft values available for retry.
    } finally {
      setSavingConnectorSecrets(false);
    }
  }

  function runRuntimeNextAction(action: RuntimeControlNextAction) {
    if (action.command === "test_adapter" && action.manifestId) {
      setSelectedRuntimeManifestId(action.manifestId);
      onTestRuntimeAdapter(action.manifestId);
      return;
    }

    if (action.command === "commit_import" && action.manifestId) {
      setSelectedRuntimeManifestId(action.manifestId);
      onCommitRuntimeImport(action.manifestId);
      return;
    }

    if (action.command === "attach_eval") {
      onOpenView("evals");
      return;
    }

    if (action.command === "attach_proof") {
      onOpenView("evidence");
      return;
    }

    onOpenView("estate");
  }

  return (
    <div>
      <PageHeader
        title="Connect Apps"
        subtitle="Connect identity, models, knowledge, work systems, automations, and evidence to the governed OS."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onOpenSettings}>
              <KeyRound size={16} />
              Company Setup
            </Button>
            <Button onClick={() => onOpenView("broker")}>
              <ShieldCheck size={16} />
              Broker Policies
            </Button>
          </div>
        }
      />

      <Panel className="mt-4 overflow-hidden" data-testid="openclaw-gateway-setup">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">Agent gateway adapter</Badge>
              <Badge tone="blue">Reference profile</Badge>
              <Badge tone={openClawStatusTone(openClawIntegration.gateway.status)}>
                {openClawIntegration.gateway.status.replace("_", " ")}
              </Badge>
              <Badge tone="slate">v{openClawIntegration.gateway.version}</Badge>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                Last seen {openClawIntegration.gateway.lastSeen}
              </span>
            </div>
            <h2 className="mt-3 max-w-3xl text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
              Connect a governed agent gateway
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              This adapter profile uses OpenClaw, but Enablement OS reconciles any connected runtime through the same
              inventory, policy, risk, launch, evidence, and value loop.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {openClawIntegration.setupWizard.map((step, index) => {
                const destinationLabel = connectorViewLabel(step.targetView);
                return (
                  <button
                    key={step.label}
                    type="button"
                    aria-label={`${step.label}: open ${destinationLabel}`}
                    onClick={() => onOpenView(step.targetView)}
                    className={`group flex min-h-[116px] flex-col rounded-lg border p-3 text-left transition ${
                      step.status === "done"
                        ? "border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] hover:border-[color-mix(in_srgb,var(--success)_40%,var(--border))]"
                        : step.status === "next"
                          ? "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] hover:border-[color-mix(in_srgb,var(--warning)_42%,var(--border))]"
                          : "border-[var(--border)] bg-[var(--surface)]/72 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          step.status === "done"
                            ? "bg-[var(--success)] text-white"
                            : step.status === "next"
                              ? "bg-[var(--warning-soft)] text-[var(--warning)] ring-1 ring-[color-mix(in_srgb,var(--warning)_28%,var(--border))]"
                              : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                        }`}
                      >
                        {step.status === "done" ? <Check size={14} /> : index + 1}
                      </span>
                      <Badge tone={openClawStatusTone(step.status)}>{step.status}</Badge>
                    </span>
                    <span className="mt-3 text-sm font-semibold text-[var(--text)]">{step.label}</span>
                    <span className="mt-2 line-clamp-2 block flex-1 text-xs leading-5 text-[var(--text-muted)]">{step.body}</span>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                      Open {destinationLabel}
                      <ArrowRight size={13} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/72 p-4 lg:border-l lg:border-t-0">
            <SectionTitle title="Gateway import" helper="What Enablement OS will continuously reconcile" compact />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Channels" value={String(openClawIntegration.gateway.channelCount)} />
              <MiniMetric label="Agents" value={String(openClawIntegration.agents.length)} />
              <MiniMetric label="Skills" value={String(openClawIntegration.skills.length)} />
              <MiniMetric label="Proof" value={openClawIntegration.gateway.evidenceEvents.toLocaleString()} />
            </div>
            <div className="mt-4 space-y-2">
              {[
                ["Endpoint", openClawIntegration.gateway.url],
                ["Auth mode", openClawIntegration.gateway.authMode.replace("-", " ")],
                ["Sandbox", openClawIntegration.gateway.sandboxMode.replace("-", " ")],
                ["Launch readiness", `${openClawLaunchReadiness}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/76 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</div>
                  <div className="mt-1 truncate text-sm font-semibold text-[var(--text)]">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => onOpenView("broker")}>
                <ShieldCheck size={15} />
                Compile policy
              </Button>
              <Button onClick={() => onOpenView("evidence")}>
                <Database size={15} />
                View proof
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="mt-4 overflow-hidden" data-testid="runtime-adapter-connect-flow">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={activeRuntimeAdapters ? "green" : "amber"}>{activeRuntimeAdapters} active runtime{activeRuntimeAdapters === 1 ? "" : "s"}</Badge>
              <Badge tone="purple">normalized OS schema</Badge>
              <Badge tone={runtimeEvidenceGaps ? "amber" : normalizedRuntimeAssets.length ? "green" : "slate"}>
                {runtimeEvidenceGaps} mapping gap{runtimeEvidenceGaps === 1 ? "" : "s"}
              </Badge>
            </div>
            <h2 className="mt-3 max-w-3xl text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
              Connect runtime telemetry
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Choose the runtime or observability system the company already uses. Enablement OS maps traces, evals,
              tool calls, prompts, costs, owners, and proof IDs into one auditable schema.
            </p>

            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
              <div className="grid gap-px bg-[var(--border)]/70 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="bg-[var(--surface)] p-3 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={runtimeGradeTone(runtimeIntelligence.grade)}>{runtimeIntelligence.score}/100 runtime control</Badge>
                    <Badge tone="blue">{runtimeIntelligence.metrics.testedAdapters}/{runtimeIntelligence.metrics.manifests} tested</Badge>
                    <Badge tone={runtimeIntelligence.metrics.proofCoverage >= 80 ? "green" : "amber"}>
                      {runtimeIntelligence.metrics.proofCoverage}% proof linked
                    </Badge>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{runtimeIntelligence.summary}</p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Owners", `${runtimeIntelligence.metrics.ownerCoverage}%`, runtimeIntelligence.metrics.ownerCoverage >= 80 ? "green" : "amber"],
                      ["Evals", `${runtimeIntelligence.metrics.evalCoverage}%`, runtimeIntelligence.metrics.evalCoverage >= 60 ? "green" : "amber"],
                      ["Mappings", `${runtimeIntelligence.metrics.mappingCoverage}%`, runtimeIntelligence.metrics.mappingCoverage >= 80 ? "green" : "amber"],
                      ["Monthly cost", `$${runtimeIntelligence.metrics.monthlyCostUsd.toLocaleString()}`, runtimeIntelligence.metrics.monthlyCostUsd ? "blue" : "slate"],
                    ].map(([label, value, tone]) => (
                      <div key={label} className="rounded-lg bg-[var(--surface-muted)] p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="text-lg font-semibold tabular-nums text-[var(--text)]">{value}</div>
                          <Badge tone={tone as "green" | "amber" | "blue" | "slate"}>{tone === "green" ? "ready" : tone === "blue" ? "visible" : tone === "amber" ? "gap" : "none"}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[var(--surface-muted)]/80 p-3 sm:p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Next runtime actions</div>
                  <div className="mt-3 space-y-2">
                    {runtimeIntelligence.nextActions.slice(0, 4).map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => runRuntimeNextAction(action)}
                        className="flex w-full items-start justify-between gap-3 rounded-lg bg-[var(--surface)] px-3 py-2 text-left ring-1 ring-[var(--border)]/70 transition hover:bg-[var(--primary-soft)] hover:ring-[var(--primary)]/25"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[var(--text)]">{action.label}</span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{action.detail}</span>
                        </span>
                        <ArrowRight size={14} className="mt-1 shrink-0 text-[var(--text-soft)]" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {runtimeIntelligence.gaps.length ? (
                <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {runtimeIntelligence.gaps.slice(0, 4).map((gap) => (
                      <Badge key={gap.id} tone={runtimeRiskTone(gap.severity)}>
                        {gap.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3 2xl:grid-cols-4">
              {runtimeAdapterManifests.map((manifest) => {
                const adapter = runtimeAdapters.find((item) => item.manifestId === manifest.id);
                const selected = manifest.id === selectedRuntimeManifest.id;
                const status = adapter?.status ?? "available";
                const tone = status === "active" ? "green" : status === "tested" || status === "configured" ? "blue" : "slate";

                return (
                  <button
                    key={manifest.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedRuntimeManifestId(manifest.id)}
                    className={`rounded-lg border p-3 text-left transition ${
                      selected
                        ? "border-[var(--primary)] bg-[var(--primary-soft)]/58 shadow-[var(--shadow-button)]"
                        : "border-[var(--border)] bg-[var(--surface)]/74 hover:border-[var(--primary)]/35 hover:bg-[var(--surface)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text)]">{manifest.name}</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">{manifest.category}</div>
                      </div>
                      <Badge tone={tone}>{status}</Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{manifest.purpose}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-2 lg:grid-cols-3">
              {selectedRuntimeManifest.setupSteps.map((step, index) => {
                const complete =
                  index <= 1
                    ? Boolean(selectedRuntimeAdapter)
                    : index === 2
                      ? selectedRuntimeAdapter?.status === "tested" || selectedRuntimeAdapter?.status === "active"
                      : index >= 3
                        ? selectedRuntimeJob?.status === "committed"
                        : false;

                return (
                  <div key={step} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          complete ? "bg-[var(--success)] text-white" : "bg-[var(--surface)] text-[var(--text-soft)] ring-1 ring-[var(--border)]"
                        }`}
                      >
                        {complete ? <Check size={13} /> : index + 1}
                      </span>
                      <span className="text-sm font-semibold text-[var(--text)]">{step}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/64 p-4 lg:max-h-[920px] lg:overflow-y-auto lg:border-l lg:border-t-0 sm:p-5">
            <SectionTitle title={`${selectedRuntimeManifest.name} contract`} helper={selectedRuntimeManifest.vendor} compact />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Imported assets" value={String(selectedRuntimeAssets.length)} />
              <MiniMetric label="Proof refs" value={String(runtimeProofCount)} />
              <MiniMetric label="Discovered" value={String(selectedRuntimeJob?.discovered.assets ?? 0)} />
              <MiniMetric label="Coverage" value={`${selectedRuntimeAdapter?.coverage ?? 0}%`} />
            </div>

            <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/78 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Required fields</div>
              <div className="mt-3 space-y-2">
                {selectedRuntimeManifest.requiredFields.map((field) => (
                  <div key={field.name} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-[var(--text)]">{field.label}</div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-muted)]">{field.name}</div>
                      </div>
                      <Badge tone={field.secret ? "amber" : "blue"}>{field.secret ? "secret" : "field"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/78 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Normalized mappings</div>
              <div className="mt-3 space-y-2">
                {selectedRuntimeManifest.normalizedMappings.slice(0, 4).map((mapping) => (
                  <div key={`${mapping.source}-${mapping.osField}`} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                    <div className="text-xs font-semibold text-[var(--text)]">{mapping.source} {"->"} {mapping.osField}</div>
                    <div className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">{mapping.proofUse}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:flex-col 2xl:flex-row">
              <Button variant="secondary" onClick={() => onTestRuntimeAdapter(selectedRuntimeManifest.id)}>
                <TestTube2 size={15} />
                Test connection
              </Button>
              <Button onClick={() => onCommitRuntimeImport(selectedRuntimeManifest.id)}>
                <Database size={15} />
                Preview and commit import
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="mt-4 overflow-hidden" data-testid="connector-primary-activation">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="p-4 sm:p-5">
            {nextConnector ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={connectorTone(nextConnector.status)}>{nextConnector.status.replace("-", " ")}</Badge>
                  <Badge tone={nextConnector.missingSecrets.length ? "amber" : "green"}>
                    {nextConnector.missingSecrets.length ? `${nextConnector.missingSecrets.length} secrets needed` : "secrets ready"}
                  </Badge>
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
                  Connect {nextConnector.label}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{nextConnector.productionUse}</p>

                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/80 p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                      <ClipboardCheck size={17} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {nextPendingConnectorStep?.label ?? "Connector activation complete"}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                        {nextPendingConnectorStep?.action ?? "Keep connector scopes, policy decisions, and ledger evidence under review."}
                      </p>
                      {nextPendingConnectorStep ? (
                        <div className="mt-2 text-xs font-semibold text-[var(--text-muted)]">Owner: {nextPendingConnectorStep.owner}</div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={nextConnector.missingSecrets.length ? openConnectorVaultForm : () => onOpenView("broker")} data-testid="connector-primary-next-action">
                    <KeyRound size={15} />
                    {nextConnector.missingSecrets.length ? "Add secrets" : "Test policy"}
                  </Button>
                  <Button variant="secondary" onClick={() => onOpenView("broker")}>
                    Broker Policies
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-lg bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-muted)]">
                No connector catalog is loaded yet. Run production readiness or connect a Broker catalog to generate the activation path.
              </div>
            )}
          </div>

          <div className="hidden border-t border-[var(--border)] bg-[var(--surface-muted)]/60 p-4 md:block lg:border-l lg:border-t-0">
            <SectionTitle title="Activation checklist" helper="Only the next connector controls are shown here by default." compact />
            <div className="mt-4 space-y-2">
              {nextConnectorChecklist.map((item) => (
                <div key={item.id} className="flex items-start gap-2 rounded-lg bg-[var(--surface)] px-3 py-2 ring-1 ring-[var(--border)]/70">
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                      item.status === "complete" ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-muted)] text-[var(--text-soft)] ring-1 ring-[var(--border)]"
                    }`}
                  >
                    {item.status === "complete" ? <Check size={12} /> : null}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--text)]">{item.label}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-[var(--text-muted)]">{item.owner}</div>
                  </div>
                </div>
              ))}
              {!nextConnectorChecklist.length ? (
                <div className="rounded-lg bg-[var(--surface)] px-3 py-3 text-sm text-[var(--text-muted)] ring-1 ring-[var(--border)]/70">
                  No checklist controls are available for this connector.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>

      {nextConnector ? (
        <Panel className="mt-4 overflow-hidden" data-testid="connector-implementation-playbook">
          <details className="group bg-[var(--surface)] md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--text)]">Implementation playbook</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
                  {nextConnector.label}: secrets, scopes, tests, and evidence.
                </span>
              </span>
              <Badge tone={connectorTone(nextConnector.status)}>
                {nextConnectorCompletedControls}/{Math.max(nextConnectorChecklist.length, 1)}
              </Badge>
            </summary>
            <div className="space-y-4 border-t border-[var(--border)] p-4">
              <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--text-muted)]">
                {nextConnector.setupAction}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Tenant vault names</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {nextConnectorSecretRows.map((secret) => (
                    <Badge key={secret.name} tone={secret.ready ? "green" : secret.required ? "amber" : "slate"}>
                      {secret.name}{secret.required ? "" : " optional"}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Scopes</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {nextConnector.requiredScopes.map((scope) => (
                    <Badge key={scope} tone="blue">{scope}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </details>
          <div className="hidden gap-px bg-[var(--border)]/70 md:grid lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="bg-[var(--surface)] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <SectionTitle
                  title="Implementation playbook"
                  helper={`Admin-ready setup for ${nextConnector.label}: app registration, secrets, scopes, tests, and evidence.`}
                  compact
                />
                <Badge tone={connectorTone(nextConnector.status)}>
                  {nextConnectorCompletedControls}/{Math.max(nextConnectorChecklist.length, 1)} controls
                </Badge>
              </div>
              <div className="mt-4 grid gap-2 xl:grid-cols-3">
                {implementationSteps.map((step) => {
                  const StepIcon = step.icon;

                  return (
                    <div key={step.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 p-3">
                      <div className="flex items-start gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)] ring-1 ring-[var(--border)]">
                          <StepIcon size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--text)]">{step.label}</div>
                          <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{step.owner}</div>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{step.body}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="flex items-start gap-3">
                  <SearchCheck className="mt-0.5 shrink-0 text-[var(--success)]" size={17} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">Evidence tests before production</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {["Read path", "Action gate", "Ledger event"].map((label, index) => {
                        const control = nextConnectorChecklist[index + 2];
                        const complete = control?.status === "complete";

                        return (
                          <div key={label} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-[var(--text)]">{label}</span>
                              <Badge tone={complete ? "green" : "amber"}>{complete ? "done" : "needed"}</Badge>
                            </div>
                            <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--text-muted)]">
                              {control?.action ?? "Capture proof in Evidence Ledger."}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[var(--surface-muted)]/80 p-4 lg:max-h-[780px] lg:overflow-y-auto sm:p-5">
              <div id="connector-vault-form" className="scroll-mt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <SectionTitle
                    title="Tenant vault"
                    helper="Store native connector secrets without exposing saved values back to the browser."
                    compact
                  />
                  <Button
                    className="shrink-0"
                    disabled={Boolean(connectorSecretSaveDisabledReason)}
                    aria-describedby={connectorSecretSaveDisabledReason ? "connector-secret-save-disabled-reason" : undefined}
                    title={connectorSecretSaveDisabledReason || undefined}
                    onClick={() => void saveConnectorSecretDraft()}
                    data-testid="connector-setup-save-secrets"
                  >
                    <KeyRound size={15} />
                    {savingConnectorSecrets
                      ? "Saving"
                      : connectorSecretDraftCount
                        ? `Save ${connectorSecretDraftCount}`
                        : "Save secrets"}
                  </Button>
                </div>
                <span id="connector-secret-save-disabled-reason" className="sr-only">
                  {connectorSecretSaveDisabledReason}
                </span>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text)]">External broker route</div>
                        <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]" data-guided-copy="true">
                          Store the broker URL and matching bearer token here when a company wants all connector execution routed through MCP or a custom broker.
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge tone={catalog?.brokerConfigured ? "green" : catalog?.brokerUrlConfigured ? "amber" : "slate"}>
                          {catalog?.brokerConfigured
                            ? "broker configured"
                            : catalog?.brokerUrlConfigured
                              ? "auth pending"
                              : "policy-only"}
                        </Badge>
                        {brokerHealth && brokerHealth.urlConfigured ? (
                          <Badge tone={brokerHealth.reachable ? "green" : "red"}>
                            {brokerHealth.reachable
                              ? `reachable${brokerHealth.status ? ` (HTTP ${brokerHealth.status})` : ""}`
                              : "unreachable"}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    {brokerHealth && brokerHealth.urlConfigured && !brokerHealth.reachable ? (
                      <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                        {brokerHealth.detail}
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-3 xl:grid-cols-2">
                      {brokerRuntimeSecretRows.map((secret) => (
                        <label key={secret.name} className="block">
                          <span className="flex items-center justify-between gap-3">
                            <span className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{secret.label}</span>
                            <Badge tone={secret.ready ? "green" : "slate"}>{secret.badge}</Badge>
                          </span>
                          <input
                            className="input mt-2 font-mono text-xs"
                            type={secret.type}
                            placeholder={secret.ready ? "Saved in tenant vault or server env" : secret.name}
                            value={connectorSecretDraft[secret.name] ?? ""}
                            onChange={(event) =>
                              setConnectorSecretDraft((current) => ({
                                ...current,
                                [secret.name]: event.target.value,
                              }))
                            }
                          />
                          <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]" data-guided-copy="true">
                            {secret.helper}
                          </span>
                        </label>
                      ))}
                    </div>
                    {catalog?.brokerUrlConfigured && !catalog.brokerAuthenticated ? (
                      <div className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] px-3 py-2 text-xs font-medium leading-5 text-[var(--warning)]">
                        Broker URL is configured. Save {brokerMissingSecretLabel} to enable real broker execution.
                      </div>
                    ) : null}
                  </div>

                  {nextConnectorSecretRows.map((secret) => (
                    <label key={secret.name} className="block">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{secret.name}</span>
                        <Badge tone={secret.ready ? "green" : secret.required ? "amber" : "slate"}>
                          {secret.ready ? "saved" : secret.required ? "required" : "optional"}
                        </Badge>
                      </span>
                      <input
                        className="input mt-2 font-mono text-xs"
                        type="password"
                        placeholder={secret.ready ? "Saved in tenant vault" : secret.required ? "Required for launch" : "Optional"}
                        value={connectorSecretDraft[secret.name] ?? ""}
                        onChange={(event) =>
                          setConnectorSecretDraft((current) => ({
                            ...current,
                            [secret.name]: event.target.value,
                          }))
                        }
                      />
                      <span
                        className={`mt-1 block text-xs leading-5 ${
                          secret.ready ? "text-[var(--success)]" : secret.required ? "text-[var(--warning)]" : "text-[var(--text-muted)]"
                        }`}
                        data-guided-copy="true"
                      >
                        {secret.ready
                          ? "Configured. Paste a new value only when rotating."
                          : secret.required
                            ? "Required before this connector can run governed work."
                            : "Optional; add when the workflow needs it."}
                      </span>
                    </label>
                  ))}
                  {!nextConnectorSecretRows.length ? (
                    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-3 text-sm leading-6 text-[var(--text-muted)]">
                      This connector does not require tenant-managed secrets. Finish scopes, policy tests, and evidence capture.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <SectionTitle title="Scopes and capabilities" helper="The exact implementation inputs this connector needs." compact />
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Required scopes</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {nextConnector.requiredScopes.map((scope) => (
                      <Badge key={scope} tone="blue">{scope}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Enabled capabilities</div>
                  <div className="mt-2 space-y-1.5">
                    {nextConnector.capabilities.map((capability) => (
                      <div key={capability} className="flex items-center gap-2 text-xs leading-5 text-[var(--text-muted)]">
                        <Check size={13} className="shrink-0 text-[var(--success)]" />
                        {capability}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      <details
        className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
        data-testid="connector-setup-order"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-[var(--text)]">Recommended setup order and readiness</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {setupComplete}/{setupSteps.length} zones ready. Open for identity, model, knowledge, work-system, and evidence setup proof.
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)]" />
        </summary>
        <div className="border-t border-[var(--border)] p-5">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              {
                label: "Ready connectors",
                value: `${readyConnectors.length}/${Math.max(connectors.length, 1)}`,
                helper: catalog?.brokerUrlConfigured && !catalog?.brokerConfigured
                  ? "broker auth pending"
                  : catalog?.brokerMode ?? "policy-only",
                tone: readyConnectors.length ? "green" : "amber",
                onClick: () => onOpenView("broker"),
              },
              {
                label: "Missing secrets",
                value: String(missingSecrets),
                helper: missingSecrets ? "add tenant vault keys" : "vault ready",
                tone: missingSecrets ? "amber" : "green",
                onClick: onOpenSettings,
              },
              {
                label: "Model default",
                value: primaryModelReady ? "Ready" : "Not set",
                helper: primaryModelReady ? `${configuredProviders.length} provider${configuredProviders.length === 1 ? "" : "s"}` : "add approved provider",
                tone: primaryModelReady ? "green" : "red",
                onClick: onOpenSettings,
              },
              {
                label: "Integration score",
                value: `${integrationBlueprint.score}/100`,
                helper: integrationBlueprint.status,
                tone: integrationBlueprint.status === "ready" ? "green" : integrationBlueprint.status === "partial" ? "amber" : "red",
                onClick: () => onOpenView("evidence"),
              },
            ].map((item) => {
              const statusLabel = item.tone === "green" ? "ready" : item.tone === "amber" ? "needs review" : "blocked";

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/35"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{item.label}</div>
                      <div className="mt-2 text-lg font-semibold tabular-nums text-[var(--text)]">{item.value}</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</div>
                    </div>
                    <Badge tone={item.tone as "green" | "amber" | "red"}>{statusLabel}</Badge>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {setupSteps.map((step, index) => (
              <button
                key={step.label}
                type="button"
                onClick={() => onOpenView(step.view)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/35"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      step.ready ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_28%,var(--border))]" : "bg-[var(--surface-muted)] text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                    }`}
                  >
                    {step.ready ? <Check size={13} /> : index + 1}
                  </span>
                  <span className="text-sm font-semibold text-[var(--text)]">{step.label}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{step.body}</p>
              </button>
            ))}
          </div>
        </div>
      </details>

      <details
        className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
        data-testid="connector-catalog-proof"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-[var(--text)]">Connector catalog and missing secrets</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {readyConnectors.length}/{Math.max(connectors.length, 1)} ready, {missingSecrets} missing secret value{missingSecrets === 1 ? "" : "s"}.
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)]" />
        </summary>
        <div className="border-t border-[var(--border)] p-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {connectorCoverage.map((family) => {
              const tone = family.ready ? "green" : family.partial ? "amber" : "red";
              const statusLabel = family.ready === family.total ? "ready" : family.ready || family.partial ? "partial" : "needs setup";

              return (
                <button
                  key={family.category}
                  type="button"
                  onClick={() => onOpenView("broker")}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/35"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                        {connectorCategoryLabel(family.category)}
                      </div>
                      <div className="mt-2 text-lg font-semibold tabular-nums text-[var(--text)]">
                        {family.ready}/{family.total}
                      </div>
                    </div>
                    <Badge tone={tone}>{statusLabel}</Badge>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                    {family.missingSecrets} missing secret value{family.missingSecrets === 1 ? "" : "s"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-t border-[var(--border)]">
          <DataTable
            caption="Enterprise connector setup catalog"
            minWidth={1120}
            columns={["Connector", "Status", "Mode", "Activation", "Missing", "Scopes", "Next action"]}
            rows={connectors.map((connector) => [
              <button
                key="connector"
                type="button"
                onClick={() => onOpenView("broker")}
                className="text-left"
              >
                <span className="block font-semibold text-[var(--text)]">{connector.label}</span>
                <span className="mt-1 block text-xs text-[var(--text-muted)]">{connector.system} · {connector.category}</span>
              </button>,
              <Badge key="status" tone={connectorTone(connector.status)}>{connector.status.replace("-", " ")}</Badge>,
              connector.executionMode.replace("-", " "),
              <div key="activation">
                <div className="font-semibold text-[var(--text)]">{connector.activationState?.replace("-", " ") ?? "not started"}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {(connector.activationChecklist ?? []).filter((item) => item.status === "complete").length}/
                  {connector.activationChecklist?.length ?? 0} controls complete
                </div>
              </div>,
              connector.missingSecrets.length ? connector.missingSecrets.join(", ") : "None",
              connector.requiredScopes.slice(0, 3).join(", ") + (connector.requiredScopes.length > 3 ? "..." : ""),
              connector.nextActivationAction ?? connector.setupAction,
            ])}
            emptyMessage="No enterprise connector catalog is available yet. Run readiness checks or add connector definitions."
          />
        </div>
      </details>

      <details
        className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
        data-testid="connector-stack-proof"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-[var(--text)]">Stack plan, providers, zones, and guardrails</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              Open for the complete launch stack, model provider defaults, integration zones, and production guardrails.
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-[var(--text-soft)]" />
        </summary>
        <div className="grid gap-4 border-t border-[var(--border)] p-5 xl:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <SectionTitle title="Day-One Stack Plan" helper="The minimum viable customer launch path" compact />
            <div className="mt-4 space-y-2">
              {connectorStackPlan.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onOpenView(item.view)}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[var(--primary-soft)]/70"
                >
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                      item.ready ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-subtle)] text-[var(--text-soft)]"
                    }`}
                  >
                    {item.ready ? <Check size={13} /> : <ArrowRight size={13} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text)]">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">{item.proof}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <SectionTitle title="Provider Defaults" helper="Model routing should work once keys are stored." compact />
            <div className="mt-4 space-y-3">
              {providerVault.map((provider) => (
                <div key={provider.id} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">{provider.label}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{provider.recommendedFor.slice(0, 2).join(" · ")}</div>
                    </div>
                    <Badge tone={provider.configured ? "green" : provider.id === "local" ? "blue" : "slate"}>
                      {provider.configured ? "ready" : provider.id === "local" ? "fallback" : "needs key"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <SectionTitle title="Integration Zones" helper="Where this OS plugs into the enterprise" compact />
            <div className="mt-4 space-y-3">
              {integrationBlueprint.zones.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => onOpenView(zone.targetView)}
                  className="w-full rounded-lg bg-[var(--surface)]/80 p-3 text-left ring-1 ring-[var(--border)]/70 transition hover:bg-[var(--primary-soft)] hover:ring-[var(--primary)]/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{zone.name}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{zone.evidence}</p>
                    </div>
                    <Badge tone={zoneTone(zone.status)}>{zone.score}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <SectionTitle title="Production Guardrails" compact />
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
              <div className="flex gap-2"><Database size={16} className="mt-1 text-[var(--primary)]" /> Permission-aware retrieval before model context.</div>
              <div className="flex gap-2"><ShieldCheck size={16} className="mt-1 text-[var(--primary)]" /> Broker policy before every write, send, create, update, or execute action.</div>
              <div className="flex gap-2"><Network size={16} className="mt-1 text-[var(--primary)]" /> External automation platforms act only as governed executors.</div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
