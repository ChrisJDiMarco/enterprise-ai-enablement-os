import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  LockKeyhole,
  Rocket,
  Save,
  ShieldCheck,
  Settings,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/enterprise-ai-data";
import type { Department, User } from "@/lib/enterprise-ai-data";
import { hasProviderCredentials, providerLabel, type AIProviderSettings } from "@/lib/model-router";
import type { ProviderReadiness } from "@/lib/provider-registry";
import type { ProductionReadiness } from "@/lib/ui/types";
import type { EnterpriseMaturity, EnterpriseMaturityPillar } from "@/lib/enterprise-maturity";
import { openClawIntegration, openClawLaunchReadiness, openClawStatusTone } from "@/lib/openclaw-integration";
import type { PrimetimeGateItem, PrimetimeLaunchGate } from "@/lib/primetime-launch-gate";
import { deriveProductionLaunchSequence } from "@/lib/production-launch-sequence";
import { normalizeOrganizationSettings, type OrganizationSettings, type WorkspaceMode } from "@/lib/workspace-schema";
import { Badge, Button, Field, MiniMetric, Panel, SectionTitle } from "@/components/ui";
import { PageHeader } from "@/components/shell";

const roleOptions = [
  "admin",
  "ai_enablement_director",
  "ai_product_owner",
  "governance_reviewer",
  "security_reviewer",
  "legal_reviewer",
  "privacy_reviewer",
  "function_leader",
  "builder",
  "viewer",
];

const departmentOptions: Department[] = [
  "HR",
  "Finance",
  "Legal",
  "Procurement",
  "IT",
  "Marketing",
  "Operations",
  "Security",
  "Compliance",
  "Data",
  "Other",
];

function memberIdFromEmail(email: string) {
  return `user-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72)}`;
}

export function Admin({
  organization,
  workspaceMode,
  aiSettings,
  providerVault,
  providerVaultCheckedAt,
  users,
  productionReadiness,
  enterpriseMaturity,
  primetimeLaunchGate,
  onSaveOrganization,
  onUpsertUser,
  onRemoveUser,
  onOpenOnboarding,
  onOpenSettings,
  onExport,
  onImport,
  onLoadDemo,
  onWorkspaceModeChange,
  onSealLegacyAuditChain,
  onReset,
}: {
  organization: OrganizationSettings;
  workspaceMode: WorkspaceMode;
  aiSettings: AIProviderSettings;
  providerVault: ProviderReadiness[];
  providerVaultCheckedAt: string;
  users: User[];
  productionReadiness: ProductionReadiness | null;
  enterpriseMaturity: EnterpriseMaturity;
  primetimeLaunchGate: PrimetimeLaunchGate;
  onSaveOrganization: (settings: Partial<OrganizationSettings>) => void;
  onUpsertUser: (user: User) => void;
  onRemoveUser: (userId: string) => void;
  onOpenOnboarding: () => void;
  onOpenSettings: () => void;
  onExport: () => void;
  onImport: () => void;
  onLoadDemo: () => void;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  onSealLegacyAuditChain: () => Promise<void>;
  onReset: () => void;
}) {
  const [brandingDraft, setBrandingDraft] = useState(organization);
  const [launchChecklistCopied, setLaunchChecklistCopied] = useState(false);
  const [launchEnvCopied, setLaunchEnvCopied] = useState(false);
  const [roleClaimsCopied, setRoleClaimsCopied] = useState(false);
  const [activeAdminSection, setActiveAdminSection] = useState("openclaw");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDraft, setMemberDraft] = useState<User>({
    id: "",
    name: "",
    email: "",
    title: "",
    department: "Operations",
    role: "viewer",
  });
  const [auditMaintenanceStatus, setAuditMaintenanceStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const providerConfigured = hasProviderCredentials(aiSettings, aiSettings.defaultProvider);
  const activeProviderLabel = providerLabel(aiSettings.defaultProvider);
  const serverConfiguredProviders = providerVault.filter((provider) => provider.configured && provider.id !== "local");
  const missingServerProviders = providerVault.filter((provider) => !provider.configured && provider.id !== "local");
  const database = productionReadiness?.database;
  const auth = productionReadiness?.auth;
  const userProvisioning = productionReadiness?.userProvisioning;
  const apiProtection = productionReadiness?.apiProtection;
  const secretVault = productionReadiness?.secretVault;
  const connectors = productionReadiness?.connectors;
  const workflows = productionReadiness?.workflows;
  const operations = productionReadiness?.operations;
  const connectorCatalog = connectors?.catalog;
  const connectorEventSummary = connectors?.eventSummary;
  const harnessTraceSummary = productionReadiness?.harnessTraceSummary;
  const readinessCheckedAt = productionReadiness?.generatedAt
    ? new Date(productionReadiness.generatedAt).toLocaleTimeString()
    : providerVaultCheckedAt;
  const readinessStatus = productionReadiness?.status ?? "degraded";
  const readinessTone = readinessStatus === "ready" ? "green" : readinessStatus === "blocked" ? "red" : "amber";
  const blockers = productionReadiness?.blockers ?? [];
  const warnings = productionReadiness?.warnings ?? [];
  const manualActions = productionReadiness?.manualActions ?? [];
  const customerLaunchContract = productionReadiness?.customerLaunchContract;
  const launchSequence = deriveProductionLaunchSequence(productionReadiness);
  const maturityTone: Record<EnterpriseMaturityPillar["status"], "green" | "blue" | "amber" | "red"> = {
    elite: "green",
    strong: "blue",
    building: "amber",
    gap: "red",
  };
  const gateTone: Record<PrimetimeLaunchGate["status"], "green" | "amber" | "red"> = {
    ready: "green",
    "needs-work": "amber",
    blocked: "red",
  };
  const gateItemTone: Record<PrimetimeGateItem["status"], "green" | "amber" | "red"> = {
    pass: "green",
    warn: "amber",
    block: "red",
  };
  const connectorStatusTone: Record<string, "green" | "blue" | "amber" | "red"> = {
    ready: "green",
    "broker-managed": "blue",
    partial: "amber",
    missing: "red",
  };
  const launchSequenceTone: Record<string, "green" | "amber" | "red"> = {
    ready: "green",
    warning: "amber",
    blocker: "red",
  };
  const contractTone: Record<string, "green" | "amber" | "red"> = {
    ready: "green",
    "needs-work": "amber",
    blocked: "red",
  };
  const operationCards = [
    ["Backups", operations?.backup],
    ["Migrations", operations?.migrations],
    ["Trace Store", operations?.traceStore],
    ["Eval Runner", operations?.evalRunner],
    ["Audit Chain", operations?.auditIntegrity],
  ] as const;
  const roleCounts = users.reduce<Record<string, number>>((counts, user) => {
    counts[user.role] = (counts[user.role] ?? 0) + 1;
    return counts;
  }, {});
  const reviewerCount = users.filter((user) => user.role.includes("reviewer")).length;
  const builderCount = users.filter((user) =>
    ["admin", "ai_enablement_director", "ai_product_owner", "builder"].includes(user.role),
  ).length;
  const normalizedMemberSearch = memberSearch.trim().toLowerCase();
  const filteredUsers = normalizedMemberSearch
    ? users.filter((user) =>
        [user.name, user.email, user.title ?? "", user.department, user.role]
          .join(" ")
          .toLowerCase()
          .includes(normalizedMemberSearch),
      )
    : users;
  const visibleUsers = filteredUsers.slice(0, 8);
  const ssoReady = Boolean(auth?.oidcConfigured);
  const accessPosture = ssoReady ? "SSO governed" : auth?.authRequired ? "SSO required" : "Local admin";
  const provisioningTone: "green" | "amber" | "blue" = userProvisioning?.configured ? "green" : workspaceMode === "production" ? "amber" : "blue";
  const provisioningLabel = userProvisioning?.configured ? "SCIM sync ready" : workspaceMode === "production" ? "Manual roster" : "Admin managed";
  const adminSections = [
    {
      id: "openclaw",
      label: "OpenClaw",
      helper: `${openClawIntegration.gateway.version}`,
      tone: "amber",
    },
    {
      id: "mode",
      label: "Mode",
      helper: workspaceMode === "production" ? "Live tenant" : "Sample tenant",
      tone: workspaceMode === "production" ? "green" : "blue",
    },
    {
      id: "readiness",
      label: "Readiness",
      helper: `${blockers.length} blockers`,
      tone: readinessTone,
    },
    {
      id: "access",
      label: "Access",
      helper: `${users.length} users`,
      tone: ssoReady ? "green" : auth?.authRequired ? "amber" : "blue",
    },
    {
      id: "cutover",
      label: "Cutover",
      helper: manualActions.length ? `${manualActions.length} actions` : "Clear",
      tone: manualActions.some((item) => item.severity === "blocker") ? "red" : manualActions.length ? "amber" : "green",
    },
    {
      id: "maturity",
      label: "Maturity",
      helper: `${enterpriseMaturity.score}/100`,
      tone: maturityTone[enterpriseMaturity.status],
    },
    {
      id: "configuration",
      label: "Configuration",
      helper: activeProviderLabel,
      tone: providerConfigured ? "green" : "amber",
    },
    {
      id: "runtime",
      label: "Runtime",
      helper: connectors?.configured ? "Broker ready" : "Fallback",
      tone: connectors?.configured ? "green" : "amber",
    },
    {
      id: "workspace",
      label: "Workspace",
      helper: "Import/export",
      tone: "slate",
    },
  ] as const;
  const adminSectionToneClass: Record<(typeof adminSections)[number]["tone"], string> = {
    green: "bg-emerald-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    slate: "bg-slate-400",
  };
  const setupControls = [
    {
      label: "Workspace mode",
      value: workspaceMode === "production" ? "Production" : "Demo",
      complete: workspaceMode === "production",
      action: () => scrollToAdminSection("mode"),
    },
    {
      label: "AI model lane",
      value: providerConfigured ? activeProviderLabel : "Needs key",
      complete: providerConfigured,
      action: onOpenSettings,
    },
    {
      label: "Identity",
      value: accessPosture,
      complete: ssoReady || workspaceMode !== "production",
      action: () => scrollToAdminSection("access"),
    },
    {
      label: "Launch checks",
      value: readinessStatus,
      complete: readinessStatus === "ready",
      action: () => scrollToAdminSection("readiness"),
    },
    {
      label: "Cutover",
      value: manualActions.length ? `${manualActions.length} open` : "Clear",
      complete: manualActions.length === 0,
      action: () => scrollToAdminSection("cutover"),
    },
  ];
  const setupPathSteps = [
    {
      label: "Choose mode",
      body: workspaceMode === "production"
        ? "This tenant is live-mode and should use real company records."
        : "Decide when this should move from sample data to a clean live tenant.",
      complete: workspaceMode === "production",
      actionLabel: "Choose mode",
      action: () => scrollToAdminSection("mode"),
    },
    {
      label: "Configure company setup",
      body: providerConfigured
        ? `${activeProviderLabel} is ready for realistic Skill runs.`
        : "Add the default AI provider key before testing real workflows.",
      complete: providerConfigured,
      actionLabel: "Open setup",
      action: onOpenSettings,
    },
    {
      label: "Set access",
      body: ssoReady
        ? "Enterprise identity is connected for role-aware access."
        : auth?.authRequired
          ? "Map SSO role claims and reviewer roles before rollout."
          : "Local admin access is acceptable for demo, not broad rollout.",
      complete: ssoReady || workspaceMode !== "production",
      actionLabel: "Open access",
      action: () => scrollToAdminSection("access"),
    },
    {
      label: "Clear launch checks",
      body: readinessStatus === "ready"
        ? "Core readiness checks are passing."
        : `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} and ${warnings.length} warning${warnings.length === 1 ? "" : "s"} need review.`,
      complete: readinessStatus === "ready",
      actionLabel: "Review checks",
      action: () => scrollToAdminSection("readiness"),
    },
    {
      label: "Finish cutover",
      body: manualActions.length
        ? `${manualActions.length} launch action${manualActions.length === 1 ? "" : "s"} remain before handoff.`
        : "No manual launch actions are open.",
      complete: manualActions.length === 0,
      actionLabel: "Open cutover",
      action: () => scrollToAdminSection("cutover"),
    },
  ];
  const setupScore = Math.round((setupControls.filter((control) => control.complete).length / setupControls.length) * 100);
  const nextSetupPathStep = setupPathSteps.find((step) => !step.complete);
  const nextAdminAction =
    workspaceMode !== "production"
      ? {
          title: "Decide whether this tenant is demo or live",
          body: "Use production mode when the company is ready to connect real identity, model keys, users, and launch controls.",
          label: "Choose mode",
          action: () => scrollToAdminSection("mode"),
          tone: "blue" as const,
          icon: Rocket,
        }
      : blockers.length
        ? {
            title: "Clear production blockers first",
            body: `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} must be resolved before this workspace should be handed to a customer.`,
            label: "Review blockers",
            action: () => scrollToAdminSection("readiness"),
            tone: "red" as const,
            icon: AlertTriangle,
          }
        : !providerConfigured
          ? {
              title: "Add the default AI provider keys",
              body: `${activeProviderLabel} is selected for model routing, but the workspace still needs usable credentials before realistic Skill runs.`,
              label: "Open setup",
              action: onOpenSettings,
              tone: "amber" as const,
              icon: Settings,
            }
          : !ssoReady && auth?.authRequired
            ? {
                title: "Connect enterprise identity",
                body: "Production mode requires real user sessions, role claims, and reviewer separation before broad rollout.",
                label: "Set up access",
                action: () => scrollToAdminSection("access"),
                tone: "amber" as const,
                icon: Users,
              }
            : manualActions.length
              ? {
                  title: "Finish the launch fix list",
                  body: `${manualActions.length} cutover action${manualActions.length === 1 ? "" : "s"} remain across infrastructure, security, or operations.`,
                  label: "Open cutover",
                  action: () => scrollToAdminSection("cutover"),
                  tone: "amber" as const,
                  icon: ShieldCheck,
                }
              : {
                  title: "Admin posture is ready for launch review",
                  body: "Core setup controls are in place. Review the launch gate, then keep readiness checks in the operating rhythm.",
                  label: "Review launch gate",
                  action: () => scrollToAdminSection("maturity"),
                  tone: "green" as const,
                  icon: CheckCircle2,
                };
  const NextAdminIcon = nextAdminAction.icon;

  function scrollToAdminSection(sectionId: string) {
    setActiveAdminSection(sectionId);
    const target = document.getElementById(`admin-${sectionId}`);
    if (!target) return;

    const workspaceScroller = document.getElementById("workspace-main-content");
    if (!workspaceScroller) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const scrollerRect = workspaceScroller.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop = targetRect.top - scrollerRect.top + workspaceScroller.scrollTop - 12;
    workspaceScroller.scrollTop = Math.max(0, nextTop);
  }

  function saveBrandingDraft() {
    const normalized = normalizeOrganizationSettings(brandingDraft, organization.id);
    setBrandingDraft(normalized);
    onSaveOrganization(normalized);
  }

  function saveMemberDraft() {
    const email = memberDraft.email.trim().toLowerCase();
    const name = memberDraft.name.trim();
    if (!email || !name || !email.includes("@")) return;

    onUpsertUser({
      ...memberDraft,
      id: memberDraft.id || memberIdFromEmail(email),
      email,
      name,
      title: memberDraft.title.trim() || "Workspace member",
    });
    setMemberSearch(email);
    setMemberDraft({
      id: "",
      name: "",
      email: "",
      title: "",
      department: "Operations",
      role: "viewer",
    });
  }

  function editMember(user: User) {
    setMemberDraft(user);
  }

  const memberDraftName = memberDraft.name.trim();
  const memberDraftEmail = memberDraft.email.trim();
  const memberDraftSaveDisabledReason = !memberDraftName
    ? "Enter the member name before saving."
    : !memberDraftEmail
      ? "Enter the member email before saving."
      : !memberDraftEmail.includes("@")
        ? "Enter a valid member email address before saving."
        : "";

  async function copyLaunchChecklist() {
    const text = productionReadiness?.manualActionsMarkdown || "All production launch checks are passing.";
    try {
      await navigator.clipboard?.writeText(text);
      setLaunchChecklistCopied(true);
      window.setTimeout(() => setLaunchChecklistCopied(false), 1800);
    } catch {
      setLaunchChecklistCopied(false);
    }
  }

  async function copyLaunchEnvTemplate() {
    const envNames = Array.from(new Set(manualActions.flatMap((item) => item.env))).sort();
    const text = envNames.length
      ? [
          "# Enterprise AI Enablement OS production launch env",
          "# Fill these in your deployment platform or secret manager, then run npm run preflight:launch.",
          ...envNames.map((name) => `${name}=`),
        ].join("\n")
      : "# Enterprise AI Enablement OS production launch env\n# All launch readiness checks are passing.";
    try {
      await navigator.clipboard?.writeText(text);
      setLaunchEnvCopied(true);
      window.setTimeout(() => setLaunchEnvCopied(false), 1800);
    } catch {
      setLaunchEnvCopied(false);
    }
  }

  async function copyRoleClaimsTemplate() {
    const text = [
      "# OIDC / SAML role claim mapping for Enterprise AI Enablement OS",
      "# Emit one of these values in `eaieos_role`, `role`, or `roles`.",
      "admin",
      "ai_enablement_director",
      "ai_product_owner",
      "governance_reviewer",
      "security_reviewer",
      "legal_reviewer",
      "privacy_reviewer",
      "function_leader",
      "builder",
      "viewer",
    ].join("\n");
    try {
      await navigator.clipboard?.writeText(text);
      setRoleClaimsCopied(true);
      window.setTimeout(() => setRoleClaimsCopied(false), 1800);
    } catch {
      setRoleClaimsCopied(false);
    }
  }

  async function sealLegacyAuditChain() {
    setAuditMaintenanceStatus("running");
    try {
      await onSealLegacyAuditChain();
      setAuditMaintenanceStatus("done");
      window.setTimeout(() => setAuditMaintenanceStatus("idle"), 2400);
    } catch {
      setAuditMaintenanceStatus("error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Tenant branding, identity, SSO, roles, environments, model routing, cost limits, and local workspace operations"
        action={
          <div className="flex max-w-[460px] flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onExport}>
              <FileText size={16} />
              Export
            </Button>
            <Button variant="secondary" onClick={onImport}>
              <Database size={16} />
              Import
            </Button>
            <Badge tone={workspaceMode === "production" ? "green" : "blue"}>
              {workspaceMode === "production" ? "live production" : "demo sandbox"}
            </Badge>
            <Button variant="secondary" onClick={onOpenOnboarding}>
              <Rocket size={16} />
              Guided setup
            </Button>
            <Button onClick={onOpenSettings}>
              <Settings size={16} />
              AI Settings
            </Button>
          </div>
        }
      />
      <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          className="overflow-hidden rounded-xl border border-slate-200 bg-white/92 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start"
          data-testid="admin-section-nav"
        >
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Settings areas</div>
            <div className="mt-2 text-sm font-semibold text-slate-950">Company operating controls</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Identity, runtime, launch, integrations, and workspace operations in one admin surface.
            </p>
          </div>
          <nav className="max-h-[calc(100vh-13rem)] space-y-1 overflow-y-auto p-2" aria-label="Admin sections">
            {adminSections.map((section) => {
              const active = activeAdminSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-label={`Admin section: ${section.label}`}
                  aria-current={active ? "location" : undefined}
                  className={`group flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                  onClick={() => scrollToAdminSection(section.id)}
                >
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${
                      active ? "bg-[var(--primary)]" : adminSectionToneClass[section.tone]
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{section.label}</span>
                    <span className={`mt-0.5 block truncate text-xs font-medium ${active ? "text-[var(--primary)]/80" : "text-slate-400"}`}>
                      {section.helper}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 space-y-4" data-testid="admin-section-content">
          <Panel className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={nextAdminAction.tone}>{setupScore}% setup</Badge>
              <Badge tone={workspaceMode === "production" ? "green" : "blue"}>
                {workspaceMode === "production" ? "production tenant" : "demo sandbox"}
              </Badge>
              <Badge tone={readinessTone}>{readinessStatus}</Badge>
            </div>
            <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]/10">
                    <NextAdminIcon size={20} />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{nextAdminAction.title}</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{nextAdminAction.body}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="min-w-[132px] whitespace-nowrap" onClick={onOpenOnboarding}>
                  <Rocket size={15} />
                  Guided setup
                </Button>
                <Button className="min-w-[132px] whitespace-nowrap" onClick={nextAdminAction.action}>
                  <ArrowRight size={15} />
                  {nextAdminAction.label}
                </Button>
              </div>
            </div>
            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Workspace setup path</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    The safe order for turning this from a demo workspace into a real company tenant.
                  </p>
                </div>
                <Badge tone={nextSetupPathStep ? "amber" : "green"}>
                  {nextSetupPathStep ? `${nextSetupPathStep.label} next` : "setup path ready"}
                </Badge>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-5">
                {setupPathSteps.map((step, index) => {
                  const isNext = nextSetupPathStep?.label === step.label;
                  return (
                    <button
                      key={step.label}
                      type="button"
                      data-testid={`admin-setup-path-${index + 1}`}
                      onClick={step.action}
                      className={`group flex min-h-[142px] flex-col rounded-lg border p-3 text-left transition ${
                        step.complete
                          ? "border-green-100 bg-green-50/50 hover:border-green-200"
                          : isNext
                            ? "border-amber-200 bg-amber-50/70 hover:border-amber-300"
                            : "border-slate-200 bg-white/70 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                            step.complete
                              ? "bg-green-600 text-white"
                              : isNext
                                ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
                                : "bg-slate-100 text-slate-500"
                          }`}
                          aria-hidden="true"
                        >
                          {step.complete ? <CheckCircle2 size={14} /> : <span className="text-xs font-semibold">{index + 1}</span>}
                        </span>
                        <Badge tone={step.complete ? "green" : isNext ? "amber" : "slate"}>
                          {step.complete ? "done" : isNext ? "next" : "open"}
                        </Badge>
                      </span>
                      <span className="mt-3 text-sm font-semibold text-slate-950">{step.label}</span>
                      <span className="mt-2 block flex-1 text-xs leading-5 text-slate-600">{step.body}</span>
                      {!step.complete ? (
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#5147e8]">
                          {step.actionLabel}
                          <ArrowRight size={13} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric label="Members" value={`${users.length} users`} />
              <MiniMetric label="Reviewers" value={`${reviewerCount} assigned`} />
              <MiniMetric label="Provider" value={providerConfigured ? activeProviderLabel : "Not ready"} />
              <MiniMetric label="Launch gate" value={`${primetimeLaunchGate.score}/100`} />
            </div>
          </div>
          <div className="border-t border-slate-200/70 bg-slate-50/72 p-6 xl:border-l xl:border-t-0">
            <SectionTitle title="Setup Checklist" helper="The controls that make this workspace usable by a real company." compact />
            <div className="mt-4 space-y-2">
              {setupControls.map((control) => (
                <button
                  key={control.label}
                  type="button"
                  onClick={control.action}
                  className="flex w-full items-start gap-3 rounded-lg border border-slate-200/70 bg-white/74 p-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-white"
                >
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                      control.complete ? "bg-green-50 text-green-700" : "bg-white text-slate-400 ring-1 ring-slate-200"
                    }`}
                  >
                    {control.complete ? <CheckCircle2 size={15} /> : <ArrowRight size={14} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">{control.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">{control.value}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>
          <Panel id="admin-openclaw" data-testid="admin-openclaw" className="scroll-mt-28 overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">OpenClaw setup wizard</Badge>
              <Badge tone={openClawStatusTone(openClawIntegration.gateway.status)}>
                {openClawIntegration.gateway.status.replace("_", " ")}
              </Badge>
              <Badge tone={openClawLaunchReadiness >= 80 ? "green" : "amber"}>{openClawLaunchReadiness}% launch ready</Badge>
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950">
              Enterprise setup for OpenClaw inside Enablement OS
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Configure gateway connection, identity mapping, agent import, policy compilation, proof export, update gates,
              and value reporting before Claw workflows are allowed into production.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
              {openClawIntegration.setupWizard.map((step, index) => (
                <button
                  key={step.label}
                  type="button"
                  onClick={() => scrollToAdminSection(step.targetView === "admin" ? "access" : "openclaw")}
                  className={`group flex min-h-[142px] flex-col rounded-lg border p-3 text-left transition ${
                    step.status === "done"
                      ? "border-green-100 bg-green-50/50 hover:border-green-200"
                      : step.status === "next"
                        ? "border-amber-200 bg-amber-50/70 hover:border-amber-300"
                        : "border-slate-200 bg-white/72 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        step.status === "done"
                          ? "bg-green-600 text-white"
                          : step.status === "next"
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {step.status === "done" ? <CheckCircle2 size={14} /> : index + 1}
                    </span>
                    <Badge tone={openClawStatusTone(step.status)}>{step.status}</Badge>
                  </span>
                  <span className="mt-3 text-sm font-semibold text-slate-950">{step.label}</span>
                  <span className="mt-2 block flex-1 text-xs leading-5 text-slate-600">{step.body}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/72 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Gateway settings" helper="The production controls a company admin expects." compact />
            <div className="mt-4 space-y-3">
              <Field label="Gateway URL">
                <input aria-label="OpenClaw gateway URL" className="input font-mono text-xs" value={openClawIntegration.gateway.url} readOnly />
              </Field>
              <Field label="Version pin">
                <input aria-label="OpenClaw version pin" className="input font-mono text-xs" value={openClawIntegration.gateway.version} readOnly />
              </Field>
              <Field label="Auth mode">
                <select
                  aria-label="OpenClaw auth mode"
                  aria-describedby="openclaw-auth-mode-lock-reason"
                  className="input"
                  value={openClawIntegration.gateway.authMode}
                  title="OpenClaw auth mode is locked by the configured gateway profile."
                  disabled
                >
                  <option value="service-token">Service token pilot</option>
                  <option value="oidc-proxy">OIDC proxy production</option>
                </select>
                <p id="openclaw-auth-mode-lock-reason" className="mt-1 text-xs leading-5 text-slate-500">
                  Locked by the connected OpenClaw gateway profile. Change this in the tenant integration record.
                </p>
              </Field>
              <Field label="Sandbox mode">
                <select
                  aria-label="OpenClaw sandbox mode"
                  aria-describedby="openclaw-sandbox-mode-lock-reason"
                  className="input"
                  value={openClawIntegration.gateway.sandboxMode}
                  title="OpenClaw sandbox mode is locked by the configured gateway profile."
                  disabled
                >
                  <option value="read-only">Read-only</option>
                  <option value="approval-gated">Approval-gated writes</option>
                  <option value="restricted">Restricted</option>
                </select>
                <p id="openclaw-sandbox-mode-lock-reason" className="mt-1 text-xs leading-5 text-slate-500">
                  Locked by the connected OpenClaw gateway profile so production tool policy stays auditable.
                </p>
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Channels" value={String(openClawIntegration.gateway.channelCount)} />
              <MiniMetric label="Agents" value={String(openClawIntegration.agents.length)} />
              <MiniMetric label="Skills" value={String(openClawIntegration.skills.length)} />
              <MiniMetric label="Events" value={openClawIntegration.gateway.evidenceEvents.toLocaleString()} />
            </div>
            <Button className="mt-4 w-full" onClick={() => scrollToAdminSection("runtime")}>
              <LockKeyhole size={15} />
              Review runtime controls
            </Button>
          </div>
        </div>
      </Panel>

      <Panel id="admin-mode" className="mb-4 scroll-mt-28 overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={workspaceMode === "production" ? "green" : "blue"}>
                {workspaceMode === "production" ? "Live production active" : "Demo sandbox active"}
              </Badge>
              <h2 className="text-base font-semibold">Workspace Mode</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Live production starts with an empty tenant and only uses records created, imported, or connected by the company.
              Demo sandbox intentionally loads the Northwind sample tenant for walkthroughs and sales-style evaluation.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button type="button"
                className={`rounded-lg border p-4 text-left transition ${
                  workspaceMode === "production"
                    ? "border-green-200 bg-green-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                onClick={() => onWorkspaceModeChange("production")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-950">Live production</div>
                  <Badge tone={workspaceMode === "production" ? "green" : "slate"}>
                    {workspaceMode === "production" ? "active" : "switch"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  Production-empty by default, durable persistence enabled, no sample portfolio, no seeded fake records.
                </p>
              </button>
              <button type="button"
                className={`rounded-lg border p-4 text-left transition ${
                  workspaceMode === "demo"
                    ? "border-blue-200 bg-blue-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                onClick={() => onWorkspaceModeChange("demo")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-950">Demo sandbox</div>
                  <Badge tone={workspaceMode === "demo" ? "blue" : "slate"}>
                    {workspaceMode === "demo" ? "active" : "load"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  Loads the Northwind sample portfolio so teams can explore Skills, runs, reviews, evals, and reports.
                </p>
              </button>
            </div>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Startup behavior</div>
            <div className="mt-3 text-2xl font-bold text-slate-950">
              {workspaceMode === "production" ? "Clean live tenant" : "Sample tenant loaded"}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {workspaceMode === "production"
                ? "Refreshing the app will keep the workspace in live mode and scrub old sample records from startup."
                : "Refreshing the app will preserve the demo sandbox until an admin switches back to live production."}
            </p>
          </div>
        </div>
      </Panel>
      <Panel id="admin-readiness" className="mb-4 scroll-mt-28 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={readinessTone}>{readinessStatus}</Badge>
              <h2 className="text-base font-semibold">Production Readiness</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {readinessStatus === "ready"
                ? "Core launch controls are configured."
                : readinessStatus === "blocked"
                  ? "One or more launch blockers must be resolved before production cutover."
                  : "The OS can run, but some production integrations are still in fallback mode."}
            </p>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
              <span className="font-semibold">{blockers.length}</span> blockers
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
              <span className="font-semibold">{warnings.length}</span> warnings
            </div>
          </div>
        </div>
        {blockers.length || warnings.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {blockers.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">
                <span className="font-semibold">{item.label}:</span> {item.detail}
              </div>
            ))}
            {warnings.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-700">
                <span className="font-semibold">{item.label}:</span> {item.detail}
              </div>
            ))}
          </div>
        ) : null}
      </Panel>
      {customerLaunchContract ? (
        <Panel className="mb-4 overflow-hidden">
          <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="border-b border-slate-200 bg-slate-950 p-5 text-white xl:border-b-0 xl:border-r">
              <Badge tone={contractTone[customerLaunchContract.status]}>
                customer launch contract
              </Badge>
              <h2 className="mt-3 text-base font-semibold">Customer-Ready Capability Map</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                This is the practical contract for handing the OS to real companies: identity, tenancy, model ops,
                connectors, context, durable workflow execution, evals, evidence, observability, and privacy lifecycle.
              </p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight">{customerLaunchContract.score}</span>
                <span className="pb-1 text-sm font-semibold text-slate-400">/100</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/[0.06] p-3">
                  <div className="text-lg font-bold">{customerLaunchContract.readyCount}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">ready</div>
                </div>
                <div className="rounded-xl bg-white/[0.06] p-3">
                  <div className="text-lg font-bold">{customerLaunchContract.needsWorkCount}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">needs work</div>
                </div>
                <div className="rounded-xl bg-white/[0.06] p-3">
                  <div className="text-lg font-bold">{customerLaunchContract.blockedCount}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">blocked</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px bg-slate-100">
              {customerLaunchContract.domains.map((domain) => (
                <div key={domain.id} className="bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{domain.label}</div>
                      <div className="mt-1 text-xs font-medium text-slate-500">{domain.owner}</div>
                    </div>
                    <Badge tone={contractTone[domain.status]}>{domain.score}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 min-h-16 text-xs leading-5 text-slate-600">{domain.summary}</p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Next action</div>
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">{domain.nextAction}</p>
                  </div>
                  {domain.env.length ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {domain.env.slice(0, 3).map((name) => (
                        <span key={name} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-600">
                          {name}
                        </span>
                      ))}
                      {domain.env.length > 3 ? (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                          +{domain.env.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      ) : null}
      <Panel id="admin-access" className="mb-4 scroll-mt-28 overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-5">
            <div className="flex flex-col justify-between gap-4 2xl:flex-row 2xl:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={ssoReady ? "green" : auth?.authRequired ? "amber" : "blue"}>{accessPosture}</Badge>
                  <h2 className="text-base font-semibold">Team & Access</h2>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Production rollout expects real company identity: SSO sessions, tenant-scoped users, role claims, and
                  reviewer separation for governance, security, legal, privacy, builders, and business owners.
                </p>
              </div>
              <Button className="shrink-0 whitespace-nowrap" variant="secondary" onClick={() => void copyRoleClaimsTemplate()}>
                <Users size={16} />
                {roleClaimsCopied ? "Claims Copied" : "Copy Role Claims"}
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
              {[
                ["Members", users.length.toLocaleString(), users.length ? "tenant roster" : "connect SSO"],
                ["Admins", String(roleCounts.admin ?? 0), "workspace control"],
                ["Reviewers", String(reviewerCount), "governance lanes"],
                ["Builders", String(builderCount), "Skill delivery"],
                ["Provisioning", provisioningLabel, userProvisioning?.mode ?? "workspace API"],
              ].map(([label, value, helper]) => (
                <div key={label} className="rounded-lg border border-slate-200/70 bg-white/70 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
                  <div className={`mt-2 ${label === "Provisioning" ? "text-sm" : "text-2xl"} font-semibold text-slate-950`}>{value}</div>
                  <div className="mt-1 text-xs text-slate-500">{helper}</div>
                  {label === "Provisioning" ? <div className="mt-2"><Badge tone={provisioningTone}>{userProvisioning?.configured ? "token" : "manual"}</Badge></div> : null}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="block min-w-0 flex-1 text-sm font-medium text-slate-700">
                Find member
                <input
                  className="input mt-2"
                  data-testid="member-search"
                  value={memberSearch}
                  placeholder="Search name, email, role, or department"
                  onChange={(event) => setMemberSearch(event.target.value)}
                />
              </label>
              {memberSearch ? (
                <Button variant="secondary" onClick={() => setMemberSearch("")}>
                  Clear
                </Button>
              ) : null}
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200/70 bg-white/70">
              {filteredUsers.length ? (
                <div className="divide-y divide-slate-100">
                  {visibleUsers.map((user) => (
                    <div
                      key={user.id}
                      className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_140px_260px] md:items-center"
                      data-testid={`member-row-${user.id}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-950">{user.name}</div>
                        <div className="truncate text-xs text-slate-500">
                          {user.email}
                          {user.title ? <span className="hidden sm:inline"> · {user.title}</span> : null}
                        </div>
                      </div>
                      <div className="text-slate-600">{user.department}</div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="truncate font-mono text-xs text-slate-500">{user.role}</span>
                        <Badge tone={user.role === "admin" ? "green" : user.role.includes("reviewer") ? "amber" : "slate"}>
                          active
                        </Badge>
                        <button
                          type="button"
                          aria-label={`Edit ${user.name} (${user.email})`}
                          title={`Edit ${user.name}`}
                          data-testid={`edit-member-${user.id}`}
                          className="min-h-8 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                          onClick={() => editMember(user)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${user.name} (${user.email})`}
                          title={`Remove ${user.name}`}
                          data-testid={`remove-member-${user.id}`}
                          className="min-h-8 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                          onClick={() => onRemoveUser(user.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length > visibleUsers.length ? (
                    <div className="bg-slate-50/65 px-4 py-3 text-xs font-medium text-slate-500">
                      +{filteredUsers.length - visibleUsers.length} additional {memberSearch ? "matching " : ""}workspace members available through search
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="p-5">
                  <div className="text-sm font-semibold text-slate-950">{users.length ? "No members match this search" : "No tenant members provisioned yet"}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {users.length
                      ? "Adjust the member search to find a teammate by name, email, department, or role."
                      : "Connect OIDC/SSO, map enterprise groups to roles, then use SCIM or workspace import to populate users. Until then, local admin mode should only be used for development or emergency break-glass access."}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200/70 bg-slate-50/72 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Invite or Update Member" helper="Stage users before SSO cutover, or keep a local break-glass roster for launch validation." />
            <div className="mt-4 grid gap-3">
              <Field label="Name">
                <input
                  className="input"
                  value={memberDraft.name}
                  placeholder="Jane Smith"
                  onChange={(event) => setMemberDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </Field>
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  value={memberDraft.email}
                  placeholder="jane.smith@company.com"
                  onChange={(event) => setMemberDraft((current) => ({ ...current, email: event.target.value }))}
                />
              </Field>
              <Field label="Title">
                <input
                  className="input"
                  value={memberDraft.title ?? ""}
                  placeholder="Security Reviewer"
                  onChange={(event) => setMemberDraft((current) => ({ ...current, title: event.target.value }))}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Department">
                  <select
                    className="input"
                    value={memberDraft.department ?? "Operations"}
                    onChange={(event) =>
                      setMemberDraft((current) => ({ ...current, department: event.target.value as Department }))
                    }
                  >
                    {departmentOptions.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Role">
                  <select
                    className="input"
                    value={memberDraft.role}
                    onChange={(event) =>
                      setMemberDraft((current) => ({ ...current, role: event.target.value as User["role"] }))
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1"
                  disabled={Boolean(memberDraftSaveDisabledReason)}
                  aria-describedby={memberDraftSaveDisabledReason ? "member-draft-save-disabled-reason" : undefined}
                  title={memberDraftSaveDisabledReason || undefined}
                  onClick={saveMemberDraft}
                >
                  <Users size={16} />
                  {memberDraft.id ? "Update Member" : "Add Member"}
                </Button>
                {memberDraft.id ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setMemberDraft({
                        id: "",
                        name: "",
                        email: "",
                        title: "",
                        department: "Operations",
                        role: "viewer",
                      })
                    }
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
              {memberDraftSaveDisabledReason ? (
                <div id="member-draft-save-disabled-reason" className="text-xs leading-5 text-slate-500">
                  {memberDraftSaveDisabledReason}
                </div>
              ) : null}
            </div>
            <div className="my-5 h-px bg-slate-200/80" />
            <SectionTitle title="Role Claim Contract" helper="Use this when configuring Okta, Entra ID, Google Workspace, or another enterprise identity provider." />
            <div className="mt-4 rounded-lg bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-200">
              claim: eaieos_role
              <br />
              fallback: role | roles
              <br />
              tenant: organizationId
              <br />
              session: signed, HttpOnly, SameSite=Lax
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Admin", "Workspace, billing, settings, launch gates"],
                ["Director", "Portfolio, roadmap, reports, orchestration"],
                ["Reviewer", "Governance, security, legal, privacy decisions"],
                ["Builder", "Skills, workflows, prompts, tools, evals"],
              ].map(([label, body]) => (
                <div key={label} className="rounded-lg border border-slate-200/70 bg-white/74 p-3">
                  <div className="text-sm font-semibold text-slate-950">{label}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
      <Panel id="admin-cutover" className="mb-4 scroll-mt-28 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Badge tone={readinessTone}>launch sequence</Badge>
            <h2 className="text-base font-semibold">Production Cutover Sequence</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The same readiness data is grouped into the order an enterprise launch team can actually execute.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-px bg-slate-100">
          {launchSequence.map((step, index) => (
            <div key={step.id} className="bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Phase {index + 1}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">{step.label}</div>
                </div>
                <Badge tone={launchSequenceTone[step.status]}>{step.status}</Badge>
              </div>
              <p className="mt-3 min-h-16 text-xs leading-5 text-slate-600">{step.summary}</p>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-500">{step.owner}</span>
                <span className="text-slate-400">{step.actionCount ? `${step.actionCount} open` : "clear"}</span>
              </div>
              {step.env.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {step.env.slice(0, 3).map((name) => (
                    <span key={name} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-600">
                      {name}
                    </span>
                  ))}
                  {step.env.length > 3 ? (
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                      +{step.env.length - 3}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="mb-4 overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={manualActions.some((item) => item.severity === "blocker") ? "red" : manualActions.length ? "amber" : "green"}>
                {manualActions.length ? `${manualActions.length} actions` : "clear"}
              </Badge>
              <h2 className="text-base font-semibold">Launch Fix List</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A customer-launch checklist generated from the same server readiness contract used by preflight and health checks.
            </p>
          </div>
          <Button variant="secondary" onClick={() => void copyLaunchChecklist()}>
            <FileText size={16} />
            {launchChecklistCopied ? "Copied" : "Copy Checklist"}
          </Button>
          <Button variant="secondary" onClick={() => void copyLaunchEnvTemplate()}>
            <FileText size={16} />
            {launchEnvCopied ? "Env Copied" : "Copy Env Template"}
          </Button>
        </div>
        {manualActions.length ? (
          <div className="divide-y divide-slate-100">
            {manualActions.map((item, index) => (
              <div key={item.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[48px_minmax(0,1fr)_220px]">
                <div className="flex size-10 items-center justify-center rounded-xl bg-slate-50 text-sm font-bold text-slate-500">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-950">{item.title}</h3>
                    <Badge tone={item.severity === "blocker" ? "red" : "amber"}>{item.severity}</Badge>
                    <Badge tone="slate">{item.owner}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.action}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{item.why}</p>
                  {item.env.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.env.slice(0, 6).map((name) => (
                        <span key={name} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">
                          {name}
                        </span>
                      ))}
                      {item.env.length > 6 ? (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
                          +{item.env.length - 6}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  <div className="font-semibold uppercase tracking-[0.12em] text-slate-400">Verify</div>
                  <div className="mt-2">{item.verify}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-sm leading-6 text-slate-600">
            All launch readiness checks are passing. Keep preflight in CI so this remains true as infrastructure and connectors evolve.
          </div>
        )}
      </Panel>
      <Panel id="admin-maturity" className="mb-4 scroll-mt-28 overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="border-b border-slate-200 bg-slate-950 p-5 text-white xl:border-b-0 xl:border-r">
            <Badge tone={gateTone[primetimeLaunchGate.status]}>
              {primetimeLaunchGate.status}
            </Badge>
            <h2 className="mt-3 text-base font-semibold">Primetime Launch Gate</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{primetimeLaunchGate.summary}</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-bold tracking-tight">{primetimeLaunchGate.score}</span>
              <span className="pb-1 text-sm font-semibold text-slate-400">/100</span>
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.06] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Next release action</div>
              <div className="mt-2 text-sm font-semibold">{primetimeLaunchGate.nextAction.label}</div>
              <p className="mt-2 text-xs leading-5 text-slate-300">{primetimeLaunchGate.nextAction.nextAction}</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/[0.06] p-3">
                <div className="text-lg font-bold">{primetimeLaunchGate.passes.length}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">pass</div>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-3">
                <div className="text-lg font-bold">{primetimeLaunchGate.warnings.length}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">warn</div>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-3">
                <div className="text-lg font-bold">{primetimeLaunchGate.blockers.length}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">block</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px bg-slate-100">
            {primetimeLaunchGate.items.map((item) => (
              <div key={item.id} className="bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.requiredFor === "production" ? "Production gate" : "Pilot gate"}</div>
                  </div>
                  <Badge tone={gateItemTone[item.status]}>{item.status}</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">{item.evidence}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.nextAction}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel className="mb-4 overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
            <Badge tone={maturityTone[enterpriseMaturity.status]}>{enterpriseMaturity.status}</Badge>
            <h2 className="mt-3 text-base font-semibold">Enterprise AI OS Maturity</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Continuous self-assessment against the product bar for a global AI enablement operating system.
            </p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-bold tracking-tight text-slate-950">{enterpriseMaturity.score}</span>
              <span className="pb-1 text-sm font-semibold text-slate-400">/100</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">{enterpriseMaturity.summary}</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px bg-slate-100">
            {enterpriseMaturity.pillars.map((pillar) => (
              <div key={pillar.id} className="bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold text-slate-950">{pillar.name}</div>
                  <Badge tone={maturityTone[pillar.status]}>{pillar.score}</Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pillar.score}%` }} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{pillar.nextAction}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <div id="admin-configuration" className="grid scroll-mt-28 gap-4 xl:grid-cols-3">
        <Panel className="p-5">
          <SectionTitle title="Tenant Branding" />
          <div className="mt-4 space-y-4">
            <Field label="Company Name">
              <input
                className="input"
                value={brandingDraft.name}
                placeholder="Your organization"
                onChange={(event) => setBrandingDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </Field>
            <Field label="Workspace Label">
              <input
                className="input"
                value={brandingDraft.workspaceLabel}
                placeholder="AI Enablement OS"
                onChange={(event) => setBrandingDraft((current) => ({ ...current, workspaceLabel: event.target.value }))}
              />
            </Field>
            <Field label="Primary Color">
              <div className="flex items-center gap-3">
                <input
                  aria-label="Tenant primary color"
                  className="h-10 w-12 shrink-0 rounded-lg border border-slate-200 bg-white p-1"
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(brandingDraft.primaryColor) ? brandingDraft.primaryColor : "#635bff"}
                  onChange={(event) => setBrandingDraft((current) => ({ ...current, primaryColor: event.target.value }))}
                />
                <input
                  className="input font-mono text-xs"
                  value={brandingDraft.primaryColor}
                  placeholder="#635bff"
                  onChange={(event) => setBrandingDraft((current) => ({ ...current, primaryColor: event.target.value }))}
                />
              </div>
            </Field>
            <Field label="Logo URL">
              <div className="flex items-center gap-3">
                {brandingDraft.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandingDraft.logoUrl}
                    alt="Tenant logo preview"
                    className="size-10 shrink-0 rounded-lg border border-slate-200 object-contain p-1"
                  />
                ) : (
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm font-bold text-[var(--primary-contrast)]"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    {(brandingDraft.name || "Enterprise").charAt(0).toUpperCase()}
                  </div>
                )}
                <input
                  className="input font-mono text-xs"
                  value={brandingDraft.logoUrl ?? ""}
                  placeholder="https://cdn.example.com/logo.svg"
                  onChange={(event) =>
                    setBrandingDraft((current) => ({ ...current, logoUrl: event.target.value || undefined }))
                  }
                />
              </div>
            </Field>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              Branding is stored with the tenant workspace and included in redacted export packets. Leave the logo blank to use the
              auto-generated monogram.
            </div>
            <Button variant="secondary" onClick={saveBrandingDraft}>
              <Save size={16} />
              Save Branding
            </Button>
          </div>
        </Panel>
        <Panel className="p-5">
          <SectionTitle title="Model Routing" />
          <div className="mt-4 space-y-3">
            {[
              `default Skill runs -> ${aiSettings.defaultModel}`,
              `classification / scoring -> ${aiSettings.classificationModel}`,
              `summaries / briefs -> ${aiSettings.summarizationModel}`,
              `governance reasoning -> ${aiSettings.governanceModel}`,
              `workflow and tool planning -> ${aiSettings.workflowModel}`,
              `red-team evals -> ${aiSettings.redTeamModel}`,
              `fallback -> ${aiSettings.fallbackModel}`,
              `budget limit -> ${formatCurrency(aiSettings.monthlyBudgetUsd)} / month`,
            ].map((rule) => (
              <div key={rule} className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{rule}</div>
            ))}
          </div>
        </Panel>
        <Panel className="p-5">
          <SectionTitle title="Enterprise Controls" />
          <div className="mt-4 space-y-3">
            {[
              ssoReady ? "SSO configured" : "SSO setup required",
              userProvisioning?.configured ? "SCIM provisioning ready" : "SCIM token pending",
              "Audit logs immutable",
              "PII redaction enabled",
              "Approval gates enforced",
            ].map((rule) => (
              <div key={rule} className="flex items-center gap-2 text-sm text-slate-700">
                <LockKeyhole size={15} className="text-[#5147e8]" />
                {rule}
              </div>
            ))}
          </div>
        </Panel>
        <Panel id="admin-runtime" className="scroll-mt-28 p-5 xl:col-span-3">
          <SectionTitle title="Runtime Operations" helper="Authenticated workspace persistence, API protection, provider vault, connector broker, and workflow engine readiness" />
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">Persistence</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {database?.reason ?? "Workspace state loads from the server repository. Browser storage is only the offline cache."}
              </p>
              <Badge tone={database?.durable ? "green" : "amber"}>{database?.mode ?? "checking"}</Badge>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">Identity</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {auth?.oidcConfigured
                  ? "OIDC SSO is configured for enterprise identity."
                  : auth?.authRequired
                    ? "Signed sessions are required; connect OIDC before broad rollout."
                    : "Local admin mode is active for development."}
              </p>
              <Badge tone={auth?.oidcConfigured ? "green" : auth?.authRequired ? "amber" : "blue"}>{auth?.mode ?? "checking"}</Badge>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">User Lifecycle</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {userProvisioning?.reason ?? "SCIM-compatible user lifecycle sync is available through the provisioning API."}
              </p>
              <Badge tone={provisioningTone}>{userProvisioning?.mode ?? "checking"}</Badge>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">API Protection</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {apiProtection?.reason ?? "API mutation origin guard, payload cap, route rate limits, and request IDs are checked at the edge."}
              </p>
              <Badge tone={apiProtection?.configured ? (apiProtection.salted ? "green" : "amber") : "red"}>
                {apiProtection?.mode ?? "checking"}
              </Badge>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">Provider Mode</div>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={providerConfigured ? "green" : "amber"}>
                  {activeProviderLabel}
                </Badge>
                <span className="text-sm text-slate-600">
                  {aiSettings.defaultProvider === "local"
                    ? "deterministic local runtime active"
                    : providerConfigured
                      ? "provider credentials configured by admin"
                      : "provider credentials required"}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">Server Vault</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {secretVault?.reason ??
                  (serverConfiguredProviders.length > 0
                    ? `${serverConfiguredProviders.length} external providers are available from environment secrets.`
                    : "No external provider secrets are available from the server environment yet.")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={secretVault?.configured ? (secretVault.mode === "development-fallback" ? "amber" : "green") : "red"}>
                  {secretVault?.mode ?? "checking"}
                </Badge>
                {serverConfiguredProviders.slice(0, 4).map((provider) => (
                  <Badge key={provider.id} tone="green">{provider.label}</Badge>
                ))}
                {missingServerProviders.length > 0 ? <Badge tone="slate">{missingServerProviders.length} pending</Badge> : null}
              </div>
              {readinessCheckedAt ? <div className="mt-3 text-xs text-slate-500">Checked {readinessCheckedAt}</div> : null}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">Connectors</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {connectors?.configured
                  ? "External MCP/connector broker is configured."
                  : "Policy-only connector mode is active until MCP_BROKER_URL is set."}
              </p>
              <Badge tone={connectors?.configured ? "green" : "amber"}>{connectors?.mode ?? "checking"}</Badge>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">Workflow Engine</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {workflows?.configured
                  ? "External workflow engine is configured."
                  : "Local durable job ledger is active until Temporal or a workflow engine is connected."}
              </p>
              <Badge tone={workflows?.configured ? "green" : "amber"}>{workflows?.mode ?? "checking"}</Badge>
            </div>
          </div>
        </Panel>
        <Panel className="p-5 xl:col-span-3" data-testid="admin-customer-launch-infrastructure">
          <SectionTitle
            title="Customer Launch Infrastructure"
            helper="The production stack needed before a real tenant connects company systems and stores customer data"
          />
          <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              {operationCards.map(([label, readiness]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-4" data-testid="admin-infrastructure-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{label}</div>
                      <div className="mt-1 text-xs text-slate-500">{readiness?.mode ?? "checking"}</div>
                    </div>
                    <Badge tone={readiness?.configured ? "green" : readinessStatus === "blocked" ? "red" : "amber"}>
                      {readiness?.configured ? "ready" : "needed"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {readiness?.reason ?? "Readiness has not been checked yet."}
                  </p>
                  {readiness?.evidence?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {readiness.evidence.slice(0, 3).map((item) => (
                        <span key={item} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {label === "Trace Store" && harnessTraceSummary ? (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[
                        ["Traces", harnessTraceSummary.total],
                        ["Failed", harnessTraceSummary.failed],
                        ["Prompt", `${harnessTraceSummary.promptQualityAverage}/100`],
                      ].map(([metricLabel, value]) => (
                        <div key={metricLabel} className="rounded-lg bg-slate-50 px-2 py-2">
                          <div className="text-sm font-bold text-slate-950">{value}</div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{metricLabel}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {label === "Audit Chain" && readiness && !readiness.configured ? (
                    <Button
                      variant="secondary"
                      className="mt-4 w-full"
                      onClick={() => void sealLegacyAuditChain()}
                      disabled={auditMaintenanceStatus === "running"}
                    >
                      <ShieldCheck size={16} />
                      {auditMaintenanceStatus === "running"
                        ? "Sealing chain..."
                        : auditMaintenanceStatus === "done"
                          ? "Chain sealed"
                          : auditMaintenanceStatus === "error"
                            ? "Retry seal"
                            : "Seal Legacy Chain"}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Connector Families</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Slack, Microsoft 365, Jira, ServiceNow, SharePoint, Workday, and Google Workspace are checked from server env
                    vars, tenant vault secrets, or an external broker.
                  </p>
                </div>
                <Badge tone={connectorCatalog?.productionReady ? "green" : "amber"}>
                  {connectorCatalog ? `${connectorCatalog.readyCount}/${connectorCatalog.requiredCount}` : "checking"}
                </Badge>
              </div>
              <div className="mt-4 max-h-80 space-y-2 overflow-auto pr-1">
                {connectorEventSummary ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm font-semibold text-slate-950">Execution Evidence</div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[
                        ["Events", connectorEventSummary.total],
                        ["Executed", connectorEventSummary.executed],
                        ["Enveloped", connectorEventSummary.envelopeCount],
                      ].map(([metricLabel, value]) => (
                        <div key={metricLabel} className="rounded-lg bg-slate-50 px-2 py-2">
                          <div className="text-sm font-bold text-slate-950">{value}</div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{metricLabel}</div>
                        </div>
                      ))}
                    </div>
                    {connectorEventSummary.missingEnvelopeCount || connectorEventSummary.blocked ? (
                      <div className="mt-3 text-xs font-semibold text-amber-700">
                        {connectorEventSummary.missingEnvelopeCount} legacy event(s), {connectorEventSummary.blocked} blocked execution(s)
                      </div>
                    ) : (
                      <div className="mt-3 text-xs font-semibold text-green-700">Connector execution evidence is envelope-backed.</div>
                    )}
                  </div>
                ) : null}
                {(connectorCatalog?.connectors ?? []).map((connector) => (
                  <div key={connector.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-950">{connector.label}</div>
                        <div className="mt-1 text-xs text-slate-500">{connector.system} · {connector.executionMode}</div>
                      </div>
                      <Badge tone={connectorStatusTone[connector.status] ?? "slate"}>{connector.status}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{connector.productionUse}</p>
                    {connector.missingSecrets.length ? (
                      <div className="mt-2 text-[11px] font-semibold text-amber-700">
                        Missing {connector.missingSecrets.slice(0, 3).join(", ")}
                        {connector.missingSecrets.length > 3 ? ` +${connector.missingSecrets.length - 3}` : ""}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] font-semibold text-green-700">Required secrets available</div>
                    )}
                  </div>
                ))}
                {!connectorCatalog?.connectors?.length ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                    Connector readiness will appear after the server readiness check completes.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Panel>
        <Panel id="admin-workspace" className="scroll-mt-28 p-5 xl:col-span-3">
          <SectionTitle title="Workspace Operations" helper="Export, import, reset, and recovery controls for this tenant workspace" />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">Export Packet</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Download a redacted workspace packet with use cases, Skills, runs, reviews, evals, reports, and workflow state.
              </p>
              <Button variant="secondary" className="mt-4" onClick={onExport}>Export Workspace</Button>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">Import Packet</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Restore a tenant workspace packet. Server persistence becomes the source of truth after import.
              </p>
              <Button variant="secondary" className="mt-4" onClick={onImport}>Import Workspace</Button>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">Load Demo Tenant</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Populate the workspace with the Northwind Group sample portfolio — use cases, Skills, runs, reviews, evals, and a report — to explore the platform end to end.
              </p>
              <Button variant="secondary" className="mt-4" onClick={onLoadDemo}>Load Demo Tenant</Button>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50/40 p-4">
              <div className="text-sm font-semibold text-red-800">Reset Workspace</div>
              <p className="mt-2 text-sm leading-6 text-red-700">
                Clear imported records, generated runs, reports, settings, and local cache for this workspace. The empty state is persisted back to the server.
              </p>
              <Button variant="danger" className="mt-4" onClick={onReset}>Reset Workspace</Button>
            </div>
          </div>
        </Panel>
          </div>
        </main>
      </div>
    </div>
  );
}
