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
import { Badge, Button, CollapsibleSection, Field, MiniMetric, Panel, SectionTitle, StatusNotice } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { roleCapabilities, roleLabels, type UserRole } from "@/lib/rbac";

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

function isValidMemberEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
  const [activeAdminSection, setActiveAdminSection] = useState("mode");
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
  const secretEvidence = productionReadiness?.secretEvidence;
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
  const adminCount = roleCounts.admin ?? 0;
  const soleAdmin = adminCount <= 1 ? users.find((user) => user.role === "admin") ?? null : null;
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
  const visibleUsers = filteredUsers.slice(0, 6);
  const ssoReady = Boolean(auth?.oidcConfigured);
  const accessPosture = ssoReady ? "SSO governed" : auth?.authRequired ? "SSO required" : "Local admin";
  const provisioningTone: "green" | "amber" | "blue" = userProvisioning?.configured ? "green" : workspaceMode === "production" ? "amber" : "blue";
  const provisioningLabel = userProvisioning?.configured ? "SCIM sync ready" : workspaceMode === "production" ? "Manual roster" : "Admin managed";
  const adminSections = [
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
      id: "openclaw",
      label: "Agent Gateway",
      helper: "Runtime adapters",
      tone: "amber",
    },
    {
      id: "workspace",
      label: "Workspace",
      helper: "Import/export",
      tone: "slate",
    },
  ] as const;
  const adminSectionToneClass: Record<(typeof adminSections)[number]["tone"], string> = {
    green: "bg-[var(--success)]",
    blue: "bg-[var(--info)]",
    amber: "bg-[var(--warning)]",
    red: "bg-[var(--danger)]",
    slate: "bg-[var(--border-strong)]",
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
      value: providerConfigured ? activeProviderLabel : "Provider key needed",
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
        : "Connect an approved model provider key before testing real workflows.",
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
              title: "Connect an approved model provider",
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
    const workspaceScroller = document.getElementById("workspace-main-content");
    const contentTop = document.querySelector("[data-testid='admin-section-content']");
    if (workspaceScroller && contentTop) {
      const scrollerRect = workspaceScroller.getBoundingClientRect();
      const contentRect = contentTop.getBoundingClientRect();
      const nextTop = contentRect.top - scrollerRect.top + workspaceScroller.scrollTop - 12;
      workspaceScroller.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
      return;
    }

    contentTop?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveBrandingDraft() {
    const normalized = normalizeOrganizationSettings(brandingDraft, organization.id);
    setBrandingDraft(normalized);
    onSaveOrganization(normalized);
  }

  function saveMemberDraft() {
    const email = memberDraft.email.trim().toLowerCase();
    const name = memberDraft.name.trim();
    if (memberDraftSaveDisabledReason) return;

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
  const normalizedMemberDraftEmail = memberDraftEmail.toLowerCase();
  const memberDraftExistingUser = memberDraft.id ? users.find((user) => user.id === memberDraft.id) : null;
  const memberEmailBelongsToAnotherUser = Boolean(
    normalizedMemberDraftEmail &&
      users.some((user) => user.email.toLowerCase() === normalizedMemberDraftEmail && user.id !== memberDraft.id),
  );
  const memberDraftWouldRemoveLastAdmin = Boolean(
    memberDraftExistingUser?.role === "admin" && memberDraft.role !== "admin" && adminCount <= 1,
  );
  const memberDraftSaveDisabledReason = !memberDraftName
    ? "Enter the member name before saving."
    : !memberDraftEmail
      ? "Enter the member email before saving."
      : !isValidMemberEmail(memberDraftEmail)
        ? "Enter a valid member email address before saving."
        : memberEmailBelongsToAnotherUser
          ? "That email already belongs to another workspace member."
          : memberDraftWouldRemoveLastAdmin
            ? "At least one workspace admin is required."
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
        subtitle="Tenant, identity, runtime, launch, and workspace controls"
        compact
        action={
          <div className="flex w-full flex-wrap gap-1.5">
            <Button variant="secondary" className="min-h-8 px-2.5 py-1.5 text-xs" onClick={onExport}>
              <FileText size={14} />
              Export
            </Button>
            <Button variant="secondary" className="min-h-8 px-2.5 py-1.5 text-xs" onClick={onImport}>
              <Database size={14} />
              Import
            </Button>
            <span className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/76 px-2">
              <Badge tone={workspaceMode === "production" ? "green" : "blue"}>
                {workspaceMode === "production" ? "live production" : "demo sandbox"}
              </Badge>
            </span>
            <Button
              variant="secondary"
              className="min-h-8 px-2.5 py-1.5 text-xs"
              onClick={onOpenOnboarding}
              aria-label="Open guided setup"
              title="Open guided setup"
            >
              <Rocket size={14} />
              Guide
            </Button>
            <Button
              className="min-h-8 px-2.5 py-1.5 text-xs"
              onClick={onOpenSettings}
              aria-label="Open AI settings"
              title="Open AI settings"
            >
              <Settings size={14} />
              AI
            </Button>
          </div>
        }
      />
      <div className="grid min-h-[calc(100svh-2rem)] gap-4 lg:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/92 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur lg:sticky lg:top-4 lg:max-h-[calc(100svh-2rem)] lg:self-start"
          data-testid="admin-section-nav"
        >
          <div className="border-b border-[var(--border)] px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">Settings areas</div>
            <div className="mt-2 text-sm font-semibold text-[var(--text)]">Company operating controls</div>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Identity, runtime, launch, integrations, and workspace operations in one admin surface.
            </p>
          </div>
          <nav className="grid max-h-80 gap-2 overflow-y-auto p-2 sm:grid-cols-2 md:grid-cols-3 lg:block lg:max-h-[calc(100svh-13rem)] lg:space-y-1" aria-label="Admin sections">
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
                      ? "border-[var(--primary)] bg-[var(--surface-muted)] text-[var(--text)] shadow-sm"
                      : "border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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
                    <span className={`mt-0.5 block truncate text-xs font-medium ${active ? "text-[var(--text-muted)]" : "text-[var(--text-soft)]"}`}>
                      {section.helper}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 space-y-3" data-testid="admin-section-content">
          <Panel className="p-2.5 sm:p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={nextAdminAction.tone}>{setupScore}% setup</Badge>
                  <Badge tone={workspaceMode === "production" ? "green" : "blue"}>
                    {workspaceMode === "production" ? "production" : "demo"}
                  </Badge>
                  <Badge tone={readinessTone}>{readinessStatus}</Badge>
                  <span className="rounded-full border border-[var(--border)]/70 bg-[var(--surface)]/72 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
                    {users.length} user{users.length === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full border border-[var(--border)]/70 bg-[var(--surface)]/72 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)] tabular-nums">
                    gate {primetimeLaunchGate.score}/100
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-2 rounded-lg bg-[var(--surface-muted)]/74 px-2.5 py-1 text-sm font-semibold text-[var(--text)] ring-1 ring-[var(--border)]/60">
                    <NextAdminIcon size={15} className="shrink-0 text-[var(--primary)]" />
                    <span className="truncate">Next: {nextAdminAction.title}</span>
                  </span>
                </div>
                <p className="sr-only">{nextAdminAction.body}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="min-h-8 whitespace-nowrap px-2.5 py-1.5 text-xs"
                  onClick={onOpenOnboarding}
                  aria-label="Open guided setup"
                  title="Open guided setup"
                >
                  <Rocket size={14} />
                  Guide
                </Button>
                <Button
                  className="min-h-8 whitespace-nowrap px-2.5 py-1.5 text-xs"
                  onClick={nextAdminAction.action}
                  aria-label={nextAdminAction.label}
                  title={nextAdminAction.label}
                >
                  <ArrowRight size={14} />
                  Open
                </Button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)]/72 pt-2" aria-label="Setup path">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                Path
              </span>
              {setupPathSteps.map((step, index) => {
                const isNext = nextSetupPathStep?.label === step.label;
                return (
                  <button
                    key={step.label}
                    type="button"
                    data-testid={`admin-setup-path-${index + 1}`}
                    onClick={step.action}
                    className={`group flex min-h-10 min-w-[118px] items-center gap-1.5 rounded-lg border px-2 py-1 text-left transition ${
                      step.complete
                        ? "border-[var(--border-strong)] bg-[var(--success-soft)] hover:border-[var(--border-strong)]"
                        : isNext
                          ? "border-[var(--border-strong)] bg-[var(--warning-soft)] hover:border-[var(--border-strong)]"
                          : "border-[var(--border)] bg-[var(--surface)]/72 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                    }`}
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                        step.complete
                          ? "bg-green-600 text-white"
                          : isNext
                            ? "bg-[var(--warning-soft)] text-[var(--warning)] ring-1 ring-[color-mix(in_srgb,var(--warning)_26%,var(--border))]"
                            : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                      }`}
                      aria-hidden="true"
                    >
                      {step.complete ? <CheckCircle2 size={11} /> : <span className="text-[10px] font-semibold">{index + 1}</span>}
                    </span>
                    <span className="truncate text-xs font-semibold text-[var(--text)]">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
      <Panel id="admin-mode" hidden={activeAdminSection !== "mode"} className="mb-4 scroll-mt-28 overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={workspaceMode === "production" ? "green" : "blue"}>
                {workspaceMode === "production" ? "Live production active" : "Demo sandbox active"}
              </Badge>
              <h2 className="text-base font-semibold">Workspace Mode</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Live production starts with an empty tenant and only uses records created, imported, or connected by the company.
              Demo sandbox intentionally loads the Northwind sample tenant for walkthroughs and sales-style evaluation.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button type="button"
                className={`rounded-lg border p-4 text-left transition ${
                  workspaceMode === "production"
                    ? "border-[var(--border-strong)] bg-[var(--success-soft)] shadow-sm"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                }`}
                onClick={() => onWorkspaceModeChange("production")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--text)]">Live production</div>
                  <Badge tone={workspaceMode === "production" ? "green" : "slate"}>
                    {workspaceMode === "production" ? "active" : "switch"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                  Production-empty by default, durable persistence enabled, no sample portfolio, no seeded fake records.
                </p>
              </button>
              <button type="button"
                className={`rounded-lg border p-4 text-left transition ${
                  workspaceMode === "demo"
                    ? "border-[var(--border-strong)] bg-[var(--info-soft)] shadow-sm"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                }`}
                onClick={() => onWorkspaceModeChange("demo")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--text)]">Demo sandbox</div>
                  <Badge tone={workspaceMode === "demo" ? "blue" : "slate"}>
                    {workspaceMode === "demo" ? "active" : "load"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                  Loads the Northwind sample portfolio so teams can explore Skills, runs, reviews, evals, and reports.
                </p>
              </button>
            </div>
          </div>
          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] p-5 lg:border-l lg:border-t-0">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Startup behavior</div>
            <div className="mt-3 text-2xl font-bold text-[var(--text)]">
              {workspaceMode === "production" ? "Clean live tenant" : "Sample tenant loaded"}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {workspaceMode === "production"
                ? "Refreshing the app will keep the workspace in live mode and scrub old sample records from startup."
                : "Refreshing the app will preserve the demo sandbox until an admin switches back to live production."}
            </p>
          </div>
        </div>
      </Panel>
      <Panel id="admin-readiness" hidden={activeAdminSection !== "readiness"} className="mb-4 scroll-mt-28 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={readinessTone}>{readinessStatus}</Badge>
              <h2 className="text-base font-semibold">Production Readiness</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {readinessStatus === "ready"
                ? "Core launch controls are configured."
                : readinessStatus === "blocked"
                  ? "One or more launch blockers must be resolved before production cutover."
                  : "The OS can run, but some production integrations are still in fallback mode."}
            </p>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[var(--danger)]">
              <span className="font-semibold">{blockers.length}</span> blockers
            </div>
            <div className="rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-[var(--warning)]">
              <span className="font-semibold">{warnings.length}</span> warnings
            </div>
          </div>
        </div>
        {blockers.length || warnings.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {blockers.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--danger-soft)] px-3 py-2 text-sm leading-6 text-[var(--danger)]">
                <span className="font-semibold">{item.label}:</span> {item.detail}
              </div>
            ))}
            {warnings.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--warning-soft)] px-3 py-2 text-sm leading-6 text-[var(--warning)]">
                <span className="font-semibold">{item.label}:</span> {item.detail}
              </div>
            ))}
          </div>
        ) : null}
      </Panel>
      {customerLaunchContract ? (
        <CollapsibleSection
          hidden={activeAdminSection !== "readiness"}
          className="mb-4 scroll-mt-28"
          title="Customer-Ready Capability Map"
          summary="The practical contract for handing the OS to real companies: identity, tenancy, model ops, connectors, evals, evidence, observability, and privacy."
        >
          <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="border-b border-[var(--border)] bg-slate-950 p-5 text-white xl:border-b-0 xl:border-r">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">
                Customer launch contract
              </span>
              <h2 className="mt-3 text-base font-semibold">Customer-Ready Capability Map</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                This is the practical contract for handing the OS to real companies: identity, tenancy, model ops,
                connectors, context, durable workflow execution, evals, evidence, observability, and privacy lifecycle.
              </p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight tabular-nums">{customerLaunchContract.score}</span>
                <span className="pb-1 text-sm font-semibold text-[var(--text-soft)]">/100</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[var(--surface)]/[0.06] p-3">
                  <div className="text-lg font-bold tabular-nums">{customerLaunchContract.readyCount}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-soft)]">ready</div>
                </div>
                <div className="rounded-xl bg-[var(--surface)]/[0.06] p-3">
                  <div className="text-lg font-bold tabular-nums">{customerLaunchContract.needsWorkCount}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-soft)]">needs work</div>
                </div>
                <div className="rounded-xl bg-[var(--surface)]/[0.06] p-3">
                  <div className="text-lg font-bold tabular-nums">{customerLaunchContract.blockedCount}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-soft)]">blocked</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px bg-[var(--surface-subtle)]">
              {customerLaunchContract.domains.map((domain) => (
                <div key={domain.id} className="bg-[var(--surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{domain.label}</div>
                      <div className="mt-1 text-xs font-medium text-[var(--text-muted)]">{domain.owner}</div>
                    </div>
                    <Badge tone={contractTone[domain.status]}>{domain.score}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 min-h-16 text-xs leading-5 text-[var(--text-muted)]">{domain.summary}</p>
                  <div className="mt-3 rounded-lg bg-[var(--surface-muted)] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)]">Next action</div>
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{domain.nextAction}</p>
                  </div>
                  {domain.env.length ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {domain.env.slice(0, 3).map((name) => (
                        <span key={name} className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--text-muted)]">
                          {name}
                        </span>
                      ))}
                      {domain.env.length > 3 ? (
                        <span className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                          +{domain.env.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      ) : null}
      <Panel id="admin-access" hidden={activeAdminSection !== "access"} className="mb-4 scroll-mt-28 overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-4 2xl:flex-row 2xl:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={ssoReady ? "green" : auth?.authRequired ? "amber" : "blue"}>{accessPosture}</Badge>
                  <h2 className="text-base font-semibold">Team & Access</h2>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                  Production rollout expects real company identity: SSO sessions, tenant-scoped users, role claims, and
                  reviewer separation for governance, security, legal, privacy, builders, and business owners.
                </p>
              </div>
              <Button className="shrink-0 whitespace-nowrap" variant="secondary" onClick={() => void copyRoleClaimsTemplate()}>
                <Users size={16} />
                {roleClaimsCopied ? "Claims Copied" : "Copy Role Claims"}
              </Button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-5">
              {[
                ["Members", users.length.toLocaleString(), users.length ? "tenant roster" : "connect SSO"],
                ["Admins", String(roleCounts.admin ?? 0), "workspace control"],
                ["Reviewers", String(reviewerCount), "governance lanes"],
                ["Builders", String(builderCount), "Skill delivery"],
                ["Provisioning", provisioningLabel, userProvisioning?.mode ?? "workspace API"],
              ].map(([label, value, helper]) => (
                <div key={label} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/70 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</div>
                  <div className={`mt-2 ${label === "Provisioning" ? "text-sm" : "text-2xl"} font-semibold text-[var(--text)]`}>{value}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{helper}</div>
                  {label === "Provisioning" ? <div className="mt-2"><Badge tone={provisioningTone}>{userProvisioning?.configured ? "token" : "manual"}</Badge></div> : null}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="block min-w-0 flex-1 text-sm font-medium text-[var(--text-muted)]">
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

            {soleAdmin ? (
              <StatusNotice tone="amber" className="mt-4" testId="sole-admin-banner">
                {soleAdmin.name} is the only workspace admin. Add another admin before changing or removing this account, or
                you could lock yourself out.
              </StatusNotice>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/70">
              {filteredUsers.length ? (
                <div className="divide-y divide-[var(--border)]">
                  {visibleUsers.map((user) => {
                    const removeDisabledReason =
                      user.role === "admin" && adminCount <= 1 ? "At least one workspace admin is required." : "";

                    return (
                      <div
                        key={user.id}
                        className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_140px_260px] md:items-center"
                        data-testid={`member-row-${user.id}`}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-[var(--text)]">{user.name}</div>
                          <div className="truncate text-xs text-[var(--text-muted)]">
                            {user.email}
                            {user.title ? <span className="hidden sm:inline"> · {user.title}</span> : null}
                          </div>
                        </div>
                        <div className="text-[var(--text-muted)]">{user.department}</div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className="truncate text-xs text-[var(--text-muted)]">{roleLabels[user.role as UserRole] ?? user.role}</span>
                          <span
                            aria-hidden="true"
                            className={`size-2 shrink-0 rounded-full ${user.role === "admin" ? "bg-[var(--success)]" : user.role.includes("reviewer") ? "bg-[var(--warning)]" : "bg-[var(--text-soft)]"}`}
                          />
                          <button
                            type="button"
                            aria-label={`Edit ${user.name} (${user.email})`}
                            title={`Edit ${user.name}`}
                            data-testid={`edit-member-${user.id}`}
                            className="min-h-8 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                            onClick={() => editMember(user)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${user.name} (${user.email})`}
                            title={removeDisabledReason || `Remove ${user.name}`}
                            data-testid={`remove-member-${user.id}`}
                            disabled={Boolean(removeDisabledReason)}
                            className={`min-h-8 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              removeDisabledReason
                                ? "cursor-not-allowed border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-soft)]"
                                : "border-[color-mix(in_srgb,var(--danger)_24%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))]"
                            }`}
                            onClick={() => onRemoveUser(user.id)}
                          >
                            Remove
                          </button>
                          {removeDisabledReason ? (
                            <span className="w-full text-right text-[11px] font-medium text-[var(--text-soft)]">
                              Last admin protected
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {filteredUsers.length > visibleUsers.length ? (
                    <div className="bg-[var(--surface-muted)]/65 px-4 py-3 text-xs font-medium text-[var(--text-muted)]">
                      +{filteredUsers.length - visibleUsers.length} additional {memberSearch ? "matching " : ""}workspace members available through search
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="p-5">
                  <div className="text-sm font-semibold text-[var(--text)]">{users.length ? "No members match this search" : "No tenant members provisioned yet"}</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    {users.length
                      ? "Adjust the member search to find a teammate by name, email, department, or role."
                      : "Connect OIDC/SSO, map enterprise groups to roles, then use SCIM or workspace import to populate users. Until then, local admin mode should only be used for development or emergency break-glass access."}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/72 p-4 lg:max-h-[920px] lg:overflow-y-auto lg:border-l lg:border-t-0 sm:p-5">
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
                <Field label="Role" hint={roleCapabilities[memberDraft.role as UserRole]}>
                  <select
                    className="input"
                    value={memberDraft.role}
                    onChange={(event) =>
                      setMemberDraft((current) => ({ ...current, role: event.target.value as User["role"] }))
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role as UserRole] ?? role}
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
                <div id="member-draft-save-disabled-reason" className="text-xs leading-5 text-[var(--text-muted)]">
                  {memberDraftSaveDisabledReason}
                </div>
              ) : null}
            </div>
            <div className="my-5 h-px bg-[var(--border)]/80" />
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
                <div key={label} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/74 p-3">
                  <div className="text-sm font-semibold text-[var(--text)]">{label}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
      <Panel id="admin-cutover" hidden={activeAdminSection !== "cutover"} className="mb-4 scroll-mt-28 overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">Launch sequence</span>
            <h2 className="text-base font-semibold">Production Cutover Sequence</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            The same readiness data is grouped into the order an enterprise launch team can actually execute.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-px bg-[var(--surface-subtle)]">
          {launchSequence.map((step, index) => (
            <div key={step.id} className="bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Phase {index + 1}</div>
                  <div className="mt-2 text-sm font-semibold text-[var(--text)]">{step.label}</div>
                </div>
                <Badge tone={launchSequenceTone[step.status]}>{step.status}</Badge>
              </div>
              <p className="mt-3 min-h-16 text-xs leading-5 text-[var(--text-muted)]">{step.summary}</p>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[var(--text-muted)]">{step.owner}</span>
                <span className="text-[var(--text-soft)]">{step.actionCount ? `${step.actionCount} open` : "clear"}</span>
              </div>
              {step.env.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {step.env.slice(0, 3).map((name) => (
                    <span key={name} className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--text-muted)]">
                      {name}
                    </span>
                  ))}
                  {step.env.length > 3 ? (
                    <span className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                      +{step.env.length - 3}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
      <Panel hidden={activeAdminSection !== "cutover"} className="mb-4 overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] px-5 py-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={manualActions.some((item) => item.severity === "blocker") ? "red" : manualActions.length ? "amber" : "green"}>
                {manualActions.length ? `${manualActions.length} actions` : "clear"}
              </Badge>
              <h2 className="text-base font-semibold">Launch Fix List</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
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
          <div className="divide-y divide-[var(--border)]">
            {manualActions.map((item, index) => (
              <div key={item.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[48px_minmax(0,1fr)_220px]">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-sm font-bold text-[var(--text-muted)]">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text)]">{item.title}</h3>
                    <Badge tone={item.severity === "blocker" ? "red" : "amber"}>{item.severity}</Badge>
                    <Badge tone="slate">{item.owner}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.action}</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{item.why}</p>
                  {item.env.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.env.slice(0, 6).map((name) => (
                        <span key={name} className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 font-mono text-[11px] font-semibold text-[var(--text-muted)]">
                          {name}
                        </span>
                      ))}
                      {item.env.length > 6 ? (
                        <span className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                          +{item.env.length - 6}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--text-muted)]">
                  <div className="font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Verify</div>
                  <div className="mt-2">{item.verify}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-sm leading-6 text-[var(--text-muted)]">
            All launch readiness checks are passing. Keep preflight in CI so this remains true as infrastructure and connectors evolve.
          </div>
        )}
      </Panel>
      <CollapsibleSection
        id="admin-maturity"
        hidden={activeAdminSection !== "maturity"}
        className="mb-4 scroll-mt-28"
        title="Primetime Launch Gate"
        summary="Release-readiness gate: passes, warnings, and blockers before primetime."
      >
        <div className="grid gap-0 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="border-b border-[var(--border)] bg-slate-950 p-5 text-white xl:border-b-0 xl:border-r">
            <Badge tone={gateTone[primetimeLaunchGate.status]}>
              {primetimeLaunchGate.status}
            </Badge>
            <h2 className="mt-3 text-base font-semibold">Primetime Launch Gate</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{primetimeLaunchGate.summary}</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-bold tracking-tight tabular-nums">{primetimeLaunchGate.score}</span>
              <span className="pb-1 text-sm font-semibold text-[var(--text-soft)]">/100</span>
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-[var(--surface)]/[0.06] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Next release action</div>
              <div className="mt-2 text-sm font-semibold">{primetimeLaunchGate.nextAction.label}</div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">{primetimeLaunchGate.nextAction.nextAction}</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[var(--surface)]/[0.06] p-3">
                <div className="text-lg font-bold tabular-nums">{primetimeLaunchGate.passes.length}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-soft)]">pass</div>
              </div>
              <div className="rounded-xl bg-[var(--surface)]/[0.06] p-3">
                <div className="text-lg font-bold tabular-nums">{primetimeLaunchGate.warnings.length}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-soft)]">warn</div>
              </div>
              <div className="rounded-xl bg-[var(--surface)]/[0.06] p-3">
                <div className="text-lg font-bold tabular-nums">{primetimeLaunchGate.blockers.length}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-soft)]">block</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px bg-[var(--surface-subtle)]">
            {primetimeLaunchGate.items.map((item) => (
              <div key={item.id} className="bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">{item.label}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">{item.requiredFor === "production" ? "Production gate" : "Pilot gate"}</div>
                  </div>
                  <Badge tone={gateItemTone[item.status]}>{item.status}</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{item.evidence}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{item.nextAction}</p>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection
        hidden={activeAdminSection !== "maturity"}
        className="mb-4"
        title="Enterprise AI OS Maturity"
        summary="Continuous self-assessment against the product bar for a global AI enablement OS."
      >
        <div className="grid gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border-b border-[var(--border)] p-5 xl:border-b-0 xl:border-r">
            <Badge tone={maturityTone[enterpriseMaturity.status]}>{enterpriseMaturity.status}</Badge>
            <h2 className="mt-3 text-base font-semibold">Enterprise AI OS Maturity</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Continuous self-assessment against the product bar for a global AI enablement operating system.
            </p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-bold tracking-tight text-[var(--text)] tabular-nums">{enterpriseMaturity.score}</span>
              <span className="pb-1 text-sm font-semibold text-[var(--text-soft)]">/100</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{enterpriseMaturity.summary}</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px bg-[var(--surface-subtle)]">
            {enterpriseMaturity.pillars.map((pillar) => (
              <div key={pillar.id} className="bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold text-[var(--text)]">{pillar.name}</div>
                  <Badge tone={maturityTone[pillar.status]}>{pillar.score}</Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pillar.score}%` }} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{pillar.nextAction}</p>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>
      <div
        id="admin-configuration"
        hidden={!["configuration", "runtime", "openclaw", "workspace"].includes(activeAdminSection)}
        className="grid scroll-mt-28 gap-4 xl:grid-cols-3"
      >
        <Panel hidden={activeAdminSection !== "configuration"} className="p-5">
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
                  className="h-10 w-12 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1"
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
                    className="size-10 shrink-0 rounded-lg border border-[var(--border)] object-contain p-1"
                  />
                ) : (
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm font-bold text-[var(--primary-contrast)]"
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
            <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
              Branding is stored with the tenant workspace and included in redacted export packets. Use an HTTPS logo URL or a
              root-relative asset path; leave it blank to use the auto-generated monogram.
            </div>
            <Button variant="secondary" onClick={saveBrandingDraft}>
              <Save size={16} />
              Save Branding
            </Button>
          </div>
        </Panel>
        <Panel hidden={activeAdminSection !== "configuration"} className="p-5">
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
              <div key={rule} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-muted)]">{rule}</div>
            ))}
          </div>
        </Panel>
        <Panel hidden={activeAdminSection !== "configuration"} className="p-5">
          <SectionTitle title="Enterprise Controls" />
          <div className="mt-4 space-y-3">
            {[
              ssoReady ? "SSO configured" : "SSO setup required",
              userProvisioning?.configured ? "SCIM provisioning ready" : "SCIM token pending",
              "Audit logs immutable",
              "PII redaction enabled",
              "Approval gates enforced",
            ].map((rule) => (
              <div key={rule} className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <LockKeyhole size={15} className="text-[var(--primary)]" />
                {rule}
              </div>
            ))}
          </div>
        </Panel>
        <Panel id="admin-runtime" hidden={activeAdminSection !== "runtime"} className="scroll-mt-28 p-5 xl:col-span-3">
          <SectionTitle title="Runtime Operations" helper="Authenticated workspace persistence, API protection, provider vault, connector broker, and workflow engine readiness" />
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="text-sm font-semibold">Persistence</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {database?.reason ?? "Workspace state loads from the server repository. Browser storage is only the offline cache."}
              </p>
              <Badge tone={database?.durable ? "green" : "amber"}>{database?.mode ?? "checking"}</Badge>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="text-sm font-semibold">Identity</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {auth?.oidcConfigured
                  ? "OIDC SSO is configured for enterprise identity."
                  : auth?.authRequired
                    ? "Signed sessions are required; connect OIDC before broad rollout."
                    : "Local admin mode is active for development."}
              </p>
              <Badge tone={auth?.oidcConfigured ? "green" : auth?.authRequired ? "amber" : "blue"}>{auth?.mode ?? "checking"}</Badge>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="text-sm font-semibold">User Lifecycle</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {userProvisioning?.reason ?? "SCIM-compatible user lifecycle sync is available through the provisioning API."}
              </p>
              <Badge tone={provisioningTone}>{userProvisioning?.mode ?? "checking"}</Badge>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="text-sm font-semibold">API Protection</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {apiProtection?.reason ?? "API mutation origin guard, payload cap, route rate limits, and request IDs are checked at the edge."}
              </p>
              <Badge tone={apiProtection?.configured ? (apiProtection.salted ? "green" : "amber") : "red"}>
                {apiProtection?.mode ?? "checking"}
              </Badge>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="text-sm font-semibold">Provider Mode</div>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={providerConfigured ? "green" : "amber"}>
                  {activeProviderLabel}
                </Badge>
                <span className="text-sm text-[var(--text-muted)]">
                  {aiSettings.defaultProvider === "local"
                    ? "deterministic local runtime active"
                    : providerConfigured
                      ? "provider credentials configured by admin"
                      : "provider credentials required"}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="text-sm font-semibold">Server Vault</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {secretVault?.reason ??
                  (serverConfiguredProviders.length > 0
                    ? `${serverConfiguredProviders.length} external providers are available from environment secrets.`
                    : "No external provider secrets are available from the server environment yet.")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={secretVault?.configured ? (secretVault.mode === "development-fallback" ? "amber" : "green") : "red"}>
                  {secretVault?.mode ?? "checking"}
                </Badge>
                {secretEvidence ? (
                  <Badge tone={secretEvidence.unsupportedSecretNames.length || secretEvidence.invalidSecretCount ? "red" : secretEvidence.tenantVaultNamesApplied || secretEvidence.configuredSecretCount === 0 ? "green" : "amber"}>
                    {secretEvidence.unsupportedSecretNames.length
                      ? `${secretEvidence.unsupportedSecretNames.length} unsupported secret${secretEvidence.unsupportedSecretNames.length === 1 ? "" : "s"}`
                      : secretEvidence.invalidSecretCount
                        ? `${secretEvidence.invalidSecretCount} invalid value${secretEvidence.invalidSecretCount === 1 ? "" : "s"}`
                      : secretEvidence.tenantVaultNamesApplied
                      ? `${secretEvidence.decryptableSecretCount}/${secretEvidence.configuredSecretCount} secret name${secretEvidence.configuredSecretCount === 1 ? "" : "s"} verified`
                      : secretEvidence.readable
                        ? `${secretEvidence.undecryptableSecretCount}/${secretEvidence.configuredSecretCount} need rotation`
                        : "secret lookup unavailable"}
                  </Badge>
                ) : null}
                {serverConfiguredProviders.slice(0, 4).map((provider) => (
                  <Badge key={provider.id} tone="green">{provider.label}</Badge>
                ))}
                {missingServerProviders.length > 0 ? <Badge tone="slate">{missingServerProviders.length} pending</Badge> : null}
              </div>
              {readinessCheckedAt ? <div className="mt-3 text-xs text-[var(--text-muted)]">Checked {readinessCheckedAt}</div> : null}
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="text-sm font-semibold">Connectors</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {connectors?.configured
                  ? "External MCP/connector broker or native connector catalog is configured."
                  : connectorCatalog?.brokerUrlConfigured
                    ? `Broker URL is set, but authentication is missing. Add ${(connectorCatalog.brokerMissingSecretNames ?? ["broker token"]).join(" or ")}.`
                    : "Policy-only connector mode is active until MCP_BROKER_URL is set."}
              </p>
              <Badge tone={connectors?.configured ? "green" : connectorCatalog?.brokerUrlConfigured ? "red" : "amber"}>{connectors?.mode ?? "checking"}</Badge>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="text-sm font-semibold">Workflow Engine</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {workflows?.configured
                  ? "External workflow engine is configured."
                  : "Local durable job ledger is active until Temporal or a workflow engine is connected."}
              </p>
              <Badge tone={workflows?.configured ? "green" : "amber"}>{workflows?.mode ?? "checking"}</Badge>
            </div>
          </div>
        </Panel>
        <Panel hidden={activeAdminSection !== "runtime"} className="p-5 xl:col-span-3" data-testid="admin-customer-launch-infrastructure">
          <SectionTitle
            title="Customer Launch Infrastructure"
            helper="The production stack needed before a real tenant connects company systems and stores customer data"
          />
          <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              {operationCards.map(([label, readiness]) => (
                <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" data-testid="admin-infrastructure-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">{label}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{readiness?.mode ?? "checking"}</div>
                    </div>
                    <Badge tone={readiness?.configured ? "green" : readinessStatus === "blocked" ? "red" : "amber"}>
                      {readiness?.configured ? "ready" : "needed"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                    {readiness?.reason ?? "Readiness has not been checked yet."}
                  </p>
                  {readiness?.evidence?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {readiness.evidence.slice(0, 3).map((item) => (
                        <span key={item} className="rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {label === "Trace Store" && harnessTraceSummary ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                      {[
                        ["Traces", harnessTraceSummary.total],
                        ["Failed", harnessTraceSummary.failed],
                        ["Prompt", `${harnessTraceSummary.promptQualityAverage}/100`],
                      ].map(([metricLabel, value]) => (
                        <div key={metricLabel} className="rounded-lg bg-[var(--surface-muted)] px-2 py-2">
                          <div className="text-sm font-bold text-[var(--text)] tabular-nums">{value}</div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{metricLabel}</div>
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
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">Connector Families</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
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
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Execution Evidence</div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[
                        ["Events", connectorEventSummary.total],
                        ["Executed", connectorEventSummary.executed],
                        ["Rehearsals", connectorEventSummary.simulated],
                        ["Enveloped", connectorEventSummary.envelopeCount],
                      ].map(([metricLabel, value]) => (
                        <div key={metricLabel} className="rounded-lg bg-[var(--surface-muted)] px-2 py-2">
                          <div className="text-sm font-bold text-[var(--text)] tabular-nums">{value}</div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{metricLabel}</div>
                        </div>
                      ))}
                    </div>
                    {connectorEventSummary.missingEnvelopeCount || connectorEventSummary.blocked ? (
                      <div className="mt-3 text-xs font-semibold text-[var(--warning)]">
                        {connectorEventSummary.missingEnvelopeCount} legacy event(s), {connectorEventSummary.blocked} blocked execution(s)
                      </div>
                    ) : (
                      <div className="mt-3 text-xs font-semibold text-[var(--success)]">
                        {connectorEventSummary.executed
                          ? "Live connector execution evidence is envelope-backed."
                          : "Policy rehearsal evidence is envelope-backed; run a live connector path before launch."}
                      </div>
                    )}
                  </div>
                ) : null}
                {(connectorCatalog?.connectors ?? []).map((connector) => (
                  <div key={connector.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--text)]">{connector.label}</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">{connector.system} · {connector.executionMode}</div>
                      </div>
                      <Badge tone={connectorStatusTone[connector.status] ?? "slate"}>{connector.status}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{connector.productionUse}</p>
                    {connector.missingSecrets.length ? (
                      <div className="mt-2 text-[11px] font-semibold text-[var(--warning)]">
                        Missing {connector.missingSecrets.slice(0, 3).join(", ")}
                        {connector.missingSecrets.length > 3 ? ` +${connector.missingSecrets.length - 3}` : ""}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] font-semibold text-[var(--success)]">Required secrets available</div>
                    )}
                  </div>
                ))}
                {!connectorCatalog?.connectors?.length ? (
                  <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
                    Connector readiness will appear after the server readiness check completes.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Panel>
        <Panel id="admin-openclaw" hidden={activeAdminSection !== "openclaw"} data-testid="admin-openclaw" className="scroll-mt-28 overflow-hidden xl:col-span-3">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">Agent gateway adapter</span>
                <Badge tone="blue">Example profile: OpenClaw</Badge>
                <Badge tone={openClawStatusTone(openClawIntegration.gateway.status)}>
                  {openClawIntegration.gateway.status.replace("_", " ")}
                </Badge>
                <Badge tone={openClawLaunchReadiness >= 80 ? "green" : "amber"}>{openClawLaunchReadiness}% launch ready</Badge>
              </div>
              <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)]">
                Enterprise setup for any connected agent gateway
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
                The sample profile shown is OpenClaw, but the same Enablement OS contract applies to any runtime adapter:
                connect the gateway, map identity, import agents, compile policy, export proof, gate updates, and report
                value before agent workflows are allowed into production.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
                {openClawIntegration.setupWizard.map((step, index) => (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => scrollToAdminSection(step.targetView === "admin" ? "access" : "openclaw")}
                    className={`group flex min-h-[142px] flex-col rounded-lg border p-3 text-left transition ${
                      step.status === "done"
                        ? "border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-[var(--success-soft)] hover:border-[color-mix(in_srgb,var(--success)_36%,var(--border))]"
                        : step.status === "next"
                          ? "border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] hover:border-[color-mix(in_srgb,var(--warning)_38%,var(--border))]"
                          : "border-[var(--border)] bg-[var(--surface)]/72 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          step.status === "done"
                            ? "bg-[var(--success)] text-[var(--primary-contrast)]"
                            : step.status === "next"
                              ? "bg-[var(--warning-soft)] text-[var(--warning)] ring-1 ring-[color-mix(in_srgb,var(--warning)_26%,var(--border))]"
                              : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                        }`}
                      >
                        {step.status === "done" ? <CheckCircle2 size={14} /> : index + 1}
                      </span>
                      <Badge tone={openClawStatusTone(step.status)}>{step.status}</Badge>
                    </span>
                    <span className="mt-3 text-sm font-semibold text-[var(--text)]">{step.label}</span>
                    <span className="mt-2 block flex-1 text-xs leading-5 text-[var(--text-muted)]">{step.body}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/72 p-5 xl:border-l xl:border-t-0">
              <SectionTitle title="Gateway settings" helper="The production controls a company admin expects." compact />
              <div className="mt-4 space-y-3">
                <Field label="Gateway URL">
                  <input aria-label="Agent gateway URL" className="input font-mono text-xs" value={openClawIntegration.gateway.url} readOnly />
                </Field>
                <Field label="Version pin">
                  <input aria-label="Agent gateway version pin" className="input font-mono text-xs" value={openClawIntegration.gateway.version} readOnly />
                </Field>
                <Field label="Auth mode">
                  <select
                    aria-label="Agent gateway auth mode"
                    aria-describedby="openclaw-auth-mode-lock-reason"
                    className="input"
                    value={openClawIntegration.gateway.authMode}
                    title="Gateway auth mode is locked by the configured adapter profile."
                    disabled
                  >
                    <option value="service-token">Service token pilot</option>
                    <option value="oidc-proxy">OIDC proxy production</option>
                  </select>
                  <p id="openclaw-auth-mode-lock-reason" className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    Locked by the connected adapter profile. Change this in the tenant integration record.
                  </p>
                </Field>
                <Field label="Sandbox mode">
                  <select
                    aria-label="Agent gateway sandbox mode"
                    aria-describedby="openclaw-sandbox-mode-lock-reason"
                    className="input"
                    value={openClawIntegration.gateway.sandboxMode}
                    title="Gateway sandbox mode is locked by the configured adapter profile."
                    disabled
                  >
                    <option value="read-only">Read-only</option>
                    <option value="approval-gated">Approval-gated writes</option>
                    <option value="restricted">Restricted</option>
                  </select>
                  <p id="openclaw-sandbox-mode-lock-reason" className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    Locked by the connected adapter profile so production tool policy stays auditable.
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
        <Panel id="admin-workspace" hidden={activeAdminSection !== "workspace"} className="scroll-mt-28 p-5 xl:col-span-3">
          <SectionTitle title="Workspace Operations" helper="Export, import, reset, and recovery controls for this tenant workspace" />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="text-sm font-semibold">Export Packet</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Download a redacted workspace packet with use cases, Skills, runs, reviews, evals, reports, and workflow state.
              </p>
              <Button variant="secondary" className="mt-4" onClick={onExport}>Export Workspace</Button>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="text-sm font-semibold">Import Packet</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Restore a tenant workspace packet. Server persistence becomes the source of truth after import.
              </p>
              <Button variant="secondary" className="mt-4" onClick={onImport}>Import Workspace</Button>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="text-sm font-semibold">Load Demo Tenant</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Populate the workspace with the Northwind Group sample portfolio — use cases, Skills, runs, reviews, evals, and a report — to explore the platform end to end.
              </p>
              <Button variant="secondary" className="mt-4" onClick={onLoadDemo}>Load Demo Tenant</Button>
            </div>
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_24%,var(--border))] bg-[var(--danger-soft)] p-4">
              <div className="text-sm font-semibold text-[var(--danger)]">Reset Workspace</div>
              <p className="mt-2 text-sm leading-6 text-[var(--danger)]">
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
