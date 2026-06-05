import { useState } from "react";
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
import { Badge, Button, DataTable, Panel, SectionTitle } from "@/components/ui";
import type { IntegrationBlueprint, IntegrationZone } from "@/lib/integration-blueprint";
import type { ProviderReadiness } from "@/lib/provider-registry";
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

export function ConnectorSetup({
  productionReadiness,
  integrationBlueprint,
  providerVault,
  onSaveConnectorSecrets,
  onOpenView,
  onOpenSettings,
}: {
  productionReadiness: ProductionReadiness | null;
  integrationBlueprint: IntegrationBlueprint;
  providerVault: ProviderReadiness[];
  onSaveConnectorSecrets: (secrets: Record<string, string>) => Promise<void>;
  onOpenView: (view: View) => void;
  onOpenSettings: () => void;
}) {
  const [connectorSecretDraft, setConnectorSecretDraft] = useState<Record<string, string>>({});
  const [savingConnectorSecrets, setSavingConnectorSecrets] = useState(false);
  const catalog = productionReadiness?.connectors?.catalog;
  const connectors = catalog?.connectors ?? [];
  const readyConnectors = connectors.filter((connector) => connector.status === "ready" || connector.status === "broker-managed");
  const missingSecrets = connectors.reduce((sum, connector) => sum + connector.missingSecrets.length, 0);
  const configuredProviders = providerVault.filter((provider) => provider.id !== "local" && provider.configured);
  const primaryModelReady =
    providerVault.some((provider) => provider.id === "openai" && provider.configured) ||
    providerVault.some((provider) => provider.id === "openrouter" && provider.configured);
  const setupSteps = [
    {
      label: "Identity",
      body: "Connect SSO groups, user departments, and approver roles so every AI action is bound to the requesting human.",
      view: "admin" as View,
      ready: Boolean(productionReadiness?.auth?.oidcConfigured),
    },
    {
      label: "Models",
      body: "Store OpenAI or OpenRouter first, then add specialist providers for cheap classification, governance, workflows, and evals.",
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
  const nextConnectorSecretNames = new Set(nextConnectorSecretRows.map((secret) => secret.name));
  const connectorSecretPayload = Object.fromEntries(
    Object.entries(connectorSecretDraft)
      .map(([name, value]) => [name, value.trim()] as const)
      .filter(([name, value]) => nextConnectorSecretNames.has(name) && value.length > 0),
  );
  const connectorSecretDraftCount = Object.keys(connectorSecretPayload).length;
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
      proof: primaryModelReady ? "OpenAI/OpenRouter default ready" : "Add OpenAI or OpenRouter first",
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
      proof: catalog?.brokerConfigured ? catalog.brokerMode : "Policy-only until broker URL is configured",
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

  return (
    <div>
      <PageHeader
        title="Connector Setup"
        subtitle="The guided setup surface for plugging the OS into identity, models, knowledge, work systems, automations, and evidence"
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

      <Panel className="mt-4 overflow-hidden" data-testid="connector-primary-activation">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="p-5 sm:p-6">
            {nextConnector ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={connectorTone(nextConnector.status)}>{nextConnector.status.replace("-", " ")}</Badge>
                  <Badge tone={nextConnector.missingSecrets.length ? "amber" : "green"}>
                    {nextConnector.missingSecrets.length ? `${nextConnector.missingSecrets.length} secrets needed` : "secrets ready"}
                  </Badge>
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Connect {nextConnector.label}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{nextConnector.productionUse}</p>

                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                      <ClipboardCheck size={17} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">
                        {nextPendingConnectorStep?.label ?? "Connector activation complete"}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {nextPendingConnectorStep?.action ?? "Keep connector scopes, policy decisions, and ledger evidence under review."}
                      </p>
                      {nextPendingConnectorStep ? (
                        <div className="mt-2 text-xs font-semibold text-slate-500">Owner: {nextPendingConnectorStep.owner}</div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
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
              <div className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                No connector catalog is loaded yet. Run production readiness or connect a Broker catalog to generate the activation path.
              </div>
            )}
          </div>

          <div className="hidden border-t border-slate-200 bg-slate-50/60 p-5 md:block xl:border-l xl:border-t-0">
            <SectionTitle title="Activation checklist" helper="Only the next connector controls are shown here by default." compact />
            <div className="mt-4 space-y-2">
              {nextConnectorChecklist.map((item) => (
                <div key={item.id} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200/70">
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                      item.status === "complete" ? "bg-green-100 text-green-700" : "bg-slate-50 text-slate-400 ring-1 ring-slate-200"
                    }`}
                  >
                    {item.status === "complete" ? <Check size={12} /> : null}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">{item.label}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-slate-500">{item.owner}</div>
                  </div>
                </div>
              ))}
              {!nextConnectorChecklist.length ? (
                <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-500 ring-1 ring-slate-200/70">
                  No checklist controls are available for this connector.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>

      {nextConnector ? (
        <Panel className="mt-4 overflow-hidden" data-testid="connector-implementation-playbook">
          <details className="group bg-white md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-950">Implementation playbook</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {nextConnector.label}: secrets, scopes, tests, and evidence.
                </span>
              </span>
              <Badge tone={connectorTone(nextConnector.status)}>
                {nextConnectorCompletedControls}/{Math.max(nextConnectorChecklist.length, 1)}
              </Badge>
            </summary>
            <div className="space-y-4 border-t border-slate-200 p-4">
              <div className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                {nextConnector.setupAction}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Tenant vault names</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {nextConnectorSecretRows.map((secret) => (
                    <Badge key={secret.name} tone={secret.ready ? "green" : secret.required ? "amber" : "slate"}>
                      {secret.name}{secret.required ? "" : " optional"}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Scopes</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {nextConnector.requiredScopes.map((scope) => (
                    <Badge key={scope} tone="blue">{scope}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </details>
          <div className="hidden gap-px bg-slate-200/70 md:grid xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="bg-white p-5 sm:p-6">
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
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {implementationSteps.map((step) => {
                  const StepIcon = step.icon;

                  return (
                    <div key={step.label} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <div className="flex items-start gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--primary)] ring-1 ring-slate-200">
                          <StepIcon size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-950">{step.label}</div>
                          <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{step.owner}</div>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-600">{step.body}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <SearchCheck className="mt-0.5 shrink-0 text-green-600" size={17} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950">Evidence tests before production</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {["Read path", "Action gate", "Ledger event"].map((label, index) => {
                        const control = nextConnectorChecklist[index + 2];
                        const complete = control?.status === "complete";

                        return (
                          <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-800">{label}</span>
                              <Badge tone={complete ? "green" : "amber"}>{complete ? "done" : "needed"}</Badge>
                            </div>
                            <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
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

            <div className="bg-slate-50/80 p-5 sm:p-6">
              <div id="connector-vault-form" className="scroll-mt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <SectionTitle
                    title="Tenant vault"
                    helper="Store native connector secrets without exposing saved values back to the browser."
                    compact
                  />
                  <Button
                    className="shrink-0"
                    disabled={!connectorSecretDraftCount || savingConnectorSecrets}
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
                <div className="mt-4 grid gap-3">
                  {nextConnectorSecretRows.map((secret) => (
                    <label key={secret.name} className="block">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{secret.name}</span>
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
                          secret.ready ? "text-green-700" : secret.required ? "text-amber-700" : "text-slate-500"
                        }`}
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
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm leading-6 text-slate-600">
                      This connector does not require tenant-managed secrets. Finish scopes, policy tests, and evidence capture.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 border-t border-slate-200 pt-5">
                <SectionTitle title="Scopes and capabilities" helper="The exact implementation inputs this connector needs." compact />
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Required scopes</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {nextConnector.requiredScopes.map((scope) => (
                      <Badge key={scope} tone="blue">{scope}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Enabled capabilities</div>
                  <div className="mt-2 space-y-1.5">
                    {nextConnector.capabilities.map((capability) => (
                      <div key={capability} className="flex items-center gap-2 text-xs leading-5 text-slate-600">
                        <Check size={13} className="shrink-0 text-green-600" />
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
        className="mt-4 overflow-hidden rounded-lg border border-slate-200/52 bg-white/[0.76] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl"
        data-testid="connector-setup-order"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-slate-950">Recommended setup order and readiness</div>
            <div className="mt-1 text-sm text-slate-500">
              {setupComplete}/{setupSteps.length} zones ready. Open for identity, model, knowledge, work-system, and evidence setup proof.
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-slate-400" />
        </summary>
        <div className="border-t border-slate-200 p-5">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              {
                label: "Ready connectors",
                value: `${readyConnectors.length}/${Math.max(connectors.length, 1)}`,
                helper: catalog?.brokerMode ?? "policy-only",
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
                helper: primaryModelReady ? `${configuredProviders.length} provider${configuredProviders.length === 1 ? "" : "s"}` : "add OpenAI or OpenRouter",
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
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{item.label}</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">{item.value}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</div>
                  </div>
                  <Badge tone={item.tone as "green" | "amber" | "red"}>{item.tone}</Badge>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {setupSteps.map((step, index) => (
              <button
                key={step.label}
                type="button"
                onClick={() => onOpenView(step.view)}
                className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]/35"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      step.ready ? "bg-green-50 text-green-700 ring-1 ring-green-100" : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
                    }`}
                  >
                    {step.ready ? <Check size={13} /> : index + 1}
                  </span>
                  <span className="text-sm font-semibold text-slate-950">{step.label}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{step.body}</p>
              </button>
            ))}
          </div>
        </div>
      </details>

      <details
        className="mt-4 overflow-hidden rounded-lg border border-slate-200/52 bg-white/[0.76] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl"
        data-testid="connector-catalog-proof"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-slate-950">Connector catalog and missing secrets</div>
            <div className="mt-1 text-sm text-slate-500">
              {readyConnectors.length}/{Math.max(connectors.length, 1)} ready, {missingSecrets} missing secret value{missingSecrets === 1 ? "" : "s"}.
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-slate-400" />
        </summary>
        <div className="border-t border-slate-200">
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
                <span className="block font-semibold text-slate-950">{connector.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{connector.system} · {connector.category}</span>
              </button>,
              <Badge key="status" tone={connectorTone(connector.status)}>{connector.status.replace("-", " ")}</Badge>,
              connector.executionMode.replace("-", " "),
              <div key="activation">
                <div className="font-semibold text-slate-900">{connector.activationState?.replace("-", " ") ?? "not started"}</div>
                <div className="mt-1 text-xs text-slate-500">
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
        className="mt-4 overflow-hidden rounded-lg border border-slate-200/52 bg-white/[0.76] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl"
        data-testid="connector-stack-proof"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="font-semibold text-slate-950">Stack plan, providers, zones, and guardrails</div>
            <div className="mt-1 text-sm text-slate-500">
              Open for the complete launch stack, model provider defaults, integration zones, and production guardrails.
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-slate-400" />
        </summary>
        <div className="grid gap-4 border-t border-slate-200 p-5 xl:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
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
                      item.ready ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {item.ready ? <Check size={13} /> : <ArrowRight size={13} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.proof}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <SectionTitle title="Provider Defaults" helper="Model routing should work once keys are stored." compact />
            <div className="mt-4 space-y-3">
              {providerVault.map((provider) => (
                <div key={provider.id} className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{provider.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{provider.recommendedFor.slice(0, 2).join(" · ")}</div>
                    </div>
                    <Badge tone={provider.configured ? "green" : provider.id === "local" ? "blue" : "slate"}>
                      {provider.configured ? "ready" : provider.id === "local" ? "fallback" : "needs key"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <SectionTitle title="Integration Zones" helper="Where this OS plugs into the enterprise" compact />
            <div className="mt-4 space-y-3">
              {integrationBlueprint.zones.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => onOpenView(zone.targetView)}
                  className="w-full rounded-lg bg-white/80 p-3 text-left ring-1 ring-slate-200/70 transition hover:bg-[var(--primary-soft)] hover:ring-[var(--primary)]/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{zone.name}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{zone.evidence}</p>
                    </div>
                    <Badge tone={zoneTone(zone.status)}>{zone.score}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <SectionTitle title="Production Guardrails" compact />
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
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
