import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Database,
  KeyRound,
  MessageSquare,
  Network,
  Plug,
  Route,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  UsersRound,
  X,
} from "lucide-react";
import { Badge, Button, CheckRow, Field, Panel, SectionTitle } from "@/components/ui";
import { defaultAISettings, type AIProviderSettings } from "@/lib/model-router";
import type { ProviderReadiness } from "@/lib/provider-registry";
import type { ProductionReadiness } from "@/lib/ui/types";

function SecretField({
  label,
  value,
  onChange,
  serverConfigured,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  serverConfigured?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        className="input font-mono text-xs"
        type="password"
        placeholder={serverConfigured ? "Saved in tenant vault" : "Paste key later"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {serverConfigured ? (
        <div className="mt-1 text-xs leading-5 text-green-700">
          Saved server-side. Paste a new key only when rotating credentials.
        </div>
      ) : null}
    </Field>
  );
}

function ChevronIcon() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition group-open:rotate-90">
      <ChevronRight size={15} />
    </span>
  );
}

export function AISettingsModal({
  settings,
  providerVault,
  productionReadiness,
  onClose,
  onSave,
  onSaveConnectorSecrets,
  onOpenConnectors,
}: {
  settings: AIProviderSettings;
  providerVault: ProviderReadiness[];
  productionReadiness?: ProductionReadiness | null;
  onClose: () => void;
  onSave: (settings: AIProviderSettings) => void | Promise<void>;
  onSaveConnectorSecrets: (secrets: Record<string, string>) => Promise<void>;
  onOpenConnectors: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [connectorSecretDraft, setConnectorSecretDraft] = useState<Record<string, string>>({});
  const [savingConnectorSecrets, setSavingConnectorSecrets] = useState(false);
  const vaultById = new Map(providerVault.map((provider) => [provider.id, provider]));
  const providerStatusRows = [
    { id: "local", name: "Local Runtime", configured: true },
    { id: "openai", name: "OpenAI", configured: Boolean(draft.openaiKey) },
    { id: "anthropic", name: "Anthropic", configured: Boolean(draft.anthropicKey) },
    { id: "google", name: "Gemini / Google", configured: Boolean(draft.googleKey) },
    { id: "azure_openai", name: "Azure OpenAI", configured: Boolean(draft.azureKey && draft.azureEndpoint) },
    { id: "kimi", name: "Kimi / Moonshot", configured: Boolean(draft.kimiKey && draft.kimiBaseUrl) },
    { id: "glm", name: "GLM / Z.AI", configured: Boolean(draft.glmKey && draft.glmBaseUrl) },
    { id: "deepseek", name: "DeepSeek", configured: Boolean(draft.deepseekKey && draft.deepseekBaseUrl) },
    { id: "openrouter", name: "OpenRouter", configured: Boolean(draft.openrouterKey && draft.openrouterBaseUrl) },
  ] as const;
  const readyProviderCount = providerStatusRows.filter((provider) => provider.configured || vaultById.get(provider.id)?.configured).length;
  const defaultProviderName = providerStatusRows.find((provider) => provider.id === draft.defaultProvider)?.name ?? "Local Runtime";
  const externalProviderReady = providerStatusRows.some(
    (provider) => provider.id !== "local" && (provider.configured || vaultById.get(provider.id)?.configured),
  );
  const privacyReady = draft.piiRedaction && draft.monthlyBudgetUsd > 0;
  const connectorCatalog = productionReadiness?.connectors?.catalog;
  const connectorRows = connectorCatalog?.connectors ?? [];
  const connectorReadyCount =
    connectorCatalog?.readyCount ??
    connectorRows.filter((connector) => connector.status === "ready" || connector.status === "broker-managed").length;
  const connectorTotalCount = connectorCatalog?.requiredCount ?? connectorRows.length;
  const connectorMissingSecretCount = connectorRows.reduce((sum, connector) => sum + connector.missingSecrets.length, 0);
  const connectorProductionReady = Boolean(connectorCatalog?.productionReady);
  const initialSetupTab = connectorProductionReady || !connectorRows.length ? "models" : "apps";
  const [setupTab, setSetupTab] = useState<"apps" | "models">(initialSetupTab);
  const nextConnector =
    connectorRows.find((connector) => connector.status === "partial") ??
    connectorRows.find((connector) => connector.status === "missing") ??
    connectorRows.find((connector) => !["ready", "broker-managed"].includes(connector.status)) ??
    connectorRows[0];
  const nextConnectorSecretRows = nextConnector
    ? [
        ...nextConnector.requiredSecretNames.map((name) => ({
          name,
          required: true,
          configured: nextConnector.configuredSecrets.includes(name),
          missing: nextConnector.missingSecrets.includes(name),
        })),
        ...(nextConnector.optionalSecretNames ?? [])
          .filter((name) => !nextConnector.requiredSecretNames.includes(name))
          .map((name) => ({
            name,
            required: false,
            configured: nextConnector.configuredSecrets.includes(name),
            missing: nextConnector.missingSecrets.includes(name),
          })),
      ]
    : [];
  const connectorSecretPayload = Object.fromEntries(
    Object.entries(connectorSecretDraft)
      .map(([name, value]) => [name, value.trim()] as const)
      .filter(([, value]) => value.length > 0),
  );
  const connectorSecretDraftCount = Object.keys(connectorSecretPayload).length;
  const categoryRows = [
    { id: "collaboration", label: "Collaboration", icon: MessageSquare },
    { id: "ticketing", label: "Work tickets", icon: TicketCheck },
    { id: "knowledge", label: "Knowledge", icon: Database },
    { id: "hris", label: "HR systems", icon: UsersRound },
  ].map((category) => {
    const matches = connectorRows.filter((connector) => connector.category === category.id);
    const ready = matches.filter((connector) => connector.status === "ready" || connector.status === "broker-managed").length;
    return {
      ...category,
      count: matches.length,
      ready,
      status: matches.length === 0 ? "missing" : ready === matches.length ? "ready" : ready > 0 ? "partial" : "missing",
    };
  });
  const modelSetupPath = [
    {
      label: "Choose provider",
      title: defaultProviderName,
      helper: draft.defaultProvider === "local" ? "Good for demo mode and deterministic tests." : "This provider will handle normal assistant and Skill work.",
      ready: Boolean(draft.defaultProvider),
      actionLabel: "Use defaults",
      action: useRecommendedDefaults,
      icon: Sparkles,
    },
    {
      label: "Add key",
      title: externalProviderReady ? "External model lane ready" : "Add one provider key",
      helper: externalProviderReady ? "The OS can call a real model after saving." : "Local mode works for demos, but realistic Skill tests need a provider key.",
      ready: externalProviderReady,
      actionLabel: "Open keys",
      action: () => {
        document.getElementById("provider-keys-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      icon: KeyRound,
    },
    {
      label: "Protect evidence",
      title: privacyReady ? "Safety defaults are on" : "Turn safety defaults on",
      helper: privacyReady ? "PII redaction and budget guardrails are active." : "Keep redaction enabled and set a monthly budget before launch.",
      ready: privacyReady,
      actionLabel: "Review safety",
      action: () => {
        document.getElementById("evidence-logging-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      icon: ShieldCheck,
    },
    {
      label: "Save",
      title: externalProviderReady ? "Ready to save" : "Save local setup",
      helper: externalProviderReady ? "Save to move keys into the server vault and apply routing." : "Save local setup now, then add keys when procurement is ready.",
      ready: externalProviderReady && privacyReady,
      actionLabel: "Save setup",
      action: () => void onSave(draft),
      icon: Route,
    },
  ];
  const completedModelSteps = modelSetupPath.filter((item) => item.ready).length;
  const nextModelStep = modelSetupPath.find((item) => !item.ready) ?? modelSetupPath[modelSetupPath.length - 1];
  const NextModelIcon = nextModelStep.icon;
  const readinessRows = [
    {
      label: "Provider",
      value: defaultProviderName,
      ready: Boolean(draft.defaultProvider),
    },
    {
      label: "Real model key",
      value: externalProviderReady ? "Ready after save" : "Not connected",
      ready: externalProviderReady,
    },
    {
      label: "Evidence safety",
      value: privacyReady ? "Redaction and budget on" : "Needs review",
      ready: privacyReady,
    },
  ];
  const routingRows = [
    {
      key: "classificationModel",
      label: "Classification / scoring",
      helper: "Risk labels, use case triage, routing decisions",
    },
    {
      key: "summarizationModel",
      label: "Summaries / briefs",
      helper: "Exec briefs, meeting notes, portfolio summaries",
    },
    {
      key: "governanceModel",
      label: "Governance reasoning",
      helper: "Risk review, policy interpretation, approvals",
    },
    {
      key: "workflowModel",
      label: "Agentic workflow",
      helper: "Skill tests, tool planning, workflow synthesis",
    },
    {
      key: "redTeamModel",
      label: "Red-team / evals",
      helper: "Prompt injection, permission tests, adversarial checks",
    },
    {
      key: "fallbackModel",
      label: "Fallback",
      helper: "Used when a primary lane is unconfigured or unavailable",
    },
  ] as const;

  function update<K extends keyof AIProviderSettings>(key: K, value: AIProviderSettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function useRecommendedDefaults() {
    setDraft((current) => ({
      ...current,
      defaultProvider: "openai",
      defaultModel: defaultAISettings.defaultModel,
      cheapModel: defaultAISettings.cheapModel,
      reasoningModel: defaultAISettings.reasoningModel,
      classificationModel: defaultAISettings.classificationModel,
      summarizationModel: defaultAISettings.summarizationModel,
      governanceModel: defaultAISettings.governanceModel,
      workflowModel: defaultAISettings.workflowModel,
      redTeamModel: defaultAISettings.redTeamModel,
      fallbackModel: "openrouter/auto",
    }));
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
      // The parent owns the toast message; keep draft values so admins can retry.
    } finally {
      setSavingConnectorSecrets(false);
    }
  }

  function connectorTone(status: string): "green" | "amber" | "red" | "blue" | "slate" {
    if (status === "ready") return "green";
    if (status === "broker-managed") return "blue";
    if (status === "partial") return "amber";
    if (status === "missing") return "red";
    return "slate";
  }

  function connectorLabel(status: string) {
    if (status === "broker-managed") return "Broker";
    if (status === "partial") return "Partial";
    if (status === "missing") return "Missing";
    if (status === "ready") return "Ready";
    return status;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/20 p-4 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        aria-modal="true"
        className="mx-auto mt-6 max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.24)] sm:mt-10"
        data-testid="company-setup-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={connectorProductionReady ? "green" : connectorReadyCount ? "amber" : "red"}>
                  {connectorReadyCount}/{Math.max(connectorTotalCount, 1)} apps ready
                </Badge>
                <Badge tone={externalProviderReady ? "green" : "amber"}>
                  {externalProviderReady ? "model ready" : "local-only model"}
                </Badge>
              </div>
              <div className="mt-2 text-lg font-semibold">Company Setup</div>
              <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Connect business apps, model providers, tenant secrets, and policy gates from one admin surface.
              </div>
            </div>
            <button
              aria-label="Close company setup"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                setupTab === "apps" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-950"
              }`}
              data-testid="company-setup-apps-tab"
              onClick={() => setSetupTab("apps")}
            >
              <Plug size={15} />
              Apps
            </button>
            <button
              type="button"
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                setupTab === "models" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-950"
              }`}
              data-testid="company-setup-models-tab"
              onClick={() => setSetupTab("models")}
            >
              <Sparkles size={15} />
              Models
            </button>
          </div>
        </div>

        {setupTab === "apps" ? (
          <div className="grid max-h-[74vh] gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_340px]" data-testid="company-apps-panel">
            <div className="space-y-5">
              <Panel className="overflow-hidden">
                <div className="border-b border-slate-200/70 bg-[var(--primary-soft)]/42 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={connectorProductionReady ? "green" : connectorReadyCount ? "amber" : "red"}>
                          {connectorProductionReady ? "production-ready apps" : "apps need setup"}
                        </Badge>
                        <Badge tone={productionReadiness?.connectors?.mode === "policy-only" ? "amber" : "blue"}>
                          {productionReadiness?.connectors?.mode ?? connectorCatalog?.brokerMode ?? "policy-only"}
                        </Badge>
                      </div>
                      <h2 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
                        {nextConnector ? `Connect ${nextConnector.label}` : "Connect the first company app"}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                        {nextConnector?.nextActivationAction ??
                          "Open Connect Apps to choose Slack, Jira, ServiceNow, Microsoft 365, SharePoint, Workday, or Google Workspace and capture the readiness evidence."}
                      </p>
                    </div>
                    <Button className="shrink-0 whitespace-nowrap" onClick={onOpenConnectors} data-testid="open-connect-apps-from-settings">
                      <Network size={15} />
                      Open Connect Apps
                    </Button>
                  </div>
                </div>
                <div className="grid gap-px bg-slate-200/70 md:grid-cols-4">
                  {categoryRows.map((category) => {
                    const CategoryIcon = category.icon;

                    return (
                      <button
                        key={category.id}
                        type="button"
                        className="grid min-h-[104px] grid-cols-[32px_minmax(0,1fr)] gap-3 bg-white p-4 text-left transition hover:bg-slate-50"
                        onClick={onOpenConnectors}
                      >
                        <span
                          className={`flex size-8 items-center justify-center rounded-lg ${
                            category.status === "ready"
                              ? "bg-green-50 text-green-700 ring-1 ring-green-100"
                              : category.status === "partial"
                                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <CategoryIcon size={15} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            {category.ready}/{category.count || 1}
                          </span>
                          <span className="mt-1 block text-sm font-semibold text-slate-950">{category.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {category.count ? (category.status === "ready" ? "Ready for governed work" : "Needs connector setup") : "Not in current catalog"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Panel>

              {nextConnector ? (
                <Panel className="p-4" data-testid="connector-secret-panel">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <SectionTitle
                      title="Tenant vault"
                      helper={`${nextConnector.label} secrets are encrypted server-side and never returned to the browser.`}
                    />
                    <Button
                      className="shrink-0"
                      disabled={!connectorSecretDraftCount || savingConnectorSecrets}
                      onClick={() => void saveConnectorSecretDraft()}
                      data-testid="save-connector-secrets"
                    >
                      <KeyRound size={15} />
                      {savingConnectorSecrets
                        ? "Saving"
                        : connectorSecretDraftCount
                          ? `Save ${connectorSecretDraftCount}`
                          : "Save secrets"}
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {nextConnectorSecretRows.map((secret) => (
                      <Field key={secret.name} label={secret.name}>
                        <input
                          className="input font-mono text-xs"
                          type="password"
                          placeholder={secret.configured ? "Saved in tenant vault" : secret.required ? "Required for launch" : "Optional"}
                          value={connectorSecretDraft[secret.name] ?? ""}
                          onChange={(event) =>
                            setConnectorSecretDraft((current) => ({
                              ...current,
                              [secret.name]: event.target.value,
                            }))
                          }
                        />
                        <div
                          className={`mt-1 text-xs leading-5 ${
                            secret.configured
                              ? "text-green-700"
                              : secret.required
                                ? "text-amber-700"
                                : "text-slate-500"
                          }`}
                        >
                          {secret.configured
                            ? "Configured. Paste a new value only when rotating."
                            : secret.required
                              ? "Required before this connector can run governed work."
                              : "Optional; add when the workflow needs it."}
                        </div>
                      </Field>
                    ))}
                    {!nextConnectorSecretRows.length ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm leading-6 text-slate-600 md:col-span-2">
                        {nextConnector.label} does not require tenant-managed secrets. Use Connect Apps to finish scopes and activation evidence.
                      </div>
                    ) : null}
                  </div>
                </Panel>
              ) : null}

              <Panel className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <SectionTitle title="Company app connections" helper="Connect the systems where employees already ask, search, approve, and track work." />
                  <Button className="shrink-0" variant="secondary" onClick={onOpenConnectors}>
                    <Plug size={15} />
                    Manage catalog
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {connectorRows.map((connector) => (
                    <button
                      key={connector.id}
                      type="button"
                      className="flex min-h-[116px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-px hover:border-[var(--primary)]/24 hover:bg-slate-50"
                      onClick={onOpenConnectors}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-950">{connector.label}</span>
                          <span className="mt-1 block truncate text-xs font-medium text-slate-500">{connector.system}</span>
                        </span>
                        <Badge tone={connectorTone(connector.status)}>{connectorLabel(connector.status)}</Badge>
                      </span>
                      <span className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{connector.productionUse}</span>
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        {connector.missingSecrets.length ? (
                          <Badge tone="amber">{connector.missingSecrets.length} secret{connector.missingSecrets.length === 1 ? "" : "s"}</Badge>
                        ) : (
                          <Badge tone="green">secrets ready</Badge>
                        )}
                        <Badge tone="slate">{connector.requiredScopes.length} scopes</Badge>
                      </span>
                    </button>
                  ))}
                  {!connectorRows.length ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600 md:col-span-2">
                      Connector readiness has not loaded yet. Open Connect Apps to refresh the catalog and readiness gates.
                    </div>
                  ) : null}
                </div>
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel className="p-4">
                <SectionTitle title="App readiness" helper="The implementation checks a customer admin needs before launch." />
                <div className="mt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Connected apps</div>
                      <div className="mt-1 truncate text-sm font-semibold text-slate-950">
                        {connectorReadyCount}/{Math.max(connectorTotalCount, 1)} ready
                      </div>
                    </div>
                    <Badge tone={connectorProductionReady ? "green" : "amber"}>{connectorProductionReady ? "Ready" : "Next"}</Badge>
                  </div>
                  <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Tenant secrets</div>
                      <div className="mt-1 truncate text-sm font-semibold text-slate-950">
                        {connectorMissingSecretCount ? `${connectorMissingSecretCount} missing` : "Ready"}
                      </div>
                    </div>
                    <Badge tone={connectorMissingSecretCount ? "amber" : "green"}>{connectorMissingSecretCount ? "Review" : "Ready"}</Badge>
                  </div>
                  <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Broker mode</div>
                      <div className="mt-1 truncate text-sm font-semibold text-slate-950">
                        {productionReadiness?.connectors?.mode ?? connectorCatalog?.brokerMode ?? "policy-only"}
                      </div>
                    </div>
                    <Badge tone={productionReadiness?.connectors?.mode === "policy-only" ? "amber" : "blue"}>Policy</Badge>
                  </div>
                </div>
              </Panel>
              <Panel className="p-4">
                <SectionTitle title="Production pattern" />
                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <div className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-green-600" size={15} /> Least-privilege scopes before any write action.</div>
                  <div className="flex gap-2"><Route className="mt-0.5 shrink-0 text-green-600" size={15} /> Broker policy separates model intent from execution.</div>
                  <div className="flex gap-2"><Database className="mt-0.5 shrink-0 text-[var(--primary)]" size={15} /> Evidence records approval, payload redaction, and external response metadata.</div>
                </div>
              </Panel>
              <details className="group rounded-lg border border-slate-200 bg-white shadow-[var(--shadow-card)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">Next connector detail</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {nextConnector ? `${nextConnector.label}: ${connectorLabel(nextConnector.status)}` : "No connector selected yet."}
                    </span>
                  </span>
                  <ChevronIcon />
                </summary>
                <div className="space-y-3 border-t border-slate-200 p-3 text-sm leading-6 text-slate-600">
                  {nextConnector ? (
                    <>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">{nextConnector.setupAction}</div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        Required scopes: {nextConnector.requiredScopes.join(", ")}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg bg-slate-50 px-3 py-2">Open Connect Apps to load the connector setup path.</div>
                  )}
                </div>
              </details>
            </div>
          </div>
        ) : (
        <div className="grid max-h-[74vh] gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <Panel className="overflow-hidden" data-testid="model-readiness-path">
              <div className="border-b border-slate-200/70 bg-[var(--primary-soft)]/42 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={externalProviderReady ? "green" : "amber"}>
                        {externalProviderReady ? "real model ready" : "local-only"}
                      </Badge>
                      <Badge tone={completedModelSteps >= 3 ? "green" : "blue"}>
                        {completedModelSteps}/{modelSetupPath.length} ready
                      </Badge>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">{nextModelStep.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{nextModelStep.helper}</p>
                  </div>
                  <Button className="shrink-0 whitespace-nowrap" onClick={nextModelStep.action} data-testid="model-next-action">
                    <NextModelIcon size={15} />
                    {nextModelStep.actionLabel}
                  </Button>
                </div>
              </div>
              <div className="grid gap-px bg-slate-200/70 md:grid-cols-4">
                {modelSetupPath.map((item, index) => {
                  const ItemIcon = item.icon;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className="grid min-h-[112px] grid-cols-[32px_minmax(0,1fr)] gap-3 bg-white p-4 text-left transition hover:bg-slate-50"
                      data-testid={`model-path-step-${index + 1}`}
                    >
                      <span
                        className={`flex size-8 items-center justify-center rounded-lg ${
                          item.ready ? "bg-green-50 text-green-700 ring-1 ring-green-100" : "bg-[var(--primary-soft)] text-[var(--primary)]"
                        }`}
                      >
                        {item.ready ? <CheckCircle2 size={15} /> : <ItemIcon size={15} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{item.label}</span>
                        <span className="mt-1 block text-sm font-semibold text-slate-950">{item.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{item.helper}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <SectionTitle title="Basic setup" helper="Most teams only need these choices plus one provider key. Leave the routing details alone until a team asks for them." />
                <Button className="shrink-0" variant="secondary" onClick={useRecommendedDefaults}>
                  <Sparkles size={15} />
                  Use defaults
                </Button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Main model provider">
                  <select
                    className="input"
                    value={draft.defaultProvider}
                    onChange={(event) => update("defaultProvider", event.target.value)}
                  >
                    <option value="local">Local Runtime</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Gemini / Google</option>
                    <option value="azure_openai">Azure OpenAI</option>
                    <option value="kimi">Kimi / Moonshot</option>
                    <option value="glm">GLM / Z.AI</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                  <div className="mt-1 text-xs leading-5 text-slate-500">The provider used for normal assistant and Skill work.</div>
                </Field>
                <Field label="Monthly budget guardrail">
                  <input
                    className="input"
                    type="number"
                    value={draft.monthlyBudgetUsd}
                    onChange={(event) => update("monthlyBudgetUsd", Number(event.target.value))}
                  />
                  <div className="mt-1 text-xs leading-5 text-slate-500">Used for cost warnings and launch readiness checks.</div>
                </Field>
              </div>
            </Panel>

            <details id="provider-keys-section" className="group scroll-mt-6 rounded-lg border border-slate-200 bg-white shadow-[var(--shadow-card)]" open={!externalProviderReady}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <KeyRound size={16} className="text-[var(--primary)]" />
                    Provider keys
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Add keys only for providers you intend to use. Saved keys move to the server vault after save.
                  </span>
                </span>
                <ChevronIcon />
              </summary>
              <div className="border-t border-slate-200 p-4">
                {!externalProviderReady ? (
                  <div className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                    Add one key to run realistic Skill tests. OpenAI or OpenRouter is usually the fastest first connection.
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <SecretField label="OpenAI API Key" value={draft.openaiKey} serverConfigured={vaultById.get("openai")?.configured} onChange={(value) => update("openaiKey", value)} />
                  <SecretField label="OpenRouter API Key" value={draft.openrouterKey} serverConfigured={vaultById.get("openrouter")?.configured} onChange={(value) => update("openrouterKey", value)} />
                  <SecretField label="Anthropic API Key" value={draft.anthropicKey} serverConfigured={vaultById.get("anthropic")?.configured} onChange={(value) => update("anthropicKey", value)} />
                  <SecretField label="Gemini / Google API Key" value={draft.googleKey} serverConfigured={vaultById.get("google")?.configured} onChange={(value) => update("googleKey", value)} />
                </div>

                <details className="group mt-4 rounded-lg border border-slate-200 bg-slate-50/70">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3">
                    <span>
                      <span className="block text-sm font-semibold text-slate-950">Enterprise and regional providers</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">Azure, Moonshot, GLM, DeepSeek, and custom endpoint URLs.</span>
                    </span>
                    <ChevronIcon />
                  </summary>
                  <div className="grid gap-4 border-t border-slate-200 p-3 md:grid-cols-2">
                    <SecretField label="Azure OpenAI Key" value={draft.azureKey} serverConfigured={vaultById.get("azure_openai")?.configured} onChange={(value) => update("azureKey", value)} />
                    <Field label="Azure Endpoint">
                      <input
                        className="input"
                        placeholder="https://your-resource.openai.azure.com"
                        value={draft.azureEndpoint}
                        onChange={(event) => update("azureEndpoint", event.target.value)}
                      />
                    </Field>
                    <SecretField label="Kimi / Moonshot API Key" value={draft.kimiKey} serverConfigured={vaultById.get("kimi")?.configured} onChange={(value) => update("kimiKey", value)} />
                    <Field label="Kimi Base URL">
                      <input
                        className="input font-mono text-xs"
                        value={draft.kimiBaseUrl}
                        onChange={(event) => update("kimiBaseUrl", event.target.value)}
                      />
                    </Field>
                    <SecretField label="GLM / Z.AI API Key" value={draft.glmKey} serverConfigured={vaultById.get("glm")?.configured} onChange={(value) => update("glmKey", value)} />
                    <Field label="GLM / Z.AI Base URL">
                      <input
                        className="input font-mono text-xs"
                        value={draft.glmBaseUrl}
                        onChange={(event) => update("glmBaseUrl", event.target.value)}
                      />
                    </Field>
                    <SecretField label="DeepSeek API Key" value={draft.deepseekKey} serverConfigured={vaultById.get("deepseek")?.configured} onChange={(value) => update("deepseekKey", value)} />
                    <Field label="DeepSeek Base URL">
                      <input
                        className="input font-mono text-xs"
                        value={draft.deepseekBaseUrl}
                        onChange={(event) => update("deepseekBaseUrl", event.target.value)}
                      />
                    </Field>
                    <Field label="OpenAI Base URL">
                      <input
                        className="input font-mono text-xs"
                        value={draft.openaiBaseUrl}
                        onChange={(event) => update("openaiBaseUrl", event.target.value)}
                      />
                    </Field>
                    <Field label="Anthropic Base URL">
                      <input
                        className="input font-mono text-xs"
                        value={draft.anthropicBaseUrl}
                        onChange={(event) => update("anthropicBaseUrl", event.target.value)}
                      />
                    </Field>
                    <Field label="Gemini / Google Base URL">
                      <input
                        className="input font-mono text-xs"
                        value={draft.googleBaseUrl}
                        onChange={(event) => update("googleBaseUrl", event.target.value)}
                      />
                    </Field>
                    <Field label="OpenRouter Base URL">
                      <input
                        className="input font-mono text-xs"
                        value={draft.openrouterBaseUrl}
                        onChange={(event) => update("openrouterBaseUrl", event.target.value)}
                      />
                    </Field>
                  </div>
                </details>
              </div>
            </details>

            <Panel id="evidence-logging-section" className="scroll-mt-6 p-4">
              <SectionTitle title="Safety and evidence" helper="Keep proof useful without turning every run into a privacy problem." />
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <CheckRow
                  checked={draft.piiRedaction}
                  label="PII redaction"
                  onChange={() => update("piiRedaction", !draft.piiRedaction)}
                />
                <CheckRow
                  checked={draft.storePrompts}
                  label="Store prompts"
                  onChange={() => update("storePrompts", !draft.storePrompts)}
                />
                <CheckRow
                  checked={draft.storeToolPayloads}
                  label="Store tool payloads"
                  onChange={() => update("storeToolPayloads", !draft.storeToolPayloads)}
                />
              </div>
            </Panel>

            <details className="group rounded-lg border border-slate-200 bg-white shadow-[var(--shadow-card)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Route size={16} className="text-[var(--primary)]" />
                    Advanced model routing
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Optional: assign different models to scoring, summaries, governance, workflows, evals, and fallback.
                  </span>
                </span>
                <ChevronIcon />
              </summary>
              <div className="border-t border-slate-200 p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Default model">
                    <input
                      className="input"
                      value={draft.defaultModel}
                      onChange={(event) => update("defaultModel", event.target.value)}
                    />
                  </Field>
                  <Field label="Cheap or bulk model">
                    <input
                      className="input"
                      value={draft.cheapModel}
                      onChange={(event) => update("cheapModel", event.target.value)}
                    />
                  </Field>
                  <Field label="Reasoning model">
                    <input
                      className="input"
                      value={draft.reasoningModel}
                      onChange={(event) => update("reasoningModel", event.target.value)}
                    />
                  </Field>
                </div>

                <div className="mt-5">
                  <SectionTitle title="Router lanes" helper="Model refs use provider/model. Keep routine lanes cheap and reserve stronger models for judgment-heavy work." />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {routingRows.map((row) => (
                      <Field key={row.key} label={row.label}>
                        <input
                          className="input font-mono text-xs"
                          value={draft[row.key]}
                          onChange={(event) => update(row.key, event.target.value)}
                        />
                        <div className="mt-1 text-xs leading-5 text-slate-500">{row.helper}</div>
                      </Field>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </div>

          <div className="space-y-4">
            <Panel className="p-4">
              <SectionTitle title="Setup health" helper="The launch-critical checks, without the provider noise." />
              <div className="mt-4 space-y-3">
                {readinessRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{row.label}</div>
                      <div className="mt-1 truncate text-sm font-semibold text-slate-950">{row.value}</div>
                    </div>
                    <Badge tone={row.ready ? "green" : "amber"}>{row.ready ? "Ready" : "Next"}</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-slate-200/70 bg-white px-3 py-3">
                <div className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                  <CircleDollarSign className="mt-0.5 shrink-0 text-green-600" size={15} />
                  <span>
                    Budget guardrail: <strong className="text-slate-950">${draft.monthlyBudgetUsd.toLocaleString()}</strong> per month.
                  </span>
                </div>
              </div>
            </Panel>
            <Panel className="p-4">
              <SectionTitle title="After save" />
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <div className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-green-600" size={15} /> Keys are stored server-side and hidden from the workspace export.</div>
                <div className="flex gap-2"><Route className="mt-0.5 shrink-0 text-green-600" size={15} /> Skills, Harness runs, and reports use the selected routing policy.</div>
                <div className="flex gap-2"><Sparkles className="mt-0.5 shrink-0 text-[var(--primary)]" size={15} /> You can keep local mode for demos while procurement approves real keys.</div>
              </div>
            </Panel>
            <details className="group rounded-lg border border-slate-200 bg-white shadow-[var(--shadow-card)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-950">Provider vault detail</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {readyProviderCount}/{providerStatusRows.length} providers available now or after save.
                  </span>
                </span>
                <ChevronIcon />
              </summary>
              <div className="space-y-2 border-t border-slate-200 p-3">
                {providerStatusRows.map((provider) => {
                  const serverReady = vaultById.get(provider.id)?.configured;
                  const configured = provider.configured || serverReady;

                  return (
                    <div key={provider.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{provider.name}</span>
                        <Badge tone={configured ? "green" : "slate"}>{configured ? "Ready" : "Needs key"}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {serverReady ? "server vault" : provider.configured ? "ready after save" : "not configured"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <Button variant="secondary" onClick={onClose}>{setupTab === "apps" ? "Close" : "Cancel"}</Button>
          {setupTab === "apps" ? (
            <Button onClick={onOpenConnectors}>
              <Network size={15} />
              Open Connect Apps
            </Button>
          ) : (
            <Button onClick={() => onSave(draft)}>Save model setup</Button>
          )}
        </div>
      </div>
    </div>
  );
}
