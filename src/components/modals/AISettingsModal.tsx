import { useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Cloud,
  Database,
  FileClock,
  Fingerprint,
  Gauge,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageSquare,
  Network,
  Plug,
  ReceiptText,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TicketCheck,
  UsersRound,
  Webhook,
  X,
} from "lucide-react";

import { Badge, Button, CheckRow, Field, Panel, SectionTitle, type BadgeTone } from "@/components/ui";
import { defaultAISettings, type AIProviderSettings } from "@/lib/model-router";
import type { ProviderReadiness } from "@/lib/provider-registry";
import { useDialogFocus } from "@/lib/ui/dialog-focus";
import type { ProductionReadiness } from "@/lib/ui/types";

type SettingsSection = "overview" | "identity" | "apps" | "models" | "data" | "security" | "workflows" | "usage" | "audit";

type EnterpriseDraft = {
  workspaceName: string;
  primaryDomain: string;
  environment: string;
  region: string;
  ssoIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  scimEndpoint: string;
  scimBearerToken: string;
  defaultRole: string;
  sessionTimeoutHours: number;
  requireMfa: boolean;
  allowLocalLogin: boolean;
  knowledgeRefresh: string;
  dataResidency: string;
  retentionDays: number;
  contextIndexMode: string;
  requireDlp: boolean;
  approvalMode: string;
  riskOwner: string;
  apiProtection: string;
  auditSigning: boolean;
  slackChannel: string;
  incidentEmail: string;
  approvalSlaHours: number;
  evalCadence: string;
  costCenter: string;
  invoiceOwner: string;
  alertThreshold: number;
  evidenceRetentionYears: number;
  backupCadence: string;
  exportReview: string;
};

const defaultEnterpriseDraft: EnterpriseDraft = {
  workspaceName: "Enterprise AI",
  primaryDomain: "enterprise.ai",
  environment: "Production",
  region: "United States",
  ssoIssuer: "https://idp.company.com/oidc",
  oidcClientId: "enablement-os-prod",
  oidcClientSecret: "",
  scimEndpoint: "https://api.enablement-os.example/scim/v2",
  scimBearerToken: "",
  defaultRole: "Contributor",
  sessionTimeoutHours: 8,
  requireMfa: true,
  allowLocalLogin: false,
  knowledgeRefresh: "Every 6 hours",
  dataResidency: "United States",
  retentionDays: 365,
  contextIndexMode: "Hybrid search plus citations",
  requireDlp: true,
  approvalMode: "Risk-based approvals",
  riskOwner: "AI Governance Council",
  apiProtection: "Signed admin and runtime requests",
  auditSigning: true,
  slackChannel: "#ai-ops",
  incidentEmail: "ai-risk@company.com",
  approvalSlaHours: 24,
  evalCadence: "Daily",
  costCenter: "AI Transformation",
  invoiceOwner: "Finance Operations",
  alertThreshold: 80,
  evidenceRetentionYears: 7,
  backupCadence: "Daily snapshots",
  exportReview: "Security review before external export",
};

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
        <div className="mt-1 text-xs leading-5 text-[var(--success)]">
          Saved server-side. Paste a new key only when rotating credentials.
        </div>
      ) : null}
    </Field>
  );
}

function StatTile({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: BadgeTone;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)]/82 bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</div>
          <div className="mt-2 truncate text-lg font-semibold tracking-tight text-[var(--text)]">{value}</div>
        </div>
        <Badge tone={tone}>{tone === "green" ? "Ready" : tone === "red" ? "Blocked" : tone === "amber" ? "Review" : "Set"}</Badge>
      </div>
      <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{helper}</div>
    </div>
  );
}

function SettingCard({
  id,
  title,
  helper,
  children,
  action,
}: {
  id?: string;
  title: string;
  helper?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Panel id={id} className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--border)]/72 bg-[var(--surface-muted)]/72 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle title={title} helper={helper} />
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </Panel>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: BadgeTone;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-[var(--surface-muted)] px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</div>
        <div className="mt-1 truncate text-sm font-semibold text-[var(--text)]">{value}</div>
      </div>
      <Badge tone={tone}>{tone === "green" ? "Ready" : tone === "red" ? "Missing" : tone === "amber" ? "Next" : "Info"}</Badge>
    </div>
  );
}

function InputGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function AISettingsModal({
  settings,
  providerVault,
  productionReadiness,
  onClose,
  onSave,
  onSaveConnectorSecrets,
  onDeleteTenantSecrets,
  onOpenConnectors,
}: {
  settings: AIProviderSettings;
  providerVault: ProviderReadiness[];
  productionReadiness?: ProductionReadiness | null;
  onClose: () => void;
  onSave: (settings: AIProviderSettings) => void | Promise<void>;
  onSaveConnectorSecrets: (secrets: Record<string, string>) => Promise<void>;
  onDeleteTenantSecrets: (names: string[]) => Promise<void>;
  onOpenConnectors: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [enterpriseDraft, setEnterpriseDraft] = useState(defaultEnterpriseDraft);
  const [activeSection, setActiveSection] = useState<SettingsSection>("models");
  const [connectorSecretDraft, setConnectorSecretDraft] = useState<Record<string, string>>({});
  const [savingConnectorSecrets, setSavingConnectorSecrets] = useState(false);
  const [deletingTenantSecrets, setDeletingTenantSecrets] = useState(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const {
    dialogRef,
    initialFocusRef,
    enableFocusRestore,
    disableFocusRestore,
    handleDialogKeyDown,
  } = useDialogFocus<HTMLDivElement, HTMLButtonElement>();
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
  const brokerModeLabel =
    productionReadiness?.connectors?.configured
      ? productionReadiness.connectors.mode
      : connectorCatalog?.brokerUrlConfigured
        ? `auth pending: ${(connectorCatalog.brokerMissingSecretNames ?? ["broker token"]).join(" or ")}`
        : productionReadiness?.connectors?.mode ?? connectorCatalog?.brokerMode ?? "policy-only";
  const brokerModeTone: BadgeTone = productionReadiness?.connectors?.configured
    ? "green"
    : connectorCatalog?.brokerUrlConfigured
      ? "red"
      : "amber";
  const authReady = Boolean(productionReadiness?.auth?.oidcConfigured);
  const vaultReady = Boolean(productionReadiness?.secretVault?.encrypted);
  const secretEvidence = productionReadiness?.secretEvidence;
  const secretEvidenceReady = secretEvidence
    ? secretEvidence.unsupportedSecretNames.length === 0 &&
      secretEvidence.invalidSecretCount === 0 &&
      (secretEvidence.tenantVaultNamesApplied || secretEvidence.configuredSecretCount === 0)
    : vaultReady;
  const databaseReady = Boolean(productionReadiness?.database?.durable);
  const auditReady = Boolean(productionReadiness?.operations?.auditIntegrity?.configured);
  const setupScore = Math.round(
    ([externalProviderReady, privacyReady, connectorProductionReady, authReady, vaultReady, databaseReady, auditReady].filter(Boolean).length / 7) * 100,
  );

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
  // Dirty if provider settings changed or connector secrets (incl. pasted API
  // keys / OIDC client secrets) are staged — guards against losing them to an
  // accidental backdrop/Escape dismiss.
  const isSettingsDirty =
    connectorSecretDraftCount > 0 || JSON.stringify(draft) !== JSON.stringify(settings);
  const connectorSecretSaveDisabledReason = savingConnectorSecrets
    ? "Connector secrets are being saved."
    : connectorSecretDraftCount
      ? ""
      : "Enter at least one connector secret value to enable saving.";
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
      helper: draft.defaultProvider === "local" ? "Good for demo mode and deterministic tests." : "This provider handles normal assistant and Skill work.",
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
        setActiveSection("models");
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
        setActiveSection("data");
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
      action: saveSettings,
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
  const navSections: {
    id: SettingsSection;
    label: string;
    helper: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    tone: BadgeTone;
    badge: string;
  }[] = [
    { id: "overview", label: "Overview", helper: "Launch map", icon: Gauge, tone: setupScore >= 70 ? "green" : "amber", badge: `${setupScore}%` },
    { id: "identity", label: "Identity & access", helper: "SSO, SCIM, roles", icon: Fingerprint, tone: authReady ? "green" : "amber", badge: authReady ? "Ready" : "Next" },
    { id: "apps", label: "Connected apps", helper: "Slack, Jira, HRIS", icon: Plug, tone: connectorProductionReady ? "green" : "amber", badge: `${connectorReadyCount}/${Math.max(connectorTotalCount, 1)}` },
    { id: "models", label: "AI Provider Settings", helper: "Keys and routing", icon: Sparkles, tone: externalProviderReady ? "green" : "amber", badge: externalProviderReady ? "Live" : "Local" },
    { id: "data", label: "Data & knowledge", helper: "Sources, retention", icon: Database, tone: privacyReady ? "green" : "amber", badge: privacyReady ? "Safe" : "Review" },
    { id: "security", label: "Security & risk", helper: "Vault, broker, DLP", icon: ShieldCheck, tone: vaultReady ? "green" : "amber", badge: vaultReady ? "Ready" : "Next" },
    { id: "workflows", label: "Notifications", helper: "Approvals, alerts", icon: Bell, tone: "blue", badge: "Ops" },
    { id: "usage", label: "Usage & billing", helper: "Budgets, owners", icon: CircleDollarSign, tone: draft.monthlyBudgetUsd > 0 ? "green" : "amber", badge: `$${Math.round(draft.monthlyBudgetUsd / 1000)}k` },
    { id: "audit", label: "Audit & export", helper: "Evidence, backups", icon: FileClock, tone: auditReady ? "green" : "amber", badge: auditReady ? "Signed" : "Draft" },
  ];
  const activeNav = navSections.find((section) => section.id === activeSection) ?? navSections[0];
  const ActiveIcon = activeNav.icon;

  function update<K extends keyof AIProviderSettings>(key: K, value: AIProviderSettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateEnterprise<K extends keyof EnterpriseDraft>(key: K, value: EnterpriseDraft[K]) {
    setEnterpriseDraft((current) => ({ ...current, [key]: value }));
  }

  function selectSection(section: SettingsSection) {
    setActiveSection(section);
    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
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

  function closeSettings() {
    if (isSettingsDirty && typeof window !== "undefined" && !window.confirm("Discard unsaved AI settings? Pasted secrets and changes won't be saved.")) {
      return;
    }
    enableFocusRestore();
    onClose();
  }

  function saveSettings() {
    enableFocusRestore();
    void onSave(draft);
  }

  function openConnectorsFromSettings() {
    disableFocusRestore();
    onOpenConnectors();
  }

  function handleSettingsKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (handleDialogKeyDown(event)) return;
    if (event.key === "Escape") closeSettings();
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

  async function removeUnsupportedTenantSecrets() {
    const names = secretEvidence?.unsupportedSecretNames ?? [];
    if (!names.length) return;
    if (typeof window !== "undefined" && !window.confirm(`Remove ${names.length} unsupported tenant vault secret${names.length === 1 ? "" : "s"}? Secret values will not be recoverable.`)) {
      return;
    }
    setDeletingTenantSecrets(true);
    try {
      await onDeleteTenantSecrets(names);
    } finally {
      setDeletingTenantSecrets(false);
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

  const overviewSection = (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Enterprise setup" value={`${setupScore}%`} helper="Identity, models, connectors, evidence, and operations readiness." tone={setupScore >= 70 ? "green" : "amber"} />
        <StatTile label="Model routing" value={externalProviderReady ? "Real model" : "Local mode"} helper={`${readyProviderCount}/${providerStatusRows.length} providers available now or after save.`} tone={externalProviderReady ? "green" : "amber"} />
        <StatTile label="Connected apps" value={`${connectorReadyCount}/${Math.max(connectorTotalCount, 1)} ready`} helper="Required collaboration, work tracking, knowledge, and HR connections." tone={connectorProductionReady ? "green" : "amber"} />
        <StatTile label="Evidence posture" value={auditReady ? "Signed" : "Draft"} helper="Launch records, review packets, traces, and export controls." tone={auditReady ? "green" : "amber"} />
      </div>

      <SettingCard
        title="Enterprise launch map"
        helper="A high-level map for the people who need to connect this workspace to the rest of the company."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Workspace profile", value: `${enterpriseDraft.workspaceName} - ${enterpriseDraft.environment}`, tone: "green" as BadgeTone },
            { label: "Identity provider", value: authReady ? "OIDC configured" : "Add OIDC issuer and SCIM token", tone: authReady ? "green" as BadgeTone : "amber" as BadgeTone },
            { label: "Tenant vault", value: vaultReady ? "Encrypted server vault" : "Configure vault encryption key", tone: vaultReady ? "green" as BadgeTone : "amber" as BadgeTone },
            { label: "Database", value: databaseReady ? "Durable store configured" : "Local or demo persistence", tone: databaseReady ? "green" as BadgeTone : "amber" as BadgeTone },
            { label: "Broker policy", value: brokerModeLabel, tone: brokerModeTone },
            { label: "Evidence export", value: enterpriseDraft.exportReview, tone: auditReady ? "green" as BadgeTone : "amber" as BadgeTone },
          ].map((item) => (
            <StatusRow key={item.label} label={item.label} value={item.value} tone={item.tone} />
          ))}
        </div>
      </SettingCard>

      <SettingCard title="Workspace profile" helper="The basics an enterprise admin expects to see before teams begin sending work through the OS.">
        <InputGrid>
          <Field label="Workspace name">
            <input className="input" value={enterpriseDraft.workspaceName} onChange={(event) => updateEnterprise("workspaceName", event.target.value)} />
          </Field>
          <Field label="Primary company domain">
            <input className="input" value={enterpriseDraft.primaryDomain} onChange={(event) => updateEnterprise("primaryDomain", event.target.value)} />
          </Field>
          <SelectField
            label="Environment"
            value={enterpriseDraft.environment}
            options={["Production", "Pilot", "Sandbox", "Staging"]}
            onChange={(value) => updateEnterprise("environment", value)}
          />
          <SelectField
            label="Data region"
            value={enterpriseDraft.region}
            options={["United States", "European Union", "United Kingdom", "Canada", "Australia"]}
            onChange={(value) => updateEnterprise("region", value)}
          />
          <Field label="Risk owner">
            <input className="input" value={enterpriseDraft.riskOwner} onChange={(event) => updateEnterprise("riskOwner", event.target.value)} />
          </Field>
          <Field label="Admin contact">
            <input className="input" value={enterpriseDraft.incidentEmail} onChange={(event) => updateEnterprise("incidentEmail", event.target.value)} />
          </Field>
        </InputGrid>
      </SettingCard>
    </div>
  );

  const identitySection = (
    <div className="space-y-5">
      <SettingCard title="Identity and access" helper="Connect the company identity provider, provision users automatically, and set practical defaults for mixed technical and business teams.">
        <InputGrid>
          <Field label="OIDC issuer URL">
            <input className="input font-mono text-xs" value={enterpriseDraft.ssoIssuer} onChange={(event) => updateEnterprise("ssoIssuer", event.target.value)} />
          </Field>
          <Field label="OIDC client ID">
            <input className="input font-mono text-xs" value={enterpriseDraft.oidcClientId} onChange={(event) => updateEnterprise("oidcClientId", event.target.value)} />
          </Field>
          <SecretField
            label="OIDC client secret"
            value={enterpriseDraft.oidcClientSecret}
            onChange={(value) => updateEnterprise("oidcClientSecret", value)}
            serverConfigured={authReady}
          />
          <Field label="SCIM endpoint">
            <input className="input font-mono text-xs" value={enterpriseDraft.scimEndpoint} onChange={(event) => updateEnterprise("scimEndpoint", event.target.value)} />
          </Field>
          <SecretField
            label="SCIM bearer token"
            value={enterpriseDraft.scimBearerToken}
            onChange={(value) => updateEnterprise("scimBearerToken", value)}
            serverConfigured={Boolean(productionReadiness?.userProvisioning?.configured)}
          />
          <SelectField
            label="Default member role"
            value={enterpriseDraft.defaultRole}
            options={["Viewer", "Contributor", "Builder", "Approver", "Admin"]}
            onChange={(value) => updateEnterprise("defaultRole", value)}
          />
          <Field label="Session timeout hours">
            <input
              className="input"
              type="number"
              value={enterpriseDraft.sessionTimeoutHours}
              onChange={(event) => updateEnterprise("sessionTimeoutHours", Number(event.target.value))}
            />
          </Field>
        </InputGrid>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <CheckRow checked={enterpriseDraft.requireMfa} label="Require MFA for admins and approvers" onChange={() => updateEnterprise("requireMfa", !enterpriseDraft.requireMfa)} />
          <CheckRow checked={!enterpriseDraft.allowLocalLogin} label="Disable local login in production" onChange={() => updateEnterprise("allowLocalLogin", !enterpriseDraft.allowLocalLogin)} />
          <StatusRow
            label="SCIM provisioning"
            value={productionReadiness?.userProvisioning?.configured ? "Sync ready" : "Configure environment"}
            tone={productionReadiness?.userProvisioning?.configured ? "green" : "amber"}
          />
        </div>
      </SettingCard>

      <SettingCard title="Role policy" helper="A lightweight policy map so non-admins understand what each persona can do.">
        <div className="grid gap-3 lg:grid-cols-2">
          {[
            ["Workspace Admin", "Manage providers, connectors, billing, users, evidence exports, and launch gates."],
            ["AI Builder", "Create Skills, workflows, context tests, and eval suites inside approved boundaries."],
            ["Risk Approver", "Approve use cases, review traces, request changes, and sign launch evidence."],
            ["Business Contributor", "Submit use cases, read reports, and collaborate on value evidence."],
          ].map(([role, helper]) => (
            <div key={role} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div className="font-semibold text-[var(--text)]">{role}</div>
              <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{helper}</div>
            </div>
          ))}
        </div>
      </SettingCard>
    </div>
  );

  const appsSection = (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--border)]/70 bg-[var(--primary-soft)]/42 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={connectorProductionReady ? "green" : connectorReadyCount ? "amber" : "red"}>
                    {connectorProductionReady ? "production-ready apps" : "apps need setup"}
                  </Badge>
                  <Badge tone={brokerModeTone}>
                    {brokerModeLabel}
                  </Badge>
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-[var(--text)]">
                  {nextConnector ? `Connect ${nextConnector.label}` : "Connect the first company app"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                  {nextConnector?.nextActivationAction ??
                    "Choose Slack, Jira, ServiceNow, Microsoft 365, SharePoint, Workday, or Google Workspace and capture readiness evidence."}
                </p>
              </div>
              <Button className="shrink-0 whitespace-nowrap" onClick={openConnectorsFromSettings} data-testid="open-connect-apps-from-settings">
                <Network size={15} />
                Open Connect Apps
              </Button>
            </div>
          </div>
          <div className="grid gap-px bg-[var(--border)]/70 md:grid-cols-4">
            {categoryRows.map((category) => {
              const CategoryIcon = category.icon;

              return (
                <button
                  key={category.id}
                  type="button"
                  className="grid min-h-[112px] grid-cols-[32px_minmax(0,1fr)] gap-3 bg-[var(--surface)] p-4 text-left transition hover:bg-[var(--surface-muted)]"
                  onClick={openConnectorsFromSettings}
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-lg ${
                      category.status === "ready"
                        ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_24%,var(--border))]"
                        : category.status === "partial"
                          ? "bg-[var(--warning-soft)] text-[var(--warning)] ring-1 ring-[color-mix(in_srgb,var(--warning)_26%,var(--border))]"
                          : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                    }`}
                  >
                    <CategoryIcon size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                      {category.ready}/{category.count || 1}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-[var(--text)]">{category.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
                      {category.count ? (category.status === "ready" ? "Ready for governed work" : "Needs connector setup") : "Not in current catalog"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        {nextConnector ? (
          <SettingCard
            title="Tenant vault"
            helper={`${nextConnector.label} secrets are encrypted server-side and never returned to the browser.`}
            action={
              <div className="flex flex-col items-end gap-1">
                <Button
                  disabled={!connectorSecretDraftCount || savingConnectorSecrets}
                  onClick={() => void saveConnectorSecretDraft()}
                  aria-describedby={connectorSecretSaveDisabledReason ? "connector-secret-save-disabled-reason" : undefined}
                  title={connectorSecretSaveDisabledReason || undefined}
                  data-testid="save-connector-secrets"
                >
                  <KeyRound size={15} />
                  {savingConnectorSecrets ? "Saving" : connectorSecretDraftCount ? `Save ${connectorSecretDraftCount}` : "Save secrets"}
                </Button>
                {connectorSecretSaveDisabledReason ? (
                  <span id="connector-secret-save-disabled-reason" className="max-w-[220px] text-right text-[11px] leading-4 text-[var(--text-muted)]">
                    {connectorSecretSaveDisabledReason}
                  </span>
                ) : null}
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
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
                      secret.configured ? "text-[var(--success)]" : secret.required ? "text-[var(--warning)]" : "text-[var(--text-muted)]"
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
                <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--text-muted)] md:col-span-2">
                  {nextConnector.label} does not require tenant-managed secrets. Use Connect Apps to finish scopes and activation evidence.
                </div>
              ) : null}
            </div>
          </SettingCard>
        ) : null}

        <SettingCard
          title="Company app connections"
          helper="Connect the systems where employees already ask, search, approve, and track work."
          action={
            <Button variant="secondary" onClick={openConnectorsFromSettings}>
              <Plug size={15} />
              Manage catalog
            </Button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {connectorRows.map((connector) => (
              <button
                key={connector.id}
                type="button"
                className="flex min-h-[128px] flex-col justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:-translate-y-px hover:border-[var(--primary)]/24 hover:bg-[var(--surface-muted)]"
                onClick={openConnectorsFromSettings}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--text)]">{connector.label}</span>
                    <span className="mt-1 block truncate text-xs font-medium text-[var(--text-muted)]">{connector.system}</span>
                  </span>
                  <Badge tone={connectorTone(connector.status)}>{connectorLabel(connector.status)}</Badge>
                </span>
                <span className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{connector.productionUse}</span>
                <span className="mt-3 flex flex-wrap gap-1.5">
                  {connector.missingSecrets.length ? (
                    <Badge tone="amber">
                      {connector.missingSecrets.length} secret{connector.missingSecrets.length === 1 ? "" : "s"}
                    </Badge>
                  ) : (
                    <Badge tone="green">secrets ready</Badge>
                  )}
                  <Badge tone="slate">{connector.requiredScopes.length} scopes</Badge>
                </span>
              </button>
            ))}
            {!connectorRows.length ? (
              <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-muted)] md:col-span-2">
                Connector readiness has not loaded yet. Open Connect Apps to refresh the catalog and readiness gates.
              </div>
            ) : null}
          </div>
        </SettingCard>
      </div>

      <div className="space-y-4">
        <Panel className="p-4">
          <SectionTitle title="App readiness" helper="The implementation checks a customer admin needs before launch." />
          <div className="mt-4 space-y-3">
            <StatusRow label="Connected apps" value={`${connectorReadyCount}/${Math.max(connectorTotalCount, 1)} ready`} tone={connectorProductionReady ? "green" : "amber"} />
            <StatusRow label="Tenant secrets" value={connectorMissingSecretCount ? `${connectorMissingSecretCount} missing` : "Ready"} tone={connectorMissingSecretCount ? "amber" : "green"} />
            <StatusRow label="Broker mode" value={brokerModeLabel} tone={brokerModeTone} />
          </div>
        </Panel>
        <Panel className="p-4">
          <SectionTitle title="Production pattern" />
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
            <div className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-[var(--success)]" size={15} /> Least-privilege scopes before any write action.</div>
            <div className="flex gap-2"><Route className="mt-0.5 shrink-0 text-[var(--success)]" size={15} /> Broker policy separates model intent from execution.</div>
            <div className="flex gap-2"><Database className="mt-0.5 shrink-0 text-[var(--primary)]" size={15} /> Evidence records approval, redaction, and external response metadata.</div>
          </div>
        </Panel>
      </div>
    </div>
  );

  const modelsSection = (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Panel className="overflow-hidden" data-testid="model-readiness-path">
          <div className="border-b border-[var(--border)]/70 bg-[var(--primary-soft)]/42 p-5">
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
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-[var(--text)]">AI Provider Settings</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                  {nextModelStep.title}. {nextModelStep.helper}
                </p>
              </div>
              <Button className="shrink-0 whitespace-nowrap" onClick={nextModelStep.action} data-testid="model-next-action">
                <NextModelIcon size={15} />
                {nextModelStep.actionLabel}
              </Button>
            </div>
          </div>
          <div className="grid gap-px bg-[var(--border)]/70 md:grid-cols-4">
            {modelSetupPath.map((item, index) => {
              const ItemIcon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="grid min-h-[112px] grid-cols-[32px_minmax(0,1fr)] gap-3 bg-[var(--surface)] p-4 text-left transition hover:bg-[var(--surface-muted)]"
                  data-testid={`model-path-step-${index + 1}`}
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-lg ${
                      item.ready ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_24%,var(--border))]" : "bg-[var(--primary-soft)] text-[var(--primary)]"
                    }`}
                  >
                    {item.ready ? <CheckCircle2 size={15} /> : <ItemIcon size={15} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{item.label}</span>
                    <span className="mt-1 block text-sm font-semibold text-[var(--text)]">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{item.helper}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        <SettingCard
          title="Basic setup"
          helper="Most teams only need these choices plus one provider key. Leave routing details alone until a team asks for them."
          action={
            <Button variant="secondary" onClick={useRecommendedDefaults}>
              <Sparkles size={15} />
              Use defaults
            </Button>
          }
        >
          <InputGrid>
            <Field label="Main model provider">
              <select className="input" value={draft.defaultProvider} onChange={(event) => update("defaultProvider", event.target.value)}>
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
              <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">The provider used for normal assistant and Skill work.</div>
            </Field>
            <Field label="Default model">
              <input className="input font-mono text-xs" value={draft.defaultModel} onChange={(event) => update("defaultModel", event.target.value)} />
            </Field>
            <Field label="Monthly budget guardrail">
              <input
                className="input"
                type="number"
                min={0}
                step={100}
                value={draft.monthlyBudgetUsd}
                onChange={(event) => update("monthlyBudgetUsd", Number(event.target.value))}
              />
              <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Used for cost warnings and launch readiness checks.</div>
            </Field>
          </InputGrid>
        </SettingCard>

        <SettingCard id="provider-keys-section" title="Provider keys" helper="Add keys only for providers you intend to use. Saved keys move to the server vault after save.">
          {!externalProviderReady ? (
            <div className="mb-4 rounded-lg border border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] px-3 py-2 text-sm leading-6 text-[var(--warning)]">
              Add one approved provider key to run realistic Skill tests. Choose the model vendor your company already allows.
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SecretField label="OpenAI API Key" value={draft.openaiKey} serverConfigured={vaultById.get("openai")?.configured} onChange={(value) => update("openaiKey", value)} />
            <SecretField label="OpenRouter API Key" value={draft.openrouterKey} serverConfigured={vaultById.get("openrouter")?.configured} onChange={(value) => update("openrouterKey", value)} />
            <SecretField label="Anthropic API Key" value={draft.anthropicKey} serverConfigured={vaultById.get("anthropic")?.configured} onChange={(value) => update("anthropicKey", value)} />
            <SecretField label="Gemini / Google API Key" value={draft.googleKey} serverConfigured={vaultById.get("google")?.configured} onChange={(value) => update("googleKey", value)} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SecretField label="Azure OpenAI Key" value={draft.azureKey} serverConfigured={vaultById.get("azure_openai")?.configured} onChange={(value) => update("azureKey", value)} />
            <Field label="Azure Endpoint">
              <input className="input font-mono text-xs" placeholder="https://your-resource.openai.azure.com" value={draft.azureEndpoint} onChange={(event) => update("azureEndpoint", event.target.value)} />
            </Field>
            <SecretField label="Kimi / Moonshot API Key" value={draft.kimiKey} serverConfigured={vaultById.get("kimi")?.configured} onChange={(value) => update("kimiKey", value)} />
            <Field label="Kimi Base URL">
              <input className="input font-mono text-xs" value={draft.kimiBaseUrl} onChange={(event) => update("kimiBaseUrl", event.target.value)} />
            </Field>
            <SecretField label="GLM / Z.AI API Key" value={draft.glmKey} serverConfigured={vaultById.get("glm")?.configured} onChange={(value) => update("glmKey", value)} />
            <Field label="GLM / Z.AI Base URL">
              <input className="input font-mono text-xs" value={draft.glmBaseUrl} onChange={(event) => update("glmBaseUrl", event.target.value)} />
            </Field>
            <SecretField label="DeepSeek API Key" value={draft.deepseekKey} serverConfigured={vaultById.get("deepseek")?.configured} onChange={(value) => update("deepseekKey", value)} />
            <Field label="DeepSeek Base URL">
              <input className="input font-mono text-xs" value={draft.deepseekBaseUrl} onChange={(event) => update("deepseekBaseUrl", event.target.value)} />
            </Field>
            <Field label="OpenAI Base URL">
              <input className="input font-mono text-xs" value={draft.openaiBaseUrl} onChange={(event) => update("openaiBaseUrl", event.target.value)} />
            </Field>
            <Field label="Anthropic Base URL">
              <input className="input font-mono text-xs" value={draft.anthropicBaseUrl} onChange={(event) => update("anthropicBaseUrl", event.target.value)} />
            </Field>
            <Field label="Gemini / Google Base URL">
              <input className="input font-mono text-xs" value={draft.googleBaseUrl} onChange={(event) => update("googleBaseUrl", event.target.value)} />
            </Field>
            <Field label="OpenRouter Base URL">
              <input className="input font-mono text-xs" value={draft.openrouterBaseUrl} onChange={(event) => update("openrouterBaseUrl", event.target.value)} />
            </Field>
          </div>
        </SettingCard>

        <SettingCard title="Advanced model routing" helper="Assign different models to scoring, summaries, governance, workflows, evals, and fallback.">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Cheap or bulk model">
              <input className="input font-mono text-xs" value={draft.cheapModel} onChange={(event) => update("cheapModel", event.target.value)} />
            </Field>
            <Field label="Reasoning model">
              <input className="input font-mono text-xs" value={draft.reasoningModel} onChange={(event) => update("reasoningModel", event.target.value)} />
            </Field>
            <Field label="Fallback model">
              <input className="input font-mono text-xs" value={draft.fallbackModel} onChange={(event) => update("fallbackModel", event.target.value)} />
            </Field>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {routingRows.map((row) => (
              <Field key={row.key} label={row.label}>
                <input className="input font-mono text-xs" value={draft[row.key]} onChange={(event) => update(row.key, event.target.value)} />
                <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{row.helper}</div>
              </Field>
            ))}
          </div>
        </SettingCard>
      </div>

      <div className="space-y-4">
        <Panel className="p-4">
          <SectionTitle title="Setup health" helper="The launch-critical checks, without provider noise." />
          <div className="mt-4 space-y-3">
            {readinessRows.map((row) => (
              <StatusRow key={row.label} label={row.label} value={row.value} tone={row.ready ? "green" : "amber"} />
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)] px-3 py-3">
            <div className="flex items-start gap-2 text-sm leading-6 text-[var(--text-muted)]">
              <CircleDollarSign className="mt-0.5 shrink-0 text-[var(--success)]" size={15} />
              <span>
                Budget guardrail: <strong className="text-[var(--text)]">${draft.monthlyBudgetUsd.toLocaleString()}</strong> per month.
              </span>
            </div>
          </div>
        </Panel>
        <Panel className="p-4">
          <SectionTitle title="Provider vault detail" helper={`${readyProviderCount}/${providerStatusRows.length} providers available now or after save.`} />
          <div className="mt-4 space-y-2">
            {providerStatusRows.map((provider) => {
              const serverReady = vaultById.get(provider.id)?.configured;
              const configured = provider.configured || serverReady;

              return (
                <div key={provider.id} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{provider.name}</span>
                    <Badge tone={configured ? "green" : "slate"}>{configured ? "Ready" : "Needs key"}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {serverReady ? "server vault" : provider.configured ? "ready after save" : "not configured"}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );

  const dataSection = (
    <div className="space-y-5">
      <SettingCard id="evidence-logging-section" title="Data and knowledge" helper="Set how enterprise context is indexed, refreshed, redacted, and retained.">
        <InputGrid>
          <SelectField
            label="Knowledge refresh"
            value={enterpriseDraft.knowledgeRefresh}
            options={["Hourly", "Every 6 hours", "Daily", "Weekly", "Manual approval"]}
            onChange={(value) => updateEnterprise("knowledgeRefresh", value)}
          />
          <SelectField
            label="Context index mode"
            value={enterpriseDraft.contextIndexMode}
            options={["Keyword only", "Hybrid search plus citations", "Vector search with governance labels", "Private semantic index"]}
            onChange={(value) => updateEnterprise("contextIndexMode", value)}
          />
          <SelectField
            label="Data residency"
            value={enterpriseDraft.dataResidency}
            options={["United States", "European Union", "United Kingdom", "Canada", "Australia"]}
            onChange={(value) => updateEnterprise("dataResidency", value)}
          />
          <Field label="Retention days">
            <input
              className="input"
              type="number"
              value={enterpriseDraft.retentionDays}
              onChange={(event) => updateEnterprise("retentionDays", Number(event.target.value))}
            />
          </Field>
        </InputGrid>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CheckRow checked={draft.piiRedaction} label="PII redaction" onChange={() => update("piiRedaction", !draft.piiRedaction)} />
          <CheckRow checked={draft.storePrompts} label="Store prompts for evidence" onChange={() => update("storePrompts", !draft.storePrompts)} />
          <CheckRow checked={draft.storeToolPayloads} label="Store tool payloads" onChange={() => update("storeToolPayloads", !draft.storeToolPayloads)} />
          <CheckRow checked={enterpriseDraft.requireDlp} label="Require DLP before indexing" onChange={() => updateEnterprise("requireDlp", !enterpriseDraft.requireDlp)} />
        </div>
      </SettingCard>

      <SettingCard title="Knowledge source controls" helper="Controls a company would expect before connecting SharePoint, Drive, Confluence, Slack, and ticket systems.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["Source allowlist", "Only approved repositories and channels are indexed."],
            ["Citations required", "Assistant answers and Skill runs must keep source references."],
            ["Sensitive label sync", "DLP labels, document ACLs, and retention classes are preserved."],
            ["Retrieval evaluation", `Safe retrieval tests run ${enterpriseDraft.evalCadence.toLowerCase()}.`],
            ["Stale content policy", "Content older than retention policy is excluded from new evidence."],
            ["Owner attestation", "Source owners confirm business purpose before indexing."],
          ].map(([title, helper]) => (
            <div key={title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div className="font-semibold text-[var(--text)]">{title}</div>
              <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{helper}</div>
            </div>
          ))}
        </div>
      </SettingCard>
    </div>
  );

  const securitySection = (
    <div className="space-y-5">
      <SettingCard title="Security and compliance" helper="Policy controls for tool execution, secrets, audit trails, and review gates.">
        <InputGrid>
          <SelectField
            label="Approval mode"
            value={enterpriseDraft.approvalMode}
            options={["Risk-based approvals", "All writes require approval", "High-risk only", "Observe only"]}
            onChange={(value) => updateEnterprise("approvalMode", value)}
          />
          <SelectField
            label="API protection"
            value={enterpriseDraft.apiProtection}
            options={["Signed admin and runtime requests", "Admin token only", "Network allowlist", "Local development"]}
            onChange={(value) => updateEnterprise("apiProtection", value)}
          />
          <Field label="Risk owner">
            <input className="input" value={enterpriseDraft.riskOwner} onChange={(event) => updateEnterprise("riskOwner", event.target.value)} />
          </Field>
        </InputGrid>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CheckRow checked={enterpriseDraft.auditSigning} label="Sign audit events" onChange={() => updateEnterprise("auditSigning", !enterpriseDraft.auditSigning)} />
          <StatusRow
            label="Secret vault"
            value={vaultReady ? "Encrypted" : "Configure tenant key"}
            tone={vaultReady ? "green" : "amber"}
          />
          <StatusRow
            label="API credential salting"
            value={productionReadiness?.apiProtection?.salted ? "Salted" : "Configure API salt"}
            tone={productionReadiness?.apiProtection?.salted ? "green" : "amber"}
          />
          <CheckRow checked={enterpriseDraft.requireDlp} label="Require DLP review" onChange={() => updateEnterprise("requireDlp", !enterpriseDraft.requireDlp)} />
        </div>
      </SettingCard>

      <SettingCard title="Control plane status" helper="The backend readiness signals that matter before a production customer launch.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatusRow label="Secret vault" value={productionReadiness?.secretVault?.mode ?? "Not reported"} tone={vaultReady ? "green" : "amber"} />
          <StatusRow
            label="Secret evidence"
            value={
              secretEvidence
                ? secretEvidence.unsupportedSecretNames.length
                  ? `${secretEvidence.unsupportedSecretNames.length} unsupported`
                  : secretEvidence.invalidSecretCount
                    ? `${secretEvidence.invalidSecretCount} invalid value${secretEvidence.invalidSecretCount === 1 ? "" : "s"}`
                    : secretEvidence.tenantVaultNamesApplied
                      ? `${secretEvidence.decryptableSecretCount}/${secretEvidence.configuredSecretCount} verified`
                      : secretEvidence.readable
                        ? `${secretEvidence.undecryptableSecretCount}/${secretEvidence.configuredSecretCount} need rotation`
                        : "Lookup unavailable"
                : "Not reported"
            }
            tone={secretEvidence?.unsupportedSecretNames.length || secretEvidence?.invalidSecretCount ? "red" : secretEvidenceReady ? "green" : "amber"}
          />
          <StatusRow label="API protection" value={productionReadiness?.apiProtection?.mode ?? "Not reported"} tone={productionReadiness?.apiProtection?.configured ? "green" : "amber"} />
          <StatusRow label="Database" value={productionReadiness?.database?.mode ?? "Not reported"} tone={databaseReady ? "green" : "amber"} />
          <StatusRow label="Workflow engine" value={productionReadiness?.workflows?.mode ?? "Not reported"} tone={productionReadiness?.workflows?.configured ? "green" : "amber"} />
          <StatusRow label="Trace store" value={productionReadiness?.operations?.traceStore?.mode ?? "Not reported"} tone={productionReadiness?.operations?.traceStore?.configured ? "green" : "amber"} />
          <StatusRow label="Audit integrity" value={productionReadiness?.operations?.auditIntegrity?.mode ?? "Not reported"} tone={auditReady ? "green" : "amber"} />
        </div>
        {secretEvidence?.invalidSecretCount ? (
          <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--danger)_24%,var(--border))] bg-[var(--danger-soft)] p-4">
            <div className="text-sm font-semibold text-[var(--danger)]">Invalid tenant vault values detected</div>
            <div className="mt-1 text-xs leading-5 text-[var(--danger)]">
              {secretEvidence.invalidSecretNames.join(", ")} {secretEvidence.invalidSecretCount === 1 ? "has" : "have"} a value that does not match the required runtime format. Correct or rotate the value before trusting readiness.
            </div>
          </div>
        ) : null}
        {secretEvidence?.unsupportedSecretNames.length ? (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--danger)_24%,var(--border))] bg-[var(--danger-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--danger)]">Unsupported tenant vault secrets detected</div>
              <div className="mt-1 text-xs leading-5 text-[var(--danger)]">
                {secretEvidence.unsupportedSecretNames.join(", ")} {secretEvidence.unsupportedSecretNames.length === 1 ? "is" : "are"} not in the provider, connector, or control-plane catalog.
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void removeUnsupportedTenantSecrets()}
              disabled={deletingTenantSecrets}
            >
              {deletingTenantSecrets ? "Removing..." : "Remove unsupported"}
            </Button>
          </div>
        ) : null}
      </SettingCard>
    </div>
  );

  const workflowsSection = (
    <div className="space-y-5">
      <SettingCard title="Notifications and workflow operations" helper="Route approvals, escalations, launch notices, and eval failures to the teams who own them.">
        <InputGrid>
          <Field label="Operations notification channel">
            <input className="input" value={enterpriseDraft.slackChannel} onChange={(event) => updateEnterprise("slackChannel", event.target.value)} />
          </Field>
          <Field label="Incident email">
            <input className="input" value={enterpriseDraft.incidentEmail} onChange={(event) => updateEnterprise("incidentEmail", event.target.value)} />
          </Field>
          <Field label="Approval SLA hours">
            <input
              className="input"
              type="number"
              value={enterpriseDraft.approvalSlaHours}
              onChange={(event) => updateEnterprise("approvalSlaHours", Number(event.target.value))}
            />
          </Field>
          <SelectField
            label="Eval cadence"
            value={enterpriseDraft.evalCadence}
            options={["On demand", "Daily", "Weekly", "Before each launch", "Continuous"]}
            onChange={(value) => updateEnterprise("evalCadence", value)}
          />
        </InputGrid>
      </SettingCard>

      <SettingCard title="Routing rules" helper="Default notification rules for launches, approvals, incidents, and weekly executive reporting.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: MessageSquare, title: "Collaboration", helper: `${enterpriseDraft.slackChannel} receives launch and eval updates.` },
            { icon: Mail, title: "Incident mailbox", helper: `${enterpriseDraft.incidentEmail} receives failed gate alerts.` },
            { icon: Webhook, title: "Webhook broker", helper: "Runtime tool approvals are routed through the connector broker." },
            { icon: ClipboardCheck, title: "Approval queue", helper: `${enterpriseDraft.approvalSlaHours} hour SLA for pending decisions.` },
          ].map((item) => {
            const ItemIcon = item.icon;
            return (
              <div key={item.title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-[var(--text-muted)]">
                  <ItemIcon size={16} />
                </div>
                <div className="mt-3 font-semibold text-[var(--text)]">{item.title}</div>
                <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{item.helper}</div>
              </div>
            );
          })}
        </div>
      </SettingCard>
    </div>
  );

  const usageSection = (
    <div className="space-y-5">
      <SettingCard title="Usage and billing" helper="Make model spend understandable for Finance, platform teams, and executive sponsors.">
        <InputGrid>
          <Field label="Monthly budget guardrail">
            <input
              className="input"
              type="number"
              min={0}
              step={100}
              value={draft.monthlyBudgetUsd}
              onChange={(event) => update("monthlyBudgetUsd", Number(event.target.value))}
            />
          </Field>
          <Field label="Cost center">
            <input className="input" value={enterpriseDraft.costCenter} onChange={(event) => updateEnterprise("costCenter", event.target.value)} />
          </Field>
          <Field label="Invoice owner">
            <input className="input" value={enterpriseDraft.invoiceOwner} onChange={(event) => updateEnterprise("invoiceOwner", event.target.value)} />
          </Field>
          <Field label="Alert threshold percent">
            <input
              className="input"
              type="number"
              value={enterpriseDraft.alertThreshold}
              onChange={(event) => updateEnterprise("alertThreshold", Number(event.target.value))}
            />
          </Field>
        </InputGrid>
      </SettingCard>

      <SettingCard title="Spend guardrails" helper="Controls that keep experimentation moving without surprising the teams paying for it.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatusRow label="Monthly budget" value={`$${draft.monthlyBudgetUsd.toLocaleString()}`} tone={draft.monthlyBudgetUsd > 0 ? "green" : "amber"} />
          <StatusRow label="Alert threshold" value={`${enterpriseDraft.alertThreshold}%`} tone="blue" />
          <StatusRow label="Cost allocation" value={enterpriseDraft.costCenter} tone="green" />
          <StatusRow label="Default provider" value={defaultProviderName} tone={externalProviderReady ? "green" : "amber"} />
          <StatusRow label="Bulk lane" value={draft.cheapModel} tone="blue" />
          <StatusRow label="Fallback lane" value={draft.fallbackModel} tone="blue" />
        </div>
      </SettingCard>
    </div>
  );

  const auditSection = (
    <div className="space-y-5">
      <SettingCard title="Audit and export" helper="Evidence retention, export approvals, immutable traces, backups, and migration posture.">
        <InputGrid>
          <Field label="Evidence retention years">
            <input
              className="input"
              type="number"
              value={enterpriseDraft.evidenceRetentionYears}
              onChange={(event) => updateEnterprise("evidenceRetentionYears", Number(event.target.value))}
            />
          </Field>
          <SelectField
            label="Backup cadence"
            value={enterpriseDraft.backupCadence}
            options={["Daily snapshots", "Hourly snapshots", "Weekly snapshots", "Customer-managed backup"]}
            onChange={(value) => updateEnterprise("backupCadence", value)}
          />
          <SelectField
            label="Export review"
            value={enterpriseDraft.exportReview}
            options={["Security review before external export", "Admin approval only", "Risk owner approval", "No external exports"]}
            onChange={(value) => updateEnterprise("exportReview", value)}
          />
        </InputGrid>
      </SettingCard>

      <SettingCard title="Operations readiness" helper="This is the part IT and security teams look for before letting a governed AI app go live.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatusRow label="Backups" value={productionReadiness?.operations?.backup?.mode ?? enterpriseDraft.backupCadence} tone={productionReadiness?.operations?.backup?.configured ? "green" : "amber"} />
          <StatusRow label="Migrations" value={productionReadiness?.operations?.migrations?.mode ?? "Not reported"} tone={productionReadiness?.operations?.migrations?.configured ? "green" : "amber"} />
          <StatusRow label="Trace store" value={productionReadiness?.operations?.traceStore?.mode ?? "Not reported"} tone={productionReadiness?.operations?.traceStore?.configured ? "green" : "amber"} />
          <StatusRow label="Eval runner" value={productionReadiness?.operations?.evalRunner?.mode ?? "Not reported"} tone={productionReadiness?.operations?.evalRunner?.configured ? "green" : "amber"} />
          <StatusRow label="Audit integrity" value={productionReadiness?.operations?.auditIntegrity?.mode ?? "Not reported"} tone={auditReady ? "green" : "amber"} />
          <StatusRow label="Retention" value={`${enterpriseDraft.evidenceRetentionYears} years`} tone="blue" />
        </div>
      </SettingCard>
    </div>
  );

  const sectionContent: Record<SettingsSection, React.ReactNode> = {
    overview: overviewSection,
    identity: identitySection,
    apps: appsSection,
    models: modelsSection,
    data: dataSection,
    security: securitySection,
    workflows: workflowsSection,
    usage: usageSection,
    audit: auditSection,
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/24 p-[1vh] backdrop-blur-sm" onMouseDown={closeSettings}>
      <div
        ref={dialogRef}
        id="company-setup-dialog"
        aria-describedby="company-setup-description"
        aria-labelledby="company-setup-title"
        aria-modal="true"
        className="mx-auto grid h-[98vh] w-[98vw] max-w-[1800px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[0_30px_90px_rgba(15,23,42,0.26)]"
        data-testid="company-setup-modal"
        onKeyDown={handleSettingsKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={setupScore >= 70 ? "green" : "amber"}>{setupScore}% configured</Badge>
                <Badge tone={connectorProductionReady ? "green" : connectorReadyCount ? "amber" : "red"}>
                  {connectorReadyCount}/{Math.max(connectorTotalCount, 1)} apps ready
                </Badge>
                <Badge tone={externalProviderReady ? "green" : "amber"}>
                  {externalProviderReady ? "model ready" : "local-only model"}
                </Badge>
              </div>
              <h2 id="company-setup-title" className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                Workspace Settings
              </h2>
              <div id="company-setup-description" className="mt-1 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
                Configure identity, model routing, tenant secrets, app connectors, data controls, approvals, evidence, usage, and launch operations from one enterprise admin console.
              </div>
            </div>
            <button
              aria-label="Close company setup"
              ref={initialFocusRef}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
              onClick={closeSettings}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 overflow-hidden bg-[var(--surface-muted)] lg:grid-cols-[292px_minmax(0,1fr)]">
          <aside className="relative flex min-h-0 flex-col overflow-hidden border-b border-[var(--border)] bg-[var(--surface)] p-3 lg:border-b-0 lg:border-r">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <Building2 size={17} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--text)]">{enterpriseDraft.workspaceName}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">{enterpriseDraft.environment} admin console</div>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${setupScore}%` }} />
              </div>
            </div>

            <div className="relative z-10 mt-3 h-[88px] shrink-0 snap-x overflow-x-auto overflow-y-hidden pb-1 lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink lg:snap-none lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:pb-2 lg:pr-1" data-testid="settings-sidebar-scroll">
              <nav className="flex gap-2 lg:block lg:space-y-1" aria-label="Workspace settings sections">
                {navSections.map((section) => {
                  const SectionIcon = section.icon;
                  const active = section.id === activeSection;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      className={`relative z-10 flex min-h-[76px] w-40 shrink-0 snap-start flex-col items-start gap-2 rounded-lg border px-3 py-2 text-left transition sm:w-48 lg:min-h-0 lg:w-full lg:flex-row lg:items-center lg:gap-2.5 ${
                        active
                          ? "border-[var(--primary)]/20 bg-[var(--primary-soft)] text-[var(--text)] ring-1 ring-[var(--primary)]/10"
                          : "border-[var(--border)] bg-[var(--surface)]/72 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] lg:border-transparent lg:bg-transparent"
                      }`}
                      data-testid={`company-setup-${section.id}-tab`}
                      onClick={() => selectSection(section.id)}
                    >
                      <span className="flex w-full items-center justify-between gap-2 lg:w-auto">
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}>
                          <SectionIcon size={16} />
                        </span>
                        <span className="lg:hidden">
                          <Badge tone={section.tone}>{section.badge}</Badge>
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-5 lg:truncate">{section.label}</span>
                        <span className="mt-0.5 hidden truncate text-xs text-[var(--text-muted)] lg:block">{section.helper}</span>
                      </span>
                      <span className="hidden lg:inline-flex">
                        <Badge tone={section.tone}>{section.badge}</Badge>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] p-2.5 text-[11px] leading-5 text-[var(--warning)]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                <span>Production readiness still depends on real environment values, SSO, database durability, and customer-approved connector scopes.</span>
              </div>
            </div>
          </aside>

          <main ref={mainScrollRef} className="min-h-0 overflow-y-auto scroll-smooth p-5 xl:p-6">
            <div className="mb-5 flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <ActiveIcon size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)]">{activeNav.label}</div>
                  <div className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                    {activeNav.id === "models"
                      ? "Connect model providers, store keys in the tenant vault, and route each AI workload to the right model lane."
                      : activeNav.id === "apps"
                        ? "Connect the company stack so AI work can read, route, approve, and prove work inside governed boundaries."
                        : activeNav.id === "identity"
                          ? "Prepare identity, access, provisioning, and role policy for an enterprise rollout."
                          : activeNav.id === "data"
                            ? "Control how company knowledge is indexed, retained, cited, redacted, and used as evidence."
                            : activeNav.id === "security"
                              ? "Review security controls, tenant vault posture, broker policy, and production control-plane signals."
                              : activeNav.id === "workflows"
                                ? "Route operational notifications, approvals, incidents, and eval schedules to the teams that own them."
                                : activeNav.id === "usage"
                                  ? "Set spending guardrails, cost ownership, and model usage defaults before teams scale."
                                  : activeNav.id === "audit"
                                    ? "Configure evidence retention, export review, backups, migrations, trace storage, and audit integrity."
                                    : "Review the whole workspace setup in a format an IT, security, and business owner can understand."}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {activeSection === "apps" ? (
                  <Button variant="secondary" onClick={openConnectorsFromSettings}>
                    <Network size={15} />
                    Connect Apps
                  </Button>
                ) : null}
                <Button onClick={saveSettings}>Save Settings</Button>
              </div>
            </div>

            {sectionContent[activeSection]}
          </main>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5"><LockKeyhole size={13} /> Tenant secrets stay server-side</span>
            <span className="hidden text-[var(--text-soft)] sm:inline">/</span>
            <span className="inline-flex items-center gap-1.5"><Cloud size={13} /> {productionReadiness?.database?.mode ?? "workspace persistence"} </span>
            <span className="hidden text-[var(--text-soft)] sm:inline">/</span>
            <span className="inline-flex items-center gap-1.5"><ReceiptText size={13} /> Evidence retention {enterpriseDraft.evidenceRetentionYears} years</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeSettings}>Cancel</Button>
            {activeSection === "apps" ? (
              <Button onClick={openConnectorsFromSettings}>
                <Network size={15} />
                Open Connect Apps
              </Button>
            ) : (
              <Button onClick={saveSettings}>
                <SlidersHorizontal size={15} />
                Save Settings
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
