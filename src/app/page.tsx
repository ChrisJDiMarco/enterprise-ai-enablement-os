"use client";

import { addEdge, Connection, Edge, MarkerType, Node, useEdgesState, useNodesState } from "@xyflow/react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuditLog, calculatePriorityScore, clearPlatformCatalogs, ContextSource, contextSources as platformContextSources, Department, EvalResult, GovernanceReview, initialAuditLogs, initialEvalResults, initialGovernanceReviews, initialRuns, initialSkills, initialToolRequests, initialUseCases, initialWorkSignals, RiskLevel, riskToScore, Run, setPlatformCatalogs, Skill, Tool, tools, ToolRequest, UseCase, User, users as platformUsers, WorkSignal } from "@/lib/enterprise-ai-data";
import { countOpenInboxItems, deriveActionInbox, type ActionInboxItem } from "@/lib/action-inbox";
import { deriveEnterpriseMaturity } from "@/lib/enterprise-maturity";
import { deriveIntegrationBlueprint } from "@/lib/integration-blueprint";
import { deriveLaunchHandoff, type LaunchHandoffStep } from "@/lib/launch-handoff";
import { derivePrimetimeLaunchGate } from "@/lib/primetime-launch-gate";
import { runLocalHarnessSkill } from "@/lib/harness-runtime";
import { deriveCompoundLearningLoop } from "@/lib/compound-learning-loop";
import { deriveTransformationCommandSystem } from "@/lib/transformation-command-system";
import { activeCommandOrders, mergeCommandOrders, setCommandOrderStatus, type CommandOrderRecord } from "@/lib/command-orders";
import { deriveCompanyBlueprint } from "@/lib/company-blueprint";
import type { PatternMarketplaceItem } from "@/lib/pattern-marketplace";
import { AIProviderSettings, applyProviderRoutingDefaults, defaultAISettings, redactAISettingsSecrets } from "@/lib/model-router";
import type { ProviderReadiness } from "@/lib/provider-registry";
import type { TenantSecretReadinessImpact } from "@/lib/tenant-secret-readiness";
import { normalizeOrganizationSettings, type EnterpriseWorkspace, type OrganizationSettings, type WorkspaceMode } from "@/lib/workspace-schema";
import type { CommandItem, IntakeForm, OnboardingDraft, OrchestratorAction, OrchestratorMessage, HarnessMode, ProductionReadiness, View } from "@/lib/ui/types";
import { DEFAULT_TENANT_SETTINGS, navHubs, navItems, statusLabels } from "@/lib/ui/constants";
import { buildWorkspaceDocumentTitle } from "@/lib/ui/page-title";
import { normalizeAuditLog, normalizeTemporalRecords, nowStamp, todayStamp } from "@/lib/ui/format";
import { copyTextOrDownload, downloadJsonFile, timestampedExportFilename } from "@/lib/ui/export-utils";
import { readStoredValue, useClientReady, usePersistedValue, writeStoredValue } from "@/lib/ui/storage";
import { DEFAULT_EXPERIENCE_MODE, normalizeExperienceMode, type ExperienceMode } from "@/lib/ui/experience-mode";
import { DEFAULT_INTERFACE_MODE, normalizeInterfaceMode, type InterfaceMode } from "@/lib/ui/interface-mode";
import { applyBrandTheme } from "@/lib/ui/theme";
import { buildWorkspaceUrlState, parseWorkspaceUrlState, serializeWorkspaceUrlState, type WorkspaceUrlState } from "@/lib/ui/url-state";
import { providerSecretsPayload } from "@/lib/provider-secrets-payload";
import { workOpportunityToIntakeDraft, type WorkOpportunity } from "@/lib/work-intelligence";
import { buildOrchestratorAction as makeOrchestratorAction, orchestratorActionForView as actionForView, orchestratorViewFromPrompt as viewFromPrompt } from "@/lib/orchestrator-actions";
import { sanitizeOrchestratorMessagesForStorage } from "@/lib/orchestrator-message-storage";
import { parseWorkspaceImport, readBrowserWorkspace, resolveWorkspaceClientState } from "@/lib/workspace-client";
import { buildEvalRun, buildGovernanceReview, buildPatternInstall, buildUseCaseSubmission } from "@/lib/workspace-commands";
import { applyTelemetry, deriveSkillTelemetry } from "@/lib/skill-telemetry";
import type { WorkspaceCommand } from "@/lib/workspace-command-runtime";
import { buildWorkspaceExportPayload } from "@/lib/workspace-export";
import { buildDeterministicReport, buildReportMetrics, normalizeReportTemplate, reportTemplateById, type ReportTemplateId } from "@/lib/report-generator";
import type { ReportGenerationMeta } from "@/components/views/Reports";
import { removeWorkspaceUser as removeWorkspaceUserFromList, sortWorkspaceUsers, upsertWorkspaceUser as upsertWorkspaceUserInList } from "@/lib/workspace-users";
import { requestUseCaseDraft } from "@/lib/use-case-drafting";
import { draftWorkSignalFromPrompt } from "@/lib/work-signal-drafting";
import {
  commitRuntimeImportAction,
  createDefaultReportSchedulesAction,
  installLaunchPackAction,
  testRuntimeAdapterAction,
  toggleReportScheduleAction,
  type InstalledLaunchPackRecord,
  type LaunchPackTemplateId,
  type NormalizedRuntimeAssetRecord,
  type ReportScheduleRecord,
  type RuntimeAdapterManifestId,
  type RuntimeAdapterRecord,
  type RuntimeImportAuditRecord,
  type RuntimeImportJobRecord,
} from "@/lib/runtime-control-plane";

import { planClientOrchestratorResponse, type ClientOrchestratorPlan } from "@/lib/orchestrator/client-planner";
import { deriveAssistantQualityProgram, deriveConnectorPosture, deriveEvidenceQuality, deriveOperatingTimeline, deriveRoleOperatingMode, deriveWorkspaceSetupGuide } from "@/lib/enterprise-operating-intelligence";
import { normalizeWorkSignal, workSignalPrivacyIssues } from "@/lib/work-signal-policy";
import { isLegacyDemoRecord, scrubLegacyDemoRecords, scrubLegacyWorkflowEdges, scrubLegacyWorkflowNodes } from "@/lib/workflow/legacy";
import { AppOverlays, AppShell, AppViewRouter, AuthGate, BootShell } from "@/components/shell";
import { analyzeWorkflow, compileWorkflowSpec, createWorkflowNode, createWorkflowTemplate, formatWorkflowValidationSummary, getBlockDefinition, initialWorkflowEdges, initialWorkflowNodes, type WorkflowClearRequest } from "@/components/views";
import type { ConfirmActionRequest } from "@/components/modals";
import { buildDemoWorkspace, demoContextSources, demoTools, demoUsers } from "@/lib/demo/demo-workspace";
import type { AuditIntegrityVerification } from "@/lib/audit-integrity";

type ClientSessionUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: User["role"];
  department?: string;
};

type WorkspaceCommandClientPayload = {
  ok?: boolean;
  notification?: string;
  error?: string;
  workspace?: Partial<EnterpriseWorkspace>;
  result?: Record<string, unknown>;
};

type ReportGeneratePayload = {
  report?: string;
  mode?: ReportGenerationMeta["mode"];
  template?: { title?: string };
  generatedAt?: string;
  model?: {
    provider?: string;
    modelRef?: string;
    routeReason?: string;
    localFallback?: boolean;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
  };
  evidence?: ReportGenerationMeta["evidence"];
  workspace?: Partial<EnterpriseWorkspace>;
};

type TenantSecretSaveResponse = {
  detail?: string;
  error?: string;
  connectionImpact?: TenantSecretReadinessImpact;
  secretEvidence?: ProductionReadiness["secretEvidence"];
  deletedNames?: string[];
  auditLog?: AuditLog;
};

function compactImpactLabels(items: { label: string }[]) {
  if (!items.length) return "";
  if (items.length === 1) return items[0].label;
  return `${items.slice(0, 2).map((item) => item.label).join(", ")}${items.length > 2 ? `, +${items.length - 2}` : ""}`;
}

function secretSaveToast(scope: "provider" | "connector", savedCount: number, impact?: TenantSecretReadinessImpact) {
  const savedLabel = `${savedCount} ${scope} secret${savedCount === 1 ? "" : "s"} saved`;
  if (!impact) return scope === "provider" ? "AI settings saved to server vault" : `${savedLabel} to tenant vault`;

  if (scope === "provider") {
    const newlyReady = compactImpactLabels(impact.providers.newlyReady);
    if (newlyReady) return `${newlyReady} ready for routing. Run a model smoke test next.`;

    const incomplete = impact.providers.incompleteAffected[0];
    if (incomplete?.missing.length) return `${savedLabel}. Next: add ${incomplete.missing.join(", ")}.`;

    return `${savedLabel}. ${impact.providers.nextAction}`;
  }

  const newlyReady = compactImpactLabels(impact.connectors.newlyReady);
  if (newlyReady) return `${newlyReady} ready. Run a read smoke test and capture proof.`;

  const incomplete = impact.connectors.incompleteAffected[0];
  if (incomplete?.missingSecrets.length) return `${savedLabel}. Next: add ${incomplete.missingSecrets.slice(0, 2).join(", ")}.`;

  return `${savedLabel}. ${impact.connectors.nextAction}`;
}

const assistantRoutableViews = new Set<View>([...navItems.map((item) => item.id), "session"]);

function isAssistantRoutableView(value: unknown): value is View {
  return typeof value === "string" && assistantRoutableViews.has(value as View);
}

function resolveAssistantActionView(action: OrchestratorAction): View | null {
  const payloadView = action.payload?.view;
  if (isAssistantRoutableView(payloadView)) return payloadView;

  const inferredView = [action.label, typeof payloadView === "string" ? payloadView : "", action.description ?? ""]
    .map((text) => viewFromPrompt(text))
    .find((view) => isAssistantRoutableView(view));

  return inferredView ?? null;
}

const fallbackSessionUser: ClientSessionUser = {
  id: "current-user",
  organizationId: DEFAULT_TENANT_SETTINGS.id,
  name: "Workspace Admin",
  email: "admin@example.com",
  role: "admin",
  department: "AI Enablement",
};

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

const roleDisplayNames: Record<string, string> = {
  admin: "Workspace Admin",
  ai_enablement_director: "AI Enablement Director",
  ai_product_owner: "AI Product Owner",
  governance_reviewer: "Governance Reviewer",
  security_reviewer: "Security Reviewer",
  legal_reviewer: "Legal Reviewer",
  privacy_reviewer: "Privacy Reviewer",
  function_leader: "Function Leader",
  builder: "AI Builder",
  viewer: "Viewer",
};

type WorkspaceSaveStatus = "ready" | "saving" | "saved" | "local_fallback" | "rate_limited" | "restricted";

const factorySurfaceLabels: Record<string, string> = {
  overview: "Use Cases",
  intake: "Use Case Intake",
  backlog: "Use Case Backlog",
  scoring: "Use Case Scoring",
  detail: "Use Case Detail",
  pilot: "Pilot Plan",
  value: "Value Model",
};

const skillSurfaceLabels: Record<string, string> = {
  overview: "Overview",
  configuration: "Configuration",
  prompt: "Prompt",
  tools: "Tools",
  context: "Context",
  evals: "Evals",
  runs: "Runs",
  metrics: "Metrics",
  skillspec: "SkillSpec",
  versions: "Versions",
};

function buildWorkspaceSurfaceLabel({
  activeView,
  factoryTab,
  skillMode,
  skillTab,
  workflowMode,
  harnessMode,
  selectedUseCaseTitle,
  selectedSkillName,
  selectedRunId,
}: {
  activeView: View;
  factoryTab: string;
  skillMode: "overview" | "detail";
  skillTab: string;
  workflowMode: "overview" | "editor";
  harnessMode: HarnessMode;
  selectedUseCaseTitle?: string | null;
  selectedSkillName?: string | null;
  selectedRunId?: string | null;
}) {
  if (activeView === "factory") {
    const label = factorySurfaceLabels[factoryTab] ?? "Use Cases";
    if (["detail", "pilot", "value"].includes(factoryTab) && selectedUseCaseTitle) return `${label}: ${selectedUseCaseTitle}`;
    return label;
  }

  if (activeView === "skills" && skillMode === "detail") {
    const tabLabel = skillSurfaceLabels[skillTab] ?? "Overview";
    return selectedSkillName ? `${selectedSkillName}: ${tabLabel}` : `AI Skill: ${tabLabel}`;
  }

  if (activeView === "workflow") return workflowMode === "editor" ? "Guided Workflow Builder" : "Workflow Builder";

  if (activeView === "harness") {
    if (harnessMode === "runs") return "Harness Runs";
    if (harnessMode === "detail") return selectedRunId ? `Harness Run ${selectedRunId}` : "Harness Run Detail";
    return "AI Harness";
  }

  if (activeView === "session") return selectedSkillName ? `${selectedSkillName} Session` : "Skill Session";
  if (activeView === "evals" && selectedSkillName) return `Quality Evals: ${selectedSkillName}`;

  return navItems.find((item) => item.id === activeView)?.label ?? "Enterprise AI";
}

function normalizeSessionDepartment(value?: string): Department {
  if (!value) return "Other";
  if ((departmentOptions as string[]).includes(value)) return value as Department;

  const normalized = value.toLowerCase();
  if (normalized.includes("people") || normalized.includes("human") || normalized.includes("hr")) return "HR";
  if (normalized.includes("finance")) return "Finance";
  if (normalized.includes("legal")) return "Legal";
  if (normalized.includes("procurement")) return "Procurement";
  if (normalized.includes("security")) return "Security";
  if (normalized.includes("compliance")) return "Compliance";
  if (normalized.includes("data") || normalized.includes("ai") || normalized.includes("enablement")) return "Data";
  if (normalized.includes("marketing") || normalized.includes("communications")) return "Marketing";
  if (normalized.includes("it") || normalized.includes("technology")) return "IT";
  if (normalized.includes("operations")) return "Operations";
  return "Other";
}

function sessionUserToWorkspaceUser(user: ClientSessionUser | null): User {
  const session = user ?? fallbackSessionUser;
  return {
    id: session.id || fallbackSessionUser.id,
    name: session.name || fallbackSessionUser.name,
    email: (session.email || fallbackSessionUser.email).toLowerCase(),
    title: roleDisplayNames[session.role] ?? "Workspace member",
    department: normalizeSessionDepartment(session.department),
    role: session.role || "viewer",
  };
}

function mergeSessionUserIntoCatalog(users: User[], sessionUser: ClientSessionUser | null) {
  const currentUser = sessionUserToWorkspaceUser(sessionUser);
  const mutation = upsertWorkspaceUserInList(users, currentUser);
  return mutation.ok ? mutation.users : users;
}

export default function Home() {
  const clientReady = useClientReady();
  const [activeView, setActiveView] = useState<View>("command");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [urlStateHydrated, setUrlStateHydrated] = useState(false);
  const [useCases, setUseCases] = useState<UseCase[]>(initialUseCases);
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [toolRequests, setToolRequests] = useState<ToolRequest[]>(initialToolRequests);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);
  const [governanceReviews, setGovernanceReviews] = useState<GovernanceReview[]>(initialGovernanceReviews);
  const [evalResults, setEvalResults] = useState<EvalResult[]>(initialEvalResults);
  const [workSignals, setWorkSignals] = useState<WorkSignal[]>(initialWorkSignals);
  const [commandOrders, setCommandOrders] = useState<CommandOrderRecord[]>([]);
  const [runtimeAdapters, setRuntimeAdapters] = useState<RuntimeAdapterRecord[]>([]);
  const [runtimeImportJobs, setRuntimeImportJobs] = useState<RuntimeImportJobRecord[]>([]);
  const [normalizedRuntimeAssets, setNormalizedRuntimeAssets] = useState<NormalizedRuntimeAssetRecord[]>([]);
  const [installedLaunchPacks, setInstalledLaunchPacks] = useState<InstalledLaunchPackRecord[]>([]);
  const [reportSchedules, setReportSchedules] = useState<ReportScheduleRecord[]>([]);
  const [runtimeImportAudits, setRuntimeImportAudits] = useState<RuntimeImportAuditRecord[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>(platformUsers);
  const [aiSettings, setAiSettings] = useState<AIProviderSettings>(defaultAISettings);
  const [organization, setOrganization] = useState<OrganizationSettings>(DEFAULT_TENANT_SETTINGS);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("production");
  const [providerVault, setProviderVault] = useState<ProviderReadiness[]>([]);
  const [providerVaultCheckedAt, setProviderVaultCheckedAt] = useState("");
  const [productionReadiness, setProductionReadiness] = useState<ProductionReadiness | null>(null);
  const [auditIntegrity, setAuditIntegrity] = useState<AuditIntegrityVerification | null>(null);
  const [authGateRequired, setAuthGateRequired] = useState(false);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(null);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [harnessMode, setHarnessMode] = useState<HarnessMode>("overview");
  const [factoryTab, setFactoryTab] = useState("overview");
  const [workflowMode, setWorkflowMode] = useState<"overview" | "editor">("overview");
  const [skillMode, setSkillMode] = useState<"overview" | "detail">("overview");
  const [skillTab, setSkillTab] = useState("overview");
  const [toast, setToast] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>(DEFAULT_EXPERIENCE_MODE);
  const [interfaceMode, setInterfaceMode] = useState<InterfaceMode>(DEFAULT_INTERFACE_MODE);
  const [workspaceSaveStatus, setWorkspaceSaveStatus] = useState<WorkspaceSaveStatus>("ready");
  const [workspaceSavedAt, setWorkspaceSavedAt] = useState("");
  const urlSyncRef = useRef<{ hydrated: boolean; view: View | null }>({
    hydrated: false,
    view: null,
  });
  const workspaceSaveRequestRef = useRef(0);
  const [importOpen, setImportOpen] = useState(false);
  const [launchHandoffOpen, setLaunchHandoffOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<ConfirmActionRequest | null>(null);
  const [report, setReport] = useState("");
  const [reportGenerationMeta, setReportGenerationMeta] = useState<ReportGenerationMeta | null>(null);
  const [retrievalQuery, setRetrievalQuery] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [sessionFollowUp, setSessionFollowUp] = useState("");
  const [sessionReplies, setSessionReplies] = useState<string[]>([]);
  const [orchestratorMessages, setOrchestratorMessages] = useState<OrchestratorMessage[]>([]);
  const [orchestratorInput, setOrchestratorInput] = useState("");
  const [orchestratorBusy, setOrchestratorBusy] = useState(false);
  const executedOrchestratorActionIdsRef = useRef<Set<string>>(new Set());
  const [expandedHubs, setExpandedHubs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navHubs.map((hub) => [hub.id, true])),
  );
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<"Saved" | "Testing" | "Published">("Saved");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    initialWorkflowNodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialWorkflowEdges,
  );
  const [intakeStep, setIntakeStep] = useState(0);
  const [intake, setIntake] = useState<IntakeForm>({
    title: "",
    department: "Operations",
    businessProblem: "",
    currentProcess: "",
    desiredOutcome: "",
    aiHelp: "",
    aiNotDo: "",
    monthlyVolume: 0,
    avgHandlingTimeMinutes: 0,
    estimatedUsers: 0,
    dataSensitivity: "low",
    dataSources: "",
    humanReview: false,
    externalCommunication: false,
  });

  const selectedUseCase = useCases.find((item) => item.id === selectedUseCaseId) ?? useCases[0] ?? null;
  // Real value telemetry: derive each Skill's runs/adopters/value from the actual
  // run ledger + the linked use case's ROI assumptions, instead of stored guesses.
  // Demo stays seeded (illustrative); production grows from real activity.
  const reconciledSkills = useMemo(() => {
    const illustrative = workspaceMode === "demo";
    return skills.map((skill) =>
      applyTelemetry(
        skill,
        deriveSkillTelemetry(
          skill,
          runs,
          skill.useCaseId ? useCases.find((useCase) => useCase.id === skill.useCaseId) : undefined,
          { illustrative },
        ),
      ),
    );
  }, [skills, runs, useCases, workspaceMode]);

  const selectedSkill = reconciledSkills.find((item) => item.id === selectedSkillId) ?? reconciledSkills[0] ?? null;
  const selectedRun = runs.find((item) => item.id === selectedRunId) ?? runs[0] ?? null;
  const activeSurfaceLabel = useMemo(
    () =>
      buildWorkspaceSurfaceLabel({
        activeView,
        factoryTab,
        skillMode,
        skillTab,
        workflowMode,
        harnessMode,
        selectedUseCaseTitle: selectedUseCase?.title,
        selectedSkillName: selectedSkill?.name,
        selectedRunId: selectedRun?.id,
      }),
    [
      activeView,
      factoryTab,
      harnessMode,
      selectedRun?.id,
      selectedSkill?.name,
      selectedUseCase?.title,
      skillMode,
      skillTab,
      workflowMode,
    ],
  );
  const activeNavView: View = activeView === "session" ? "skills" : activeView;
  const activeHubId = navHubs.find((hub) => hub.items.includes(activeNavView))?.id ?? "command";
  const currentWorkspaceUser = useMemo(() => sessionUserToWorkspaceUser(sessionUser), [sessionUser]);
  const currentUserId = currentWorkspaceUser.id;
  const currentUserName = currentWorkspaceUser.name;
  const currentUserEmail = currentWorkspaceUser.email;

  const applyUrlState = useCallback((state: WorkspaceUrlState) => {
    const nextView = state.view ?? "command";
    setActiveView(nextView);

    if (nextView === "factory") {
      setFactoryTab(state.factoryTab ?? "overview");
      setSelectedUseCaseId(state.useCaseId ?? "");
    }

    if (nextView === "skills") {
      setSkillMode(state.skillMode ?? "overview");
      setSkillTab(state.skillTab ?? "overview");
      setSelectedSkillId(state.skillId ?? "");
    }

    if (nextView === "session" || nextView === "evals") {
      setSkillMode("detail");
      setSkillTab(state.skillTab ?? "overview");
      setSelectedSkillId(state.skillId ?? "");
    }

    if (nextView === "harness") {
      setHarnessMode(state.harnessMode ?? "overview");
      setSelectedRunId(state.runId ?? "");
    }

    if (nextView === "workflow") {
      setWorkflowMode(state.workflowMode ?? "overview");
    }

    if (nextView === "broker") {
      setSelectedRunId(state.runId ?? "");
    }
  }, []);

  const applyWorkspaceSnapshot = useCallback(
    (
      workspace: Partial<EnterpriseWorkspace>,
      localAISettings: AIProviderSettings,
      fallbackWorkspaceMode: WorkspaceMode,
      activeSessionUser: ClientSessionUser | null,
    ) => {
      const resolvedWorkspace = resolveWorkspaceClientState(workspace, localAISettings, fallbackWorkspaceMode);
      const resolvedCatalogs = {
        ...resolvedWorkspace.catalogs,
        users: mergeSessionUserIntoCatalog(resolvedWorkspace.catalogs.users, activeSessionUser),
      };

      setPlatformCatalogs(resolvedCatalogs);
      setWorkspaceUsers(resolvedCatalogs.users);
      setWorkspaceMode(resolvedWorkspace.workspaceMode);
      setOrganization(resolvedWorkspace.organization);
      setUseCases(resolvedWorkspace.useCases);
      setSkills(resolvedWorkspace.skills);
      setRuns(resolvedWorkspace.runs);
      setToolRequests(resolvedWorkspace.toolRequests);
      setAuditLogs(resolvedWorkspace.auditLogs);
      setGovernanceReviews(resolvedWorkspace.governanceReviews);
      setEvalResults(resolvedWorkspace.evalResults);
      setWorkSignals(resolvedWorkspace.workSignals);
      setCommandOrders(resolvedWorkspace.commandOrders);
      setRuntimeAdapters(resolvedWorkspace.runtimeAdapters);
      setRuntimeImportJobs(resolvedWorkspace.runtimeImportJobs);
      setNormalizedRuntimeAssets(resolvedWorkspace.normalizedRuntimeAssets);
      setInstalledLaunchPacks(resolvedWorkspace.installedLaunchPacks);
      setReportSchedules(resolvedWorkspace.reportSchedules);
      setRuntimeImportAudits(resolvedWorkspace.runtimeImportAudits);
      setAiSettings(resolvedWorkspace.aiSettings);
      setWorkflowStatus(resolvedWorkspace.workflowStatus);
      setNodes(resolvedWorkspace.workflowNodes);
      setEdges(resolvedWorkspace.workflowEdges);
      setReport(resolvedWorkspace.report);
    },
    [setEdges, setNodes],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateWorkspace() {
      const browserWorkspace = readBrowserWorkspace();
      let sourceWorkspace: Partial<EnterpriseWorkspace> = browserWorkspace.workspace;
      let activeSessionUser: ClientSessionUser | null = null;

      try {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as { workspace?: Partial<EnterpriseWorkspace> };
          if (payload.workspace) {
            sourceWorkspace = payload.workspace;
          }
        } else if (response.status === 401) {
          const readinessResponse = await fetch("/api/readiness", { cache: "no-store" }).catch(() => null);
          const readiness = readinessResponse?.ok
            ? ((await readinessResponse.json()) as ProductionReadiness)
            : null;
          if (!cancelled) {
            setProductionReadiness(readiness);
            setAuthGateRequired(true);
            setHasHydrated(true);
          }
          return;
        }
      } catch {
        sourceWorkspace = browserWorkspace.workspace;
      }

      try {
        const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
        if (sessionResponse.ok) {
          const payload = (await sessionResponse.json()) as {
            authenticated?: boolean;
            session?: { user?: ClientSessionUser } | null;
          };
          activeSessionUser = payload.authenticated && payload.session?.user ? payload.session.user : null;
        }
      } catch {
        activeSessionUser = null;
      }

      if (cancelled) return;
      setAuthGateRequired(false);
      setSessionUser(activeSessionUser);
      applyWorkspaceSnapshot(sourceWorkspace, browserWorkspace.localAISettings, browserWorkspace.workspace.workspaceMode ?? "production", activeSessionUser);
      setOrchestratorMessages(
        sanitizeOrchestratorMessagesForStorage(
          readStoredValue<OrchestratorMessage[]>("eaieos:orchestratorMessages", []),
          {
            storePrompts: browserWorkspace.localAISettings.storePrompts,
            storeToolPayloads: browserWorkspace.localAISettings.storeToolPayloads,
          },
        ),
      );
      setOnboardingComplete(readStoredValue("eaieos:onboardingComplete", false));
      setOnboardingDismissed(readStoredValue("eaieos:onboardingDismissed", false));
      setExperienceMode(normalizeExperienceMode(readStoredValue("eaieos:experienceMode", DEFAULT_EXPERIENCE_MODE)));
      setInterfaceMode(normalizeInterfaceMode(readStoredValue("eaieos:interfaceMode", DEFAULT_INTERFACE_MODE)));
      applyUrlState(parseWorkspaceUrlState(window.location.search));
      setUrlStateHydrated(true);
      setHasHydrated(true);
    }

    void hydrateWorkspace();

    return () => {
      cancelled = true;
    };
  }, [applyUrlState, applyWorkspaceSnapshot]);

  useEffect(() => {
    if (!clientReady || !hasHydrated || urlStateHydrated) return;
    const timer = window.setTimeout(() => {
      applyUrlState(parseWorkspaceUrlState(window.location.search));
      setUrlStateHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [applyUrlState, clientReady, hasHydrated, urlStateHydrated]);

  useEffect(() => {
    if (!clientReady || !hasHydrated) return;

    function handlePopState() {
      applyUrlState(parseWorkspaceUrlState(window.location.search));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [applyUrlState, clientReady, hasHydrated]);

  useEffect(() => {
    if (!clientReady || !hasHydrated || !urlStateHydrated) return;

    const state = buildWorkspaceUrlState({
      view: activeView,
      factoryTab,
      skillMode,
      skillTab,
      harnessMode,
      workflowMode,
      selectedUseCaseId,
      selectedSkillId,
      selectedRunId,
    });
    const nextSearch = serializeWorkspaceUrlState(state, window.location.search);
    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const urlSync = urlSyncRef.current;
    if (nextUrl !== currentUrl) {
      const historyMethod = urlSync.hydrated && urlSync.view !== activeView ? "pushState" : "replaceState";
      window.history[historyMethod]({ enterpriseAIEnablementOS: true }, "", nextUrl);
    }
    urlSyncRef.current = { hydrated: true, view: activeView };
  }, [
    activeView,
    clientReady,
    factoryTab,
    harnessMode,
    hasHydrated,
    selectedRunId,
    selectedSkillId,
    selectedUseCaseId,
    skillMode,
    skillTab,
    urlStateHydrated,
    workflowMode,
  ]);

  useEffect(() => {
    if (!clientReady || !hasHydrated || !urlStateHydrated) return;

    document.title = buildWorkspaceDocumentTitle({
      surface: activeSurfaceLabel,
      organizationName: organization.name,
    });
  }, [activeSurfaceLabel, clientReady, hasHydrated, organization.name, urlStateHydrated]);

  useEffect(() => {
    let cancelled = false;

    async function loadProviderVault() {
      try {
        const [providerResponse, readinessResponse] = await Promise.all([
          fetch("/api/providers", { cache: "no-store" }),
          fetch("/api/readiness", { cache: "no-store" }),
        ]);
        if (!providerResponse.ok) return;
        const payload = (await providerResponse.json()) as {
          generatedAt?: string;
          providers?: ProviderReadiness[];
        };
        const readiness = readinessResponse.ok
          ? ((await readinessResponse.json()) as ProductionReadiness)
          : null;
        if (cancelled) return;
        setProviderVault(payload.providers ?? []);
        setProductionReadiness(readiness);
        setProviderVaultCheckedAt(payload.generatedAt ? new Date(payload.generatedAt).toLocaleTimeString() : nowStamp());
      } catch {
        if (!cancelled) {
          setProviderVault([]);
          setProductionReadiness(null);
          setProviderVaultCheckedAt("");
        }
      }
    }

    loadProviderVault();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  // Single-value persistence — one reusable hook instead of 16 identical effects.
  usePersistedValue(hasHydrated, "eaieos:useCases", useCases);
  usePersistedValue(hasHydrated, "eaieos:skills", skills);
  usePersistedValue(hasHydrated, "eaieos:runs", runs);
  usePersistedValue(hasHydrated, "eaieos:toolRequests", toolRequests);
  usePersistedValue(hasHydrated, "eaieos:auditLogs", auditLogs);
  usePersistedValue(hasHydrated, "eaieos:governanceReviews", governanceReviews);
  usePersistedValue(hasHydrated, "eaieos:evalResults", evalResults);
  usePersistedValue(hasHydrated, "eaieos:workSignals", workSignals);
  usePersistedValue(hasHydrated, "eaieos:commandOrders", commandOrders);
  usePersistedValue(hasHydrated, "eaieos:runtimeAdapters", runtimeAdapters);
  usePersistedValue(hasHydrated, "eaieos:runtimeImportJobs", runtimeImportJobs);
  usePersistedValue(hasHydrated, "eaieos:normalizedRuntimeAssets", normalizedRuntimeAssets);
  usePersistedValue(hasHydrated, "eaieos:installedLaunchPacks", installedLaunchPacks);
  usePersistedValue(hasHydrated, "eaieos:reportSchedules", reportSchedules);
  usePersistedValue(hasHydrated, "eaieos:runtimeImportAudits", runtimeImportAudits);
  usePersistedValue(hasHydrated, "eaieos:organization", organization);
  usePersistedValue(hasHydrated, "eaieos:workspaceMode", workspaceMode);
  usePersistedValue(hasHydrated, "eaieos:workflowNodes", nodes);
  usePersistedValue(hasHydrated, "eaieos:workflowEdges", edges);
  usePersistedValue(hasHydrated, "eaieos:workflowStatus", workflowStatus);
  usePersistedValue(hasHydrated, "eaieos:report", report);
  const persistedOrchestratorMessages = useMemo(
    () => sanitizeOrchestratorMessagesForStorage(
      orchestratorMessages,
      {
        storePrompts: aiSettings.storePrompts,
        storeToolPayloads: aiSettings.storeToolPayloads,
      },
    ),
    [aiSettings.storePrompts, aiSettings.storeToolPayloads, orchestratorMessages],
  );
  usePersistedValue(hasHydrated, "eaieos:orchestratorMessages", persistedOrchestratorMessages);
  usePersistedValue(hasHydrated, "eaieos:experienceMode", experienceMode);
  usePersistedValue(hasHydrated, "eaieos:interfaceMode", interfaceMode);

  // aiSettings persists a redacted copy (transform), so it keeps a dedicated
  // effect keyed on the source value rather than the per-render redacted object.
  useEffect(() => {
    if (!hasHydrated) return;
    writeStoredValue("eaieos:aiSettings", redactAISettingsSecrets(aiSettings));
  }, [aiSettings, hasHydrated]);

  // Multi-key effect with a custom dependency set — kept explicit.
  useEffect(() => {
    if (!hasHydrated) return;
    writeStoredValue("eaieos:users", workspaceUsers);
    writeStoredValue("eaieos:tools", tools);
    writeStoredValue("eaieos:contextSources", platformContextSources);
  }, [hasHydrated, workspaceUsers, skills.length, useCases.length]);

  useEffect(() => {
    applyBrandTheme(organization.primaryColor);
  }, [organization.primaryColor]);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStoredValue("eaieos:onboardingComplete", onboardingComplete);
    writeStoredValue("eaieos:onboardingDismissed", onboardingDismissed);
  }, [hasHydrated, onboardingComplete, onboardingDismissed]);

  useEffect(() => {
    if (!hasHydrated || onboardingComplete || onboardingDismissed || onboardingOpen) return;
    const workspaceIsEmpty =
      useCases.length === 0 &&
      skills.length === 0 &&
      runs.length === 0 &&
      workSignals.length === 0 &&
      auditLogs.length === 0;
    if (workspaceIsEmpty) {
      const frame = window.requestAnimationFrame(() => setOnboardingOpen(true));
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [
    auditLogs.length,
    hasHydrated,
    onboardingComplete,
    onboardingDismissed,
    onboardingOpen,
    runs.length,
    skills.length,
    useCases.length,
    workSignals.length,
  ]);

  const workspaceSnapshot = useMemo(
    () => ({
      schema: "enterprise-ai-enablement-os.workspace.v1",
      organizationId: organization.id,
      workspaceMode,
      organization,
      users: workspaceUsers,
      tools,
      contextSources: platformContextSources,
      useCases,
      skills: reconciledSkills,
      runs,
      toolRequests,
      auditLogs,
      governanceReviews,
      evalResults,
      workSignals,
      commandOrders,
      runtimeAdapters,
      runtimeImportJobs,
      normalizedRuntimeAssets,
      installedLaunchPacks,
      reportSchedules,
      runtimeImportAudits,
      workflow: {
        status: workflowStatus,
        nodes,
        edges,
      },
      report,
      aiSettings: redactAISettingsSecrets(aiSettings),
    }),
    [
      aiSettings,
      auditLogs,
      commandOrders,
      edges,
      evalResults,
      governanceReviews,
      installedLaunchPacks,
      nodes,
      normalizedRuntimeAssets,
      organization,
      report,
      reportSchedules,
      runtimeAdapters,
      runtimeImportAudits,
      runtimeImportJobs,
      runs,
      reconciledSkills,
      toolRequests,
      useCases,
      workflowStatus,
      workSignals,
      workspaceMode,
      workspaceUsers,
    ],
  );

  useEffect(() => {
    if (!hasHydrated) return;
    const requestId = workspaceSaveRequestRef.current + 1;
    workspaceSaveRequestRef.current = requestId;

    const timeout = window.setTimeout(() => {
      setWorkspaceSaveStatus("saving");
      fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workspaceSnapshot),
      })
        .then((response) => {
          if (workspaceSaveRequestRef.current !== requestId) return;

          if (response.ok) {
            setWorkspaceSaveStatus("saved");
            setWorkspaceSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
            return;
          }

          if (response.status === 401 || response.status === 403) {
            setWorkspaceSaveStatus("restricted");
            return;
          }

          if (response.status === 429) {
            setWorkspaceSaveStatus("rate_limited");
            return;
          }

          setWorkspaceSaveStatus("local_fallback");
        })
        .catch(() => {
          if (workspaceSaveRequestRef.current !== requestId) return;
          setWorkspaceSaveStatus("local_fallback");
        });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [hasHydrated, workspaceSnapshot]);

  async function runWorkspaceCommand(command: WorkspaceCommand): Promise<WorkspaceCommandClientPayload | null> {
    try {
      await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workspaceSnapshot),
      }).catch(() => {
        // The command call below will either operate on server state or fall back locally.
      });

      const response = await fetch("/api/workspace/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceCommandClientPayload | null;
      if (!response.ok || !payload?.ok) return null;

      if (payload.workspace) {
        applyWorkspaceSnapshot(payload.workspace, aiSettings, payload.workspace.workspaceMode ?? workspaceMode, sessionUser);
      }
      if (payload.notification) notify(payload.notification);
      return payload;
    } catch {
      return null;
    }
  }

  function appendControlPlaneAudit(log: AuditLog) {
    setAuditLogs((current) => [normalizeAuditLog(log), ...current.filter((item) => item.id !== log.id)]);
  }

  function testRuntimeAdapter(manifestId: RuntimeAdapterManifestId) {
    const result = testRuntimeAdapterAction({
      manifestId,
      adapters: runtimeAdapters,
      importJobs: runtimeImportJobs,
      importAudits: runtimeImportAudits,
    });
    setRuntimeAdapters(result.adapters);
    setRuntimeImportJobs(result.importJobs);
    setRuntimeImportAudits(result.importAudits);
    appendControlPlaneAudit(result.auditLog);
    notify(`${result.adapters.find((adapter) => adapter.manifestId === manifestId)?.name ?? "Runtime"} adapter tested and proof logged.`);
  }

  function commitRuntimeImport(manifestId: RuntimeAdapterManifestId) {
    const result = commitRuntimeImportAction({
      manifestId,
      adapters: runtimeAdapters,
      importJobs: runtimeImportJobs,
      runtimeAssets: normalizedRuntimeAssets,
      importAudits: runtimeImportAudits,
    });
    setRuntimeAdapters(result.adapters);
    setRuntimeImportJobs(result.importJobs);
    setNormalizedRuntimeAssets(result.runtimeAssets);
    setRuntimeImportAudits(result.importAudits);
    appendControlPlaneAudit(result.auditLog);
    notify(`${result.runtimeAssets.filter((asset) => asset.manifestId === manifestId).length} runtime assets imported with proof.`);
  }

  function installLaunchPack(templateId: LaunchPackTemplateId) {
    const result = installLaunchPackAction({
      templateId,
      installedPacks: installedLaunchPacks,
      reportSchedules,
      importAudits: runtimeImportAudits,
    });
    setInstalledLaunchPacks(result.installedPacks);
    setReportSchedules(result.reportSchedules);
    setRuntimeImportAudits(result.importAudits);
    appendControlPlaneAudit(result.auditLog);
    notify(`${result.installedPacks.find((pack) => pack.templateId === templateId)?.title ?? "Launch pack"} installed with proof.`);
  }

  function createDefaultReportSchedules() {
    const result = createDefaultReportSchedulesAction({
      reportSchedules,
      importAudits: runtimeImportAudits,
    });
    setReportSchedules(result.reportSchedules);
    setRuntimeImportAudits(result.importAudits);
    appendControlPlaneAudit(result.auditLog);
    notify("Default report schedules created with proof.");
  }

  function toggleReportSchedule(scheduleId: string) {
    const result = toggleReportScheduleAction({
      scheduleId,
      reportSchedules,
      importAudits: runtimeImportAudits,
    });
    if (!result) return;
    setReportSchedules(result.reportSchedules);
    setRuntimeImportAudits(result.importAudits);
    appendControlPlaneAudit(result.auditLog);
    notify("Report schedule updated and proof logged.");
  }

  const metrics = useMemo(() => {
    const activePilots = useCases.filter((item) =>
      ["approved_for_pilot", "in_pilot", "measuring"].includes(item.status),
    ).length;
    const annualValue = skills.reduce((sum, skill) => sum + skill.valueDelivered, 0);
    const openRisk = useCases.filter((item) => ["high", "restricted"].includes(item.riskLevel)).length;
    const adoptionUsers = skills.reduce((sum, skill) => sum + skill.adoptionCount, 0);

    return {
      totalUseCases: useCases.length,
      activePilots,
      skills: skills.length,
      adoptionRate: Math.min(92, Math.round(adoptionUsers / 145)),
      hoursSaved: Math.round(annualValue / 68),
      riskItemsOpen: openRisk,
      annualValue,
    };
  }, [skills, useCases]);

  const functionData = useMemo(() => {
    const counts = useCases.reduce<Record<string, number>>((acc, item) => {
      acc[item.department] = (acc[item.department] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [useCases]);

  const statusData = useMemo(() => {
    const ordered = ["triage", "discovery", "governance_review", "approved_for_pilot", "in_pilot", "measuring", "scaled"];
    return ordered.map((status) => ({
      name: statusLabels[status],
      value: useCases.filter((item) => item.status === status).length,
    }));
  }, [useCases]);

  const workflowValidation = useMemo(() => analyzeWorkflow(nodes, edges), [edges, nodes]);
  const enterpriseMaturity = useMemo(
    () =>
      deriveEnterpriseMaturity({
        useCases,
        skills,
        runs,
        toolRequests,
        auditLogs,
        governanceReviews,
        evalResults,
        workSignals,
        tools,
        contextSources: platformContextSources,
        report,
        metrics,
        workflow: {
          nodeCount: nodes.length,
          status: workflowStatus,
          valid: workflowValidation.valid,
          issues: workflowValidation.issues.length,
          warnings: workflowValidation.warnings.length,
        },
        productionReadiness,
      }),
    [
      auditLogs,
      evalResults,
      governanceReviews,
      metrics,
      nodes.length,
      productionReadiness,
      report,
      runs,
      skills,
      toolRequests,
      useCases,
      workflowStatus,
      workflowValidation,
      workSignals,
    ],
  );
  const actionInboxItems = useMemo(
    () =>
      deriveActionInbox({
        useCases,
        skills,
        runs,
        toolRequests,
        governanceReviews,
        evalResults,
        auditLogs,
        report,
        metrics,
        workflow: {
          nodeCount: nodes.length,
          status: workflowStatus,
          valid: workflowValidation.valid,
          issues: workflowValidation.issues.length,
          warnings: workflowValidation.warnings.length,
          firstIssue: workflowValidation.issues[0]?.message ?? workflowValidation.warnings[0]?.message ?? "",
        },
      }),
    [
      auditLogs,
      evalResults,
      governanceReviews,
      metrics,
      nodes.length,
      report,
      runs,
      skills,
      toolRequests,
      useCases,
      workflowStatus,
      workflowValidation,
    ],
  );
  const actionInboxOpenCount = countOpenInboxItems(actionInboxItems);
  const profileDisplayName = currentUserName;
  const profileModeLabel =
    workspaceMode === "production"
      ? `${currentWorkspaceUser.title} · ${currentUserEmail}`
      : `Demo sandbox · ${currentWorkspaceUser.title}`;
  const integrationBlueprint = useMemo(
    () =>
      deriveIntegrationBlueprint({
        tools,
        contextSources: platformContextSources,
        useCases,
        skills,
        runs,
        toolRequests,
        productionReadiness,
      }),
    [productionReadiness, runs, skills, toolRequests, useCases],
  );
  const compoundLearningLoop = useMemo(
    () =>
      deriveCompoundLearningLoop({
        useCases,
        skills,
        runs,
        toolRequests,
        auditLogs,
        governanceReviews,
        evalResults,
        workSignals,
        report,
        metrics,
        workflow: {
          nodeCount: nodes.length,
          status: workflowStatus,
          valid: workflowValidation.valid,
        },
      }),
    [
      auditLogs,
      evalResults,
      governanceReviews,
      metrics,
      nodes.length,
      report,
      runs,
      skills,
      toolRequests,
      useCases,
      workflowStatus,
      workflowValidation.valid,
      workSignals,
    ],
  );
  const transformationCommand = useMemo(
    () =>
      deriveTransformationCommandSystem({
        useCases,
        skills,
        runs,
        toolRequests,
        governanceReviews,
        evalResults,
        auditLogs,
        workSignals,
        report,
        metrics,
        workflow: {
          nodeCount: nodes.length,
          status: workflowStatus,
          valid: workflowValidation.valid,
          issues: workflowValidation.issues.length,
        },
      }),
    [
      auditLogs,
      evalResults,
      governanceReviews,
      metrics,
      nodes.length,
      report,
      runs,
      skills,
      toolRequests,
      useCases,
      workflowStatus,
      workflowValidation.issues.length,
      workflowValidation.valid,
      workSignals,
    ],
  );

  useEffect(() => {
    if (!hasHydrated) return;
    const frame = window.requestAnimationFrame(() => {
      setCommandOrders((current) => mergeCommandOrders(current, transformationCommand));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasHydrated, transformationCommand]);

  const companyBlueprint = useMemo(
    () =>
      deriveCompanyBlueprint({
        organization,
        useCases,
        skills,
        runs,
        toolRequests,
        governanceReviews,
        evalResults,
        workSignals,
        tools,
        contextSources: platformContextSources,
        metrics,
        workflow: {
          nodeCount: nodes.length,
          status: workflowStatus,
          valid: workflowValidation.valid,
        },
        enterpriseMaturity,
        integrationBlueprint,
      }),
    [
      enterpriseMaturity,
      evalResults,
      governanceReviews,
      integrationBlueprint,
      metrics,
      nodes.length,
      organization,
      runs,
      skills,
      toolRequests,
      useCases,
      workflowStatus,
      workflowValidation.valid,
      workSignals,
    ],
  );
  const launchHandoff = useMemo(
    () =>
      deriveLaunchHandoff({
        organizationName: organization.name,
        useCases,
        skills,
        runs,
        governanceReviews,
        evalResults,
        report,
        workflow: {
          nodeCount: nodes.length,
          status: workflowStatus,
          valid: workflowValidation.valid,
          issues: workflowValidation.issues.length,
        },
      }),
    [
      evalResults,
      governanceReviews,
      nodes.length,
      organization.name,
      report,
      runs,
      skills,
      useCases,
      workflowStatus,
      workflowValidation.issues.length,
      workflowValidation.valid,
    ],
  );
  const primetimeLaunchGate = useMemo(
    () =>
      derivePrimetimeLaunchGate({
        useCases,
        skills,
        runs,
        governanceReviews,
        evalResults,
        report,
        productionReadiness,
        enterpriseMaturity,
        integrationBlueprint,
        workflow: {
          nodeCount: nodes.length,
          valid: workflowValidation.valid,
          issues: workflowValidation.issues.length,
          status: workflowStatus,
        },
      }),
    [
      enterpriseMaturity,
      evalResults,
      governanceReviews,
      integrationBlueprint,
      nodes.length,
      productionReadiness,
      report,
      runs,
      skills,
      useCases,
      workflowStatus,
      workflowValidation.issues.length,
      workflowValidation.valid,
    ],
  );

  const evidenceQuality = useMemo(
    () =>
      deriveEvidenceQuality({
        auditLogs,
        runs,
        evalResults,
        governanceReviews,
        useCases,
        skills,
        workSignals,
      }),
    [auditLogs, evalResults, governanceReviews, runs, skills, useCases, workSignals],
  );
  const operatingTimeline = useMemo(
    () =>
      deriveOperatingTimeline({
        auditLogs,
        runs,
        evalResults,
        governanceReviews,
        useCases,
        skills,
        workSignals,
      }),
    [auditLogs, evalResults, governanceReviews, runs, skills, useCases, workSignals],
  );
  const connectorPosture = deriveConnectorPosture({
    productionReadiness,
    tools,
    contextSources: platformContextSources,
  });
  const roleProfile = useMemo(() => deriveRoleOperatingMode(sessionUser?.role ?? "viewer"), [sessionUser?.role]);
  const setupGuide = deriveWorkspaceSetupGuide({
    auditLogs,
    runs,
    governanceReviews,
    useCases,
    skills,
    workSignals,
    tools,
    contextSources: platformContextSources,
  });
  const assistantQuality = useMemo(
    () =>
      deriveAssistantQualityProgram({
        evidenceQuality,
        hasActionButtons: true,
        hasSafeActionGates: true,
        hasInterpretationEvidence: true,
        hasWorkspaceContext: true,
      }),
    [evidenceQuality],
  );

  const orchestratorWorkspace = useMemo(
    () => ({
      metrics,
      counts: {
        useCases: useCases.length,
        skills: skills.length,
        runs: runs.length,
        toolRequests: toolRequests.length,
        pendingToolRequests: toolRequests.filter((request) => request.status === "pending").length,
        auditLogs: auditLogs.length,
        governanceReviews: governanceReviews.length,
        evalResults: evalResults.length,
        workSignals: workSignals.length,
        commandOrders: commandOrders.length,
      },
      commandOrders: activeCommandOrders(commandOrders).slice(0, 8).map((order) => ({
        id: order.id,
        title: order.title,
        status: order.status,
        priority: order.priority,
        targetView: order.targetView,
        dueDate: order.dueDate,
        confidence: order.confidence,
      })),
      topUseCases: [...useCases]
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, 8)
        .map((item) => ({
          id: item.id,
          title: item.title,
          department: item.department,
          status: item.status,
          riskLevel: item.riskLevel,
          priorityScore: item.priorityScore,
          linkedSkillId: item.linkedSkillId,
        })),
      skills: skills.slice(0, 8).map((skill) => ({
        id: skill.id,
        name: skill.name,
        department: skill.department,
        status: skill.status,
        riskLevel: skill.riskLevel,
        autonomyTier: skill.autonomyTier,
        evalPassRate: skill.evalPassRate,
        allowedTools: skill.allowedTools.length,
        contextSources: skill.contextSources.length,
        runs: skill.runs,
      })),
      recentRuns: runs.slice(0, 8).map((run) => ({
        id: run.id,
        skillId: run.skillId,
        status: run.status,
        riskLevel: run.riskLevel,
        currentStage: run.currentStage,
        startedAt: run.startedAt,
      })),
      governanceReviews: governanceReviews.slice(0, 8).map((review) => ({
        id: review.id,
        title: review.title,
        status: review.status,
        riskLevel: review.riskLevel,
        blockers: review.blockers,
      })),
      evalResults: evalResults.slice(0, 8).map((result) => ({
        id: result.id,
        skillId: result.skillId,
        score: result.score,
        passed: result.passed,
        criticalFailures: result.criticalFailures,
      })),
      workSignals: workSignals.slice(0, 8).map((signal) => ({
        id: signal.id,
        source: signal.source,
        eventType: signal.eventType,
        department: signal.department,
        process: signal.process,
        riskLevel: signal.riskLevel,
        summary: signal.summary,
      })),
      actionInbox: actionInboxItems.slice(0, 8).map((item) => ({
        id: item.id,
        severity: item.severity,
        title: item.title,
        body: item.body,
        targetView: item.targetView,
        targetId: item.targetId,
      })),
      primetimeLaunchGate: {
        score: primetimeLaunchGate.score,
        status: primetimeLaunchGate.status,
        summary: primetimeLaunchGate.summary,
        nextAction: {
          label: primetimeLaunchGate.nextAction.label,
          targetView: primetimeLaunchGate.nextAction.targetView,
          nextAction: primetimeLaunchGate.nextAction.nextAction,
        },
        blockers: primetimeLaunchGate.blockers.map((item) => item.label).slice(0, 6),
        warnings: primetimeLaunchGate.warnings.map((item) => item.label).slice(0, 6),
      },
      companyBlueprint: {
        score: companyBlueprint.score,
        stage: companyBlueprint.stage,
        archetype: companyBlueprint.archetype,
        summary: companyBlueprint.summary,
        firstMove: {
          title: companyBlueprint.firstMove.title,
          targetView: companyBlueprint.firstMove.targetView,
          detail: companyBlueprint.firstMove.detail,
        },
        functions: companyBlueprint.functionRollout
          .filter((item) => item.status !== "monitor" || item.score > 0)
          .map((item) => ({
            department: item.department,
            status: item.status,
            score: item.score,
            nextAction: item.nextAction,
          }))
          .slice(0, 8),
        connections: companyBlueprint.connections.map((connection) => ({
          name: connection.name,
          readiness: connection.readiness,
          score: connection.score,
          targetView: connection.targetView,
        })),
      },
      workflow: {
        status: workflowStatus,
        nodes: nodes.length,
        edges: edges.length,
        valid: workflowValidation.valid,
        issues: workflowValidation.issues.length,
        warnings: workflowValidation.warnings.length,
        firstIssue: workflowValidation.issues[0]?.message ?? "",
      },
      selectedSkill: selectedSkill
        ? {
            id: selectedSkill.id,
            name: selectedSkill.name,
            status: selectedSkill.status,
            riskLevel: selectedSkill.riskLevel,
            autonomyTier: selectedSkill.autonomyTier,
            evalPassRate: selectedSkill.evalPassRate,
            allowedTools: selectedSkill.allowedTools,
            contextSources: selectedSkill.contextSources,
          }
        : null,
      selectedRun: selectedRun
        ? {
            id: selectedRun.id,
            status: selectedRun.status,
            currentStage: selectedRun.currentStage,
            riskLevel: selectedRun.riskLevel,
          }
        : null,
	      productionReadiness: {
	        status: productionReadiness?.status ?? "unknown",
	        blockers: (productionReadiness?.blockers ?? []).map((blocker) => blocker.label).slice(0, 8),
	        warnings: (productionReadiness?.warnings ?? []).map((warning) => warning.label).slice(0, 8),
	        connectors: productionReadiness?.connectors ?? null,
	        customerLaunchContract: productionReadiness?.customerLaunchContract ?? null,
	      },
      evidenceQuality,
      operatingTimeline,
      connectorPosture,
      roleProfile,
      setupGuide,
      assistantQuality,
      enterpriseMaturity: {
        score: enterpriseMaturity.score,
        status: enterpriseMaturity.status,
        highestLeveragePillar: enterpriseMaturity.highestLeveragePillar.name,
        highestLeverageNextAction: enterpriseMaturity.highestLeveragePillar.nextAction,
        gaps: enterpriseMaturity.pillars
          .filter((pillar) => pillar.status === "gap" || pillar.status === "building")
          .map((pillar) => ({ name: pillar.name, score: pillar.score, nextAction: pillar.nextAction }))
          .slice(0, 6),
      },
      compoundLearningLoop: {
        score: compoundLearningLoop.score,
        status: compoundLearningLoop.status,
        weakestStage: compoundLearningLoop.weakestStage.name,
        summary: compoundLearningLoop.summary,
        autopilotMoves: compoundLearningLoop.autopilotMoves.map((move) => ({
          title: move.title,
          targetView: move.targetView,
          impact: move.impact,
          effort: move.effort,
          confidence: move.confidence,
        })),
      },
      transformationCommand: {
        score: transformationCommand.score,
        posture: transformationCommand.posture,
        directive: transformationCommand.directive,
        whyNow: transformationCommand.whyNow,
        operatorBrief: transformationCommand.operatorBrief,
        nextAction: {
          title: transformationCommand.nextAction.title,
          targetView: transformationCommand.nextAction.targetView,
          why: transformationCommand.nextAction.why,
          evidenceNeeded: transformationCommand.nextAction.evidenceNeeded,
          urgency: transformationCommand.nextAction.urgency,
        },
        orders: transformationCommand.orders.slice(0, 5).map((order) => ({
          title: order.title,
          targetView: order.targetView,
          urgency: order.urgency,
          confidence: order.confidence,
        })),
      },
    }),
    [
      actionInboxItems,
      auditLogs.length,
      assistantQuality,
      commandOrders,
      companyBlueprint,
      compoundLearningLoop,
      connectorPosture,
      edges.length,
      enterpriseMaturity,
      evidenceQuality,
      evalResults,
      governanceReviews,
      metrics,
      nodes.length,
      operatingTimeline,
      primetimeLaunchGate,
      productionReadiness,
      roleProfile,
      runs,
      selectedRun,
      selectedSkill,
      setupGuide,
      skills,
      toolRequests,
      transformationCommand,
      useCases,
      workSignals,
      workflowStatus,
      workflowValidation,
    ],
  );

  const commandItems: CommandItem[] = (() => {
    const viewItems = navItems.map((item) => ({
      id: `view-${item.id}`,
      label: item.label,
      description: item.helper,
      group: "Views",
      action: () => {
        openView(item.id);
        setCommandOpen(false);
      },
    }));

    const useCaseItems = useCases.map((item) => ({
      id: `uc-${item.id}`,
      label: item.title,
      description: `${item.department} use case · ${statusLabels[item.status]} · priority ${item.priorityScore}`,
      group: "Use Cases",
      action: () => {
        setSelectedUseCaseId(item.id);
        setFactoryTab("detail");
        setActiveView("factory");
        setCommandOpen(false);
      },
    }));

    const skillItems = skills.map((item) => ({
      id: `skill-${item.id}`,
      label: item.name,
      description: `${item.department} Skill · ${statusLabels[item.status]} · ${item.evalPassRate}% eval`,
      group: "Skills",
      action: () => {
        setSelectedSkillId(item.id);
        setSkillMode("detail");
        setActiveView("skills");
        setCommandOpen(false);
      },
    }));

    const runItems = runs.map((item) => ({
      id: `run-${item.id}`,
      label: item.id,
      description: `${statusLabels[item.status]} · ${item.currentStage} · ${item.latencyMs}ms`,
      group: "Runs",
      action: () => {
        setSelectedRunId(item.id);
        setHarnessMode("detail");
        setActiveView("harness");
        setCommandOpen(false);
      },
    }));

    const commandOrderItems = activeCommandOrders(commandOrders).map((item) => ({
      id: `command-order-${item.id}`,
      label: item.title,
      description: `${item.priority} priority · ${item.status.replace("_", " ")} · due ${item.dueDate}`,
      group: "Command Orders",
      action: () => {
        openCommandOrder(item.id);
        setCommandOpen(false);
      },
    }));

    return [...viewItems, ...commandOrderItems, ...useCaseItems, ...skillItems, ...runItems];
  })();

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  function addAudit(eventType: string, message: string, riskLevel: RiskLevel = "low", actor = "AI Enablement OS") {
    const log = {
      id: `audit-${Date.now()}`,
      eventType,
      message,
      actor,
      riskLevel,
      createdAt: nowStamp(),
    };
    setAuditLogs((current) => [log, ...current]);
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log),
    }).catch(() => {
      // Workspace snapshot persistence remains the offline audit fallback.
    });
  }

  function openView(view: View) {
    setProfileOpen(false);
    if (view === "harness") {
      setHarnessMode("overview");
    }
    if (view === "factory") {
      setFactoryTab("overview");
    }
    if (view === "workflow") {
      setWorkflowMode("overview");
    }
    if (view === "skills") {
      setSkillMode("overview");
    }
    setActiveView(view);
  }

  function openCommandOrder(orderId: string) {
    const order = commandOrders.find((item) => item.id === orderId);
    if (!order) {
      notify("Command order is no longer active");
      setActiveView("command");
      return;
    }

    setCommandOrders((current) => setCommandOrderStatus(current, order.id, "in_progress"));
    addAudit("command_order_opened", `${order.title} opened from the command system.`, "low", "Command Orders");
    openView(order.targetView);
    notify("Command order opened");
  }

  function completeCommandOrderRecord(orderId: string) {
    const order = commandOrders.find((item) => item.id === orderId);
    if (!order) {
      notify("Command order is no longer active");
      return;
    }

    setCommandOrders((current) => setCommandOrderStatus(current, order.id, "completed"));
    addAudit("command_order_completed", `${order.title} completed by the operator.`, "low", "Command Orders");
    notify("Command order completed");
  }

  async function openInboxItem(item: ActionInboxItem) {
    setNotificationsOpen(false);

    if (item.id === "empty-workspace") {
      setOnboardingOpen(true);
      return;
    }

    if (item.id === "report-gap") {
      await generateExecBrief();
      return;
    }

    if (item.targetView === "factory") {
      if (item.targetId && useCases.some((useCase) => useCase.id === item.targetId)) {
        setSelectedUseCaseId(item.targetId);
        setFactoryTab("detail");
      } else {
        setFactoryTab("backlog");
      }
      setActiveView("factory");
      return;
    }

    if (item.targetView === "skills") {
      if (item.targetId) setSelectedSkillId(item.targetId);
      setSkillMode(item.targetId ? "detail" : "overview");
      setActiveView("skills");
      return;
    }

    if (item.targetView === "harness") {
      if (item.targetId) setSelectedRunId(item.targetId);
      setHarnessMode(item.targetId ? "detail" : "overview");
      setActiveView("harness");
      return;
    }

    if (item.targetView === "workflow") {
      setWorkflowMode("editor");
      setActiveView("workflow");
      return;
    }

    if (item.targetView === "evals" && item.targetId) {
      setSelectedSkillId(item.targetId);
    }

    if (item.targetView === "broker" && item.targetId) {
      setSelectedRunId(item.targetId);
    }

    openView(item.targetView);
  }

  async function openLaunchHandoffStep(item: LaunchHandoffStep) {
    setLaunchHandoffOpen(false);

    const targetSkill = item.targetId ? skills.find((skill) => skill.id === item.targetId) : null;
    const targetUseCase = item.targetId ? useCases.find((useCase) => useCase.id === item.targetId) : null;
    const targetRun = item.targetId ? runs.find((run) => run.id === item.targetId) : null;
    const activeSkill = targetSkill ?? selectedSkill;

    if (item.id === "inspect-portfolio") {
      if (targetUseCase) {
        setSelectedUseCaseId(targetUseCase.id);
        setFactoryTab("detail");
      } else {
        setFactoryTab("overview");
      }
      setActiveView("factory");
      return;
    }

    if (item.id === "review-skill-package") {
      if (activeSkill) setSelectedSkillId(activeSkill.id);
      setSkillMode(activeSkill ? "detail" : "overview");
      setSkillTab("overview");
      setActiveView(activeSkill ? "skills" : "factory");
      return;
    }

    if (item.id === "run-launch-eval") {
      if (activeSkill && item.status !== "done") {
        await runEvalSuite(activeSkill);
      } else if (activeSkill) {
        setSelectedSkillId(activeSkill.id);
      }
      setActiveView("evals");
      return;
    }

    if (item.id === "resolve-governance") {
      if (activeSkill && !governanceReviews.some((review) => review.itemId === activeSkill.id)) {
        await submitGovernanceReview(activeSkill);
      } else {
        setActiveView("governance");
      }
      return;
    }

    if (item.id === "validate-workflow") {
      setWorkflowMode("editor");
      setActiveView("workflow");
      return;
    }

    if (item.id === "run-harness-trace") {
      if (targetRun) {
        setSelectedRunId(targetRun.id);
        setHarnessMode("detail");
        setActiveView("harness");
      } else if (activeSkill) {
        await runSkillTest(activeSkill, "harness");
      } else {
        setSkillMode("overview");
        setActiveView("skills");
      }
      return;
    }

    if (item.id === "brief-executives" && !report) {
      await generateExecBrief();
      setActiveView("reports");
      return;
    }

    openView(item.targetView);
  }

  function toggleHub(hubId: string) {
    setExpandedHubs((current) => ({ ...current, [hubId]: !current[hubId] }));
  }

  async function submitUseCase() {
    const outcome = buildUseCaseSubmission({
      intake,
      currentUserId,
      useCaseId: `uc-${Date.now()}`,
      createdAt: todayStamp(),
      updatedAt: todayStamp(),
    });

    if (!("data" in outcome)) {
      setFactoryTab("intake");
      setIntakeStep(outcome.intakeStep);
      notify(outcome.notification);
      return;
    }

    const { useCase: newUseCase } = outcome.data;
    const commandResult = await runWorkspaceCommand({
      type: "create_use_case",
      payload: { intake, useCaseId: newUseCase.id },
    });
    if (commandResult?.ok) {
      const createdUseCaseId =
        typeof commandResult.result?.useCaseId === "string" ? commandResult.result.useCaseId : newUseCase.id;
      setSelectedUseCaseId(createdUseCaseId);
      setFactoryTab("backlog");
      return;
    }

    setUseCases((current) => [newUseCase, ...current]);
    setSelectedUseCaseId(newUseCase.id);
    setFactoryTab("backlog");
    if (outcome.audit) addAudit(outcome.audit.eventType, outcome.audit.message, outcome.audit.riskLevel, outcome.audit.actor);
    notify(outcome.notification);
  }

  function createUseCaseFromWorkOpportunity(opportunity: WorkOpportunity) {
    const draft = workOpportunityToIntakeDraft(opportunity);
    setIntake((current) => ({ ...current, ...draft }));
    setFactoryTab("intake");
    setIntakeStep(4);
    setActiveView("factory");
    addAudit(
      "work_signal_promoted",
      `${opportunity.process} promoted from Work Intelligence into a use case intake draft.`,
      opportunity.riskLevel,
      "Work Intelligence",
    );
    notify("Work signal promoted into intake draft");
  }

  async function convertUseCaseToSkill(useCase: UseCase) {
    if (useCase.linkedSkillId) {
      setSelectedSkillId(useCase.linkedSkillId);
      setSkillMode("detail");
      setActiveView("skills");
      notify("Existing linked Skill opened");
      return;
    }

    const commandResult = await runWorkspaceCommand({
      type: "convert_use_case_to_skill",
      payload: { useCaseId: useCase.id },
    });
    if (commandResult?.ok) {
      const generatedSkillId =
        typeof commandResult.result?.skillId === "string" ? commandResult.result.skillId : "";
      if (generatedSkillId) setSelectedSkillId(generatedSkillId);
      setSkillMode("detail");
      setSkillTab("overview");
      setActiveView("skills");
      return;
    }

    // Do not fabricate a local Skill on failure — that produced a "created" Skill
    // that was never persisted and vanished on reload, bypassing role checks and
    // audit. Surface the error so the operator can retry.
    notify(
      commandResult?.notification ||
        "The Skill could not be created on the server — nothing was saved. Please retry.",
    );
  }

  function requestUseCaseGovernance(useCase: UseCase) {
    setUseCases((current) =>
      current.map((item) =>
        item.id === useCase.id ? { ...item, status: "governance_review" } : item,
      ),
    );
    addAudit("human_approval_requested", `${useCase.title} sent to governance review.`, useCase.riskLevel);
    notify("Governance review requested");
  }

  function installPattern(pattern: PatternMarketplaceItem) {
    if (pattern.sourceSkillId) {
      setSelectedSkillId(pattern.sourceSkillId);
      setSkillMode("detail");
      setSkillTab("overview");
      setActiveView("skills");
      notify("Workspace pattern opened");
      return;
    }

    const outcome = buildPatternInstall({
      pattern,
      currentUserId,
      timestamp: Date.now(),
      today: todayStamp(),
      aiSettings,
      tools,
      actor: currentUserName,
    });
    const { useCase, skill } = outcome.data;

    setUseCases((current) => [useCase, ...current]);
    setSkills((current) => [skill, ...current]);
    setSelectedUseCaseId(useCase.id);
    setSelectedSkillId(skill.id);
    setSkillMode("detail");
    setSkillTab("overview");
    setActiveView("skills");
    if (outcome.audit) addAudit(outcome.audit.eventType, outcome.audit.message, outcome.audit.riskLevel, outcome.audit.actor);
    notify(outcome.notification);
  }

  function isGovernanceCriticalChange(prev: Skill, next: Skill) {
    return (
      prev.systemPrompt !== next.systemPrompt ||
      prev.autonomyTier !== next.autonomyTier ||
      prev.model !== next.model ||
      prev.riskLevel !== next.riskLevel ||
      prev.allowedTools.join("|") !== next.allowedTools.join("|") ||
      prev.blockedTools.join("|") !== next.blockedTools.join("|")
    );
  }

  function updateSkill(skillId: string, patch: Partial<Skill> | ((skill: Skill) => Skill)) {
    const governedStatuses: Skill["status"][] = ["approved", "pilot", "production"];
    const existing = skills.find((item) => item.id === skillId);
    const draft = existing ? (typeof patch === "function" ? patch(existing) : { ...existing, ...patch }) : null;
    const mustRegovern = Boolean(
      existing &&
        draft &&
        governedStatuses.includes(existing.status) &&
        draft.status === existing.status &&
        isGovernanceCriticalChange(existing, draft),
    );

    setSkills((current) =>
      current.map((skill) => {
        if (skill.id !== skillId) return skill;
        const nextSkill = typeof patch === "function" ? patch(skill) : { ...skill, ...patch };
        const regovern =
          governedStatuses.includes(skill.status) &&
          nextSkill.status === skill.status &&
          isGovernanceCriticalChange(skill, nextSkill);
        return { ...nextSkill, status: regovern ? "in_review" : nextSkill.status, updatedAt: todayStamp() };
      }),
    );

    if (mustRegovern && existing) {
      addAudit(
        "human_approval_requested",
        `${existing.name} returned to governance review after a governance-critical change (prompt, tools, autonomy, model, or risk).`,
        existing.riskLevel,
        currentUserName,
      );
      notify("Governance-critical change — Skill sent back for re-review");
    }
  }

  function updateSkillPrompt(value: string) {
    if (!selectedSkill) {
      notify("Create or import a Skill before editing prompts");
      return;
    }
    updateSkill(selectedSkill.id, { systemPrompt: value });
  }

  function toggleSkillTool(toolId: string) {
    if (!selectedSkill) {
      notify("Create or import a Skill before configuring tools");
      return;
    }
    updateSkill(selectedSkill.id, (skill) => {
      const hasTool = skill.allowedTools.includes(toolId);
      return {
        ...skill,
        allowedTools: hasTool
          ? skill.allowedTools.filter((item) => item !== toolId)
          : [...skill.allowedTools, toolId],
        blockedTools: skill.blockedTools.filter((item) => item !== toolId),
      };
    });
    notify("Tool policy updated");
  }

  function sendSessionFollowUp() {
    if (!sessionFollowUp.trim() || !selectedSkill) return;
    const answer = selectedSkill.contextSources.length
      ? "The follow-up has been answered using the configured context sources for this Skill. Any action outside the Skill policy remains gated by human approval."
      : "This Skill has no context sources configured yet, so the answer is limited to the Skill prompt and should be validated before use.";
    setSessionReplies((current) => [...current, answer]);
    setSessionFollowUp("");
    addAudit("feedback_received", `Follow-up question answered in ${selectedSkill.name} session.`, "low", selectedSkill.name);
    notify("Follow-up answered");
  }

  function toggleSkillKillSwitch(skill: Skill) {
    const disable = skill.status !== "archived";
    setSkills((current) =>
      current.map((item) =>
        item.id === skill.id
          ? {
              ...item,
              status: disable ? "archived" : "in_review",
              updatedAt: todayStamp(),
            }
          : item,
      ),
    );
    addAudit(
      disable ? "agent_kill_switch_engaged" : "agent_kill_switch_released",
      `${skill.name} agent identity ${disable ? "disabled" : "reactivated for review"}.`,
      skill.riskLevel,
      currentUserName,
    );
    notify(disable ? "Agent kill switch engaged" : "Agent identity reactivated for review");
  }

  async function runSkillTest(skill?: Skill | null, destination: "session" | "harness" = "session") {
    const activeSkill = skill ?? selectedSkill;
    if (!activeSkill) {
      notify("Create or import a Skill before running the Harness");
      setSkillMode("overview");
      setActiveView("skills");
      return;
    }
    if (activeSkill.status === "archived") {
      addAudit("policy_violation", `${activeSkill.name} run blocked because the agent kill switch is active.`, activeSkill.riskLevel, "AI Harness");
      notify("Run blocked: agent kill switch is active");
      setHarnessMode("overview");
      setActiveView("harness");
      return;
    }
    const runId = `run-${Date.now()}`;
    const timestamp = nowStamp();
    const toolRequestId = `tr-${Date.now()}`;
    let runtimeResult: ReturnType<typeof runLocalHarnessSkill>;

    try {
      const response = await fetch("/api/harness/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: activeSkill.id,
          routingSettings: redactAISettingsSecrets(aiSettings),
          triggeredBy: currentUserName,
          timestamp,
          runId,
          toolRequestId,
        }),
      });
      if (!response.ok) throw new Error(`Harness API returned ${response.status}`);
      const payload = (await response.json()) as {
        result?: ReturnType<typeof runLocalHarnessSkill>;
      };
      if (!payload.result?.run) throw new Error("Harness API returned an invalid result");
      runtimeResult = payload.result;
    } catch {
      runtimeResult = runLocalHarnessSkill({
        skill: activeSkill,
        tools,
        settings: aiSettings,
        triggeredBy: currentUserName,
        timestamp,
        runId,
        toolRequestId,
      });
    }

    const { run, toolRequest, selectedToolId } = runtimeResult;

    // The Skill's run count is now derived from the ledger (reconciledSkills),
    // so adding the run record is the single source of truth — no manual increment.
    setRuns((current) => [run, ...current]);
    setSelectedRunId(runId);

    if (toolRequest) {
      setToolRequests((current) => [toolRequest, ...current]);
      addAudit("tool_requested", `${activeSkill.name} requested ${selectedToolId}.`, activeSkill.riskLevel, "AI Harness");
      notify("Tool request sent for approval");
    } else {
      addAudit("workflow_run_started", `${activeSkill.name} test run completed.`, activeSkill.riskLevel, "AI Harness");
      notify("Skill test completed");
    }

    setTestOutput(run.output);
    if (destination === "harness") {
      setHarnessMode("detail");
      setActiveView("harness");
    } else {
      setActiveView("session");
    }
  }

  async function decideToolRequest(request: ToolRequest, decision: "approved" | "rejected") {
    const commandResult = await runWorkspaceCommand({
      type: "decide_tool_request",
      payload: { requestId: request.id, decision },
    });
    if (commandResult?.ok) return;

    setToolRequests((current) =>
      current.map((item) => (item.id === request.id ? { ...item, status: decision } : item)),
    );
    setRuns((current) =>
      current.map((run) =>
        run.id === request.runId
          ? {
              ...run,
              status: decision === "approved" ? "completed" : "blocked",
              currentStage: decision === "approved" ? "Response Delivered" : "Blocked by Approver",
              trace: [
                ...run.trace,
                {
                  label: decision === "approved" ? "Tool approved" : "Tool rejected",
                  status: decision === "approved" ? "completed" : "blocked",
                  detail:
                    decision === "approved"
                      ? "Approver reviewed raw tool action and allowed execution."
                      : "Approver rejected the tool request. No external action was taken.",
                  latencyMs: 240,
                },
              ],
            }
          : run,
      ),
    );
    addAudit(
      decision === "approved" ? "tool_approved" : "human_approval_rejected",
      `${request.toolId} ${decision} for run ${request.runId}.`,
      request.riskLevel,
      currentUserName,
    );
    notify(decision === "approved" ? "Approval granted" : "Tool request rejected");
  }

  async function runEvalSuite(skill?: Skill | null) {
    const activeSkill = skill ?? selectedSkill;
    if (!activeSkill) {
      notify("Create or import a Skill before running evals");
      setSkillMode("overview");
      setActiveView("skills");
      return;
    }
    const commandResult = await runWorkspaceCommand({
      type: "run_eval_suite",
      payload: { skillId: activeSkill.id },
    });
    if (commandResult?.ok) return;

    const outcome = buildEvalRun(activeSkill, nowStamp());
    const { result, updatedSkill } = outcome.data;
    setEvalResults((current) => [result, ...current]);
    setSkills((current) =>
      current.map((item) => (item.id === activeSkill.id ? updatedSkill : item)),
    );
    if (outcome.audit) addAudit(outcome.audit.eventType, outcome.audit.message, outcome.audit.riskLevel, outcome.audit.actor);
    notify(outcome.notification);
  }

  async function submitGovernanceReview(skill?: Skill | null) {
    const activeSkill = skill ?? selectedSkill;
    if (!activeSkill) {
      notify("Create or import a Skill before governance review");
      setSkillMode("overview");
      setActiveView("skills");
      return;
    }
    const exists = governanceReviews.some((review) => review.itemId === activeSkill.id);
    if (exists) {
      notify("Governance review already exists");
      setActiveView("governance");
      return;
    }
    const commandResult = await runWorkspaceCommand({
      type: "submit_governance_review",
      payload: { skillId: activeSkill.id },
    });
    if (commandResult?.ok) {
      setActiveView("governance");
      return;
    }

    const outcome = buildGovernanceReview(activeSkill, todayStamp());
    const { review, updatedSkill } = outcome.data;
    setGovernanceReviews((current) => [review, ...current]);
    setSkills((current) =>
      current.map((item) => (item.id === activeSkill.id ? updatedSkill : item)),
    );
    setActiveView("governance");
    if (outcome.audit) addAudit(outcome.audit.eventType, outcome.audit.message, outcome.audit.riskLevel, outcome.audit.actor);
    notify(outcome.notification);
  }

  async function decideGovernance(
    review: GovernanceReview,
    status: GovernanceReview["status"],
  ) {
    const commandResult = await runWorkspaceCommand({
      type: "decide_governance",
      payload: { reviewId: review.id, status },
    });
    if (commandResult?.ok) return;

    setGovernanceReviews((current) =>
      current.map((item) =>
        item.id === review.id
          ? {
              ...item,
              status,
              blockers:
                status === "approved"
                  ? []
                  : status === "approved_with_conditions"
                    ? ["Pilot group size confirmation required"]
                    : status === "changes_requested"
                      ? ["Governance documentation must be completed"]
                      : item.blockers,
            }
          : item,
      ),
    );
    if (review.itemType === "skill") {
      setSkills((current) =>
        current.map((skill) =>
          skill.id === review.itemId
            ? {
                ...skill,
                status:
                  status === "approved"
                    ? "pilot"
                    : status === "approved_with_conditions"
                      ? "approved"
                      : status === "changes_requested"
                        ? "in_review"
                        : skill.status,
              }
            : skill,
        ),
      );
    }
    const label = statusLabels[status] ?? status;
    addAudit(
      status === "approved" ? "human_approval_granted" : "feedback_received",
      `${review.title} governance decision: ${label}.`,
      review.riskLevel,
      review.reviewer,
    );
    notify(
      status === "approved"
        ? "Skill approved for pilot"
        : status === "approved_with_conditions"
          ? "Skill approved with conditions"
          : "Changes requested",
    );
  }

  async function generateExecBrief(templateIdInput: string = "weekly_ai_enablement_brief"): Promise<ReportGenerationMeta | null> {
    const templateId: ReportTemplateId = normalizeReportTemplate(templateIdInput);
    const template = reportTemplateById(templateId);
    const reportMetrics = buildReportMetrics({ useCases, skills, governanceReviews });
    const fallbackReport = buildDeterministicReport({
      templateId,
      useCases,
      skills,
      governanceReviews,
      workSignals,
      metrics: reportMetrics,
      statusLabels,
    });
    const fallbackMeta: ReportGenerationMeta = {
      mode: "deterministic_fallback",
      templateTitle: template.title,
      generatedAt: new Date().toISOString(),
      provider: "local",
      modelRef: "local/deterministic-report-builder",
      routeReason: "Local deterministic report generated from current workspace state while server AI generation runs or when no provider is configured.",
      localFallback: true,
      inputTokens: 0,
      outputTokens: Math.max(1, Math.ceil(fallbackReport.length / 4)),
      latencyMs: 0,
      evidence: {
        useCases: useCases.length,
        skills: skills.length,
        governanceReviews: governanceReviews.length,
        workSignals: workSignals.length,
      },
    };

    setReport(fallbackReport);
    setReportGenerationMeta(fallbackMeta);
    setActiveView("reports");
    notify("Executive brief generated");

    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: templateId,
          workspace: workspaceSnapshot,
          routingSettings: redactAISettingsSecrets(aiSettings),
        }),
      });
      const payload = (await response.json().catch(() => null)) as ReportGeneratePayload | null;
      if (!response.ok || !payload?.report) {
        addAudit("output_generated", `${template.title} generated from local workspace data fallback.`, "low", "Reports Studio");
        return fallbackMeta;
      }

      const nextMeta: ReportGenerationMeta = {
        mode: payload.mode === "ai_assisted" ? "ai_assisted" : "deterministic_fallback",
        templateTitle: payload.template?.title ?? template.title,
        generatedAt: payload.generatedAt ?? new Date().toISOString(),
        provider: payload.model?.provider ?? "local",
        modelRef: payload.model?.modelRef ?? "local/deterministic-report-builder",
        routeReason: payload.model?.routeReason ?? fallbackMeta.routeReason,
        localFallback: Boolean(payload.model?.localFallback),
        inputTokens: payload.model?.inputTokens ?? 0,
        outputTokens: payload.model?.outputTokens ?? fallbackMeta.outputTokens,
        latencyMs: payload.model?.latencyMs ?? 0,
        evidence: payload.evidence ?? fallbackMeta.evidence,
      };

      setReport(payload.report);
      setReportGenerationMeta(nextMeta);
      if (payload.workspace) {
        applyWorkspaceSnapshot(payload.workspace, aiSettings, payload.workspace.workspaceMode ?? workspaceMode, sessionUser);
      }
      notify(nextMeta.mode === "ai_assisted" ? "AI-assisted report generated" : "Executive brief generated");
      return nextMeta;
    } catch {
      addAudit("output_generated", `${template.title} generated from local workspace data fallback.`, "low", "Reports Studio");
      return fallbackMeta;
    }
  }

  async function testWorkflow() {
    if (!skills.some((skill) => !["archived", "deprecated"].includes(skill.status))) {
      setTestOutput("Create or select a governed AI Skill before running a workflow test. Workflows need a Skill owner, prompt contract, context boundary, tool policy, and proof path before they can produce meaningful trace evidence.");
      setActiveView("skills");
      notify("Create an AI Skill first");
      return;
    }

    if (!nodes.length) {
      setTestOutput("Add workflow blocks before running a test. The canvas currently has no executable path.");
      notify("Workflow has no blocks");
      return;
    }

    const validation = analyzeWorkflow(nodes, edges);
    if (!validation.valid) {
      setTestOutput(formatWorkflowValidationSummary(validation));
      notify("Fix workflow validation errors first");
      return;
    }

    const spec = compileWorkflowSpec(nodes, edges, workflowStatus);
    setWorkflowStatus("Testing");
    setTestOutput("Workflow test queued. Compiling graph, policy gates, context boundaries, and output schema.");
    addAudit("workflow_run_started", "Workflow test run requested from Workflow Studio.", "low", "Workflow Studio");

    try {
      const response = await fetch("/api/workflows/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: "workflow-builder-current",
          input: {
            action: "test_run",
            spec,
            validation,
            requestedAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Workflow job queue returned ${response.status}`);
      }

      const payload = await response.json();
      const jobId = typeof payload?.job?.id === "string" ? payload.job.id : "queued";
      setTestOutput(
        [
          `Workflow test queued as ${jobId}.`,
          `Execution path: ${nodes.length} blocks, ${edges.length} connections.`,
          validation.warnings.length
            ? `Warnings: ${validation.warnings.map((issue) => issue.message).join(" ")}`
            : "Warnings: none.",
          "The job record is now persisted through the workflow job repository for audit and replay.",
        ].join("\n\n"),
      );
    } catch (error) {
      setTestOutput(
        [
          "Local workflow simulation completed, but the workflow job queue was unavailable.",
          `Execution path: ${nodes.length} blocks, ${edges.length} connections.`,
          validation.warnings.length
            ? `Warnings: ${validation.warnings.map((issue) => issue.message).join(" ")}`
            : "Warnings: none.",
          error instanceof Error ? `Queue detail: ${error.message}` : "Queue detail: unknown error.",
        ].join("\n\n"),
      );
    } finally {
      window.setTimeout(() => setWorkflowStatus("Saved"), 1200);
      notify("Workflow test completed");
    }
  }

  function validateWorkflow() {
    const validation = analyzeWorkflow(nodes, edges);
    setWorkflowStatus("Saved");
    setTestOutput(formatWorkflowValidationSummary(validation));
    addAudit(
      "eval_run",
      validation.valid ? "Workflow validation completed successfully." : "Workflow validation completed with blocking issues.",
      validation.valid ? "low" : "medium",
      "Workflow Studio",
    );
    notify(validation.valid ? "Workflow validated" : "Workflow needs attention");
  }

  function addWorkflowBlock(blockIdOrLabel: string) {
    setNodes((current) => {
      const node = createWorkflowNode(blockIdOrLabel, current.length);
      return [...current, node];
    });
    const definition = getBlockDefinition(blockIdOrLabel);
    setWorkflowStatus("Saved");
    setTestOutput(`${definition?.label ?? blockIdOrLabel} block added to the execution blueprint. Configure it in the block inspector, then validate before publishing.`);
    addAudit("workflow_block_added", `${definition?.label ?? blockIdOrLabel} block added to execution blueprint.`, "low", "Workflow Studio");
    notify(`${definition?.label ?? blockIdOrLabel} block added`);
  }

  function loadWorkflowTemplate(template: "knowledge" | "approval") {
    const next = createWorkflowTemplate(template);
    setNodes(next.nodes);
    setEdges(next.edges);
    setWorkflowStatus("Saved");
    setTestOutput(
      template === "knowledge"
        ? "Knowledge workflow template loaded. Configure retrieval sources and model policy before publishing."
        : "Approval workflow template loaded. Configure the approval role, broker tool, and policy boundary before publishing.",
    );
    addAudit("workflow_template_loaded", `${template} execution blueprint template loaded.`, "low", "Workflow Studio");
    notify("Workflow template loaded");
  }

  function applyWorkflowClear(request: WorkflowClearRequest = {}) {
    setNodes([]);
    setEdges([]);
    setWorkflowStatus("Saved");
    setTestOutput("Execution blueprint cleared.");
    addAudit("workflow_cleared", "Execution blueprint cleared.", "low", "Workflow Studio");
    request.onCleared?.();
    notify(request.notice ?? "Workflow cleared");
  }

  function clearWorkflow(request: WorkflowClearRequest = {}) {
    const hasBlueprint = nodes.length > 0 || edges.length > 0;
    if (!hasBlueprint) {
      applyWorkflowClear(request);
      return;
    }

    setConfirmationAction({
      title: request.title ?? "Clear the execution blueprint?",
      description: request.description ?? "This removes the current workflow blocks and connections from the browser workspace.",
      detail: request.detail ?? "Workflow specs, tests, and evidence generated before this point remain in audit history, but the editable canvas will be blank.",
      confirmLabel: request.confirmLabel ?? "Clear Canvas",
      tone: "danger",
      testId: request.testId ?? "clear-workflow-confirmation",
      onConfirm: () => applyWorkflowClear(request),
    });
  }

  async function publishWorkflow() {
    if (!skills.some((skill) => !["archived", "deprecated"].includes(skill.status))) {
      setTestOutput("Create or select a governed AI Skill before publishing this workflow. A published workflow must belong to a Skill so ownership, risk, tools, context, and evidence stay connected.");
      setActiveView("skills");
      notify("Create an AI Skill first");
      return;
    }

    const validation = analyzeWorkflow(nodes, edges);
    if (!validation.valid) {
      setTestOutput(formatWorkflowValidationSummary(validation));
      notify("Resolve validation errors before publishing");
      return;
    }

    const commandResult = await runWorkspaceCommand({
      type: "publish_workflow",
      payload: {
        workflowId: "workflow-builder-current",
        valid: validation.valid,
        warnings: validation.warnings.length,
      },
    });
    if (commandResult?.ok) {
      setWorkflowStatus("Published");
      setTestOutput(
        [
          "Workflow published through the workspace command layer.",
          `Published spec contains ${nodes.length} blocks and ${edges.length} governed connections.`,
          validation.warnings.length
            ? `Publish warnings: ${validation.warnings.map((issue) => issue.message).join(" ")}`
            : "Publish warnings: none.",
        ].join("\n\n"),
      );
      return;
    }

    setWorkflowStatus("Published");
    setTestOutput(
      [
        "Workflow published.",
        `Published spec contains ${nodes.length} blocks and ${edges.length} governed connections.`,
        validation.warnings.length
          ? `Publish warnings: ${validation.warnings.map((issue) => issue.message).join(" ")}`
          : "Publish warnings: none.",
      ].join("\n\n"),
    );
    addAudit("workflow_published", "Workflow published after validation.", "medium", "Workflow Studio");
    notify("Workflow published");
  }

  function clearOrchestratorChat() {
    executeOrchestratorAction(
      makeOrchestratorAction("clear_chat", "Clear chat", "Remove this local transcript.", undefined, "danger"),
    );
  }

  function lastAssistantAskedForIntakeForm() {
    const lastAssistant = [...orchestratorMessages].reverse().find((item) => item.role === "assistant")?.content ?? "";
    return /Intake form|business process.*pain.*owner/i.test(lastAssistant);
  }

  function lastAssistantAskedForWorkSignalForm() {
    const lastAssistant = [...orchestratorMessages].reverse().find((item) => item.role === "assistant")?.content ?? "";
    return /Work signal form|repeated work pattern.*volume.*source/i.test(lastAssistant);
  }

  function summarizeOrchestratorActionMemory() {
    const assistantMessages = orchestratorMessages.filter((item) => item.role === "assistant").map((item) => item.content);
    const lastHandled = [...assistantMessages].reverse().find((content) =>
      /^(Opened|Generated|Captured|Validated|Queued|Ran|Cleared|Handled):/i.test(content.trim()),
    );
    const lastRecommendation = [...assistantMessages].reverse().find((content) => /Recommended move:/i.test(content));
    const handledLabel = lastHandled?.match(/^(?:Opened|Generated|Captured|Validated|Queued|Ran|Cleared|Handled):\s*([^\n.]+)/i)?.[1]?.trim() ?? "";
    const recommendationLabel = lastRecommendation?.match(/Recommended move:\s*([^\n.]+)/i)?.[1]?.trim() ?? "";

    return {
      lastAction: handledLabel,
      lastRecommendation: recommendationLabel,
      summary: handledLabel
        ? `Last assistant action: ${handledLabel}`
        : recommendationLabel
          ? `Last recommendation: ${recommendationLabel}`
          : "No prior assistant action is visible in this transcript.",
    };
  }

  function planOrchestratorResponse(message: string): ClientOrchestratorPlan {
    return planClientOrchestratorResponse(message, {
      useCases, skills, runs, governanceReviews, evalResults, auditLogs, toolRequests, workSignals,
      commandOrders, orchestratorMessages, productionReadiness, providerVault, nodes, edges,
      selectedRun, selectedSkill, actionInboxItems, connectorPosture, roleProfile, setupGuide,
      evidenceQuality, assistantQuality, operatingTimeline, primetimeLaunchGate, companyBlueprint,
      transformationCommand, metrics, lastAssistantAskedForIntakeForm, lastAssistantAskedForWorkSignalForm,
      summarizeOrchestratorActionMemory,
    });
  }

  function appendOrchestratorAssistant(
    content: string,
    actions: OrchestratorAction[] = [],
    evidence: OrchestratorMessage["evidence"] = [],
  ) {
    const message: OrchestratorMessage = {
      id: `om-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: "assistant",
      content,
      createdAt: nowStamp(),
      actions,
      evidence,
    };
    setOrchestratorMessages((current) => [...current, message]);
  }

  async function sendOrchestratorMessage(override?: string) {
    const text = (override ?? orchestratorInput).trim();
    if (!text || orchestratorBusy) return;

    const userMessage: OrchestratorMessage = {
      id: `om-user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: nowStamp(),
    };
    setOrchestratorMessages((current) => [...current, userMessage]);
    setOrchestratorInput("");
    setOrchestratorBusy(true);

    try {
      let response: ReturnType<typeof planOrchestratorResponse>;
      let modelLabel = "local planner";
      let plannerSimulated = true;
      try {
        const apiResponse = await fetch("/api/orchestrator/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: orchestratorMessages.slice(-12).map((message) => ({
              role: message.role,
              content: message.content,
              createdAt: message.createdAt,
            })),
            workspace: orchestratorWorkspace,
            routingSettings: redactAISettingsSecrets(aiSettings),
            selectedSkillId: selectedSkill?.id,
            selectedRunId: selectedRun?.id,
          }),
        });

        if (!apiResponse.ok) {
          throw new Error(`Orchestrator API returned ${apiResponse.status}`);
        }

        const payload = await apiResponse.json();
        const plan = payload?.plan;
        if (!plan || typeof plan.content !== "string") {
          throw new Error("Orchestrator API returned an invalid plan");
        }

        response = {
          content: plan.content,
          actions: Array.isArray(plan.actions) ? plan.actions : [],
          autoActions: Array.isArray(plan.autoActions) ? plan.autoActions : [],
          evidence: Array.isArray(plan.evidence) ? plan.evidence : [],
        };
        modelLabel = plan.model?.modelRef
          ? `${plan.model.modelRef}${plan.model.localFallback ? " fallback" : ""}`
          : "server orchestrator";
        plannerSimulated = plan.model?.localFallback !== false;
      } catch {
        response = planOrchestratorResponse(text);
        plannerSimulated = true;
      }

      const assistantMessage: OrchestratorMessage = {
        id: `om-assistant-${Date.now()}`,
        role: "assistant",
        content: response.content,
        createdAt: nowStamp(),
        actions: response.actions,
        evidence: [...(response.evidence ?? []), { label: "Planner", value: modelLabel }],
        simulated: plannerSimulated,
      };

      setOrchestratorMessages((current) => [...current, assistantMessage]);
      addAudit("orchestrator_message", "AI Orchestrator responded to workspace instruction.", "low", "AI Orchestrator");
      response.autoActions.forEach((action, index) => {
        window.setTimeout(() => {
          void executeOrchestratorAction(action, true);
        }, index * 120);
      });
    } finally {
      setOrchestratorBusy(false);
    }
  }

  function orchestratorActionResultText(action: OrchestratorAction) {
    const verb =
      action.type === "open_view" || action.type === "open_intake" || action.type === "open_top_use_case" || action.type === "open_selected_run_trace" || action.type === "open_command_order" || action.type === "open_ai_settings"
        ? "Opened"
        : action.type === "generate_exec_brief"
          ? "Generated"
          : action.type === "capture_work_signal"
            ? "Captured"
          : action.type === "validate_workflow"
            ? "Validated"
            : action.type === "test_workflow"
              ? "Queued"
              : action.type === "run_selected_skill" || action.type === "run_selected_eval"
                ? "Ran"
                : action.type === "clear_chat"
                  ? "Cleared"
                  : "Handled";
    return `${verb}: ${action.label}. The action is recorded in this transcript so the assistant remains the control surface.`;
  }

  function isRepeatableOrchestratorAction(action: OrchestratorAction) {
    return ["open_view", "open_intake", "open_top_use_case", "open_selected_run_trace", "open_command_order", "open_ai_settings"].includes(action.type);
  }

  function orchestratorActionApproval(action: OrchestratorAction) {
    const highImpactLabels: Partial<Record<OrchestratorAction["type"], string>> = {
      publish_workflow: "publish the current workflow",
      run_selected_skill: "run the selected Skill through the Harness",
      run_selected_eval: "run the launch eval suite",
      submit_selected_governance: "submit the selected Skill for governance review",
      approve_pending_tool_request: "approve a pending tool request",
      reject_pending_tool_request: "reject a pending tool request",
      approve_governance_review: "approve a governance review",
      request_governance_changes: "request governance changes",
      complete_command_order: "mark a command order complete",
    };
    const label = highImpactLabels[action.type];
    return label
      ? {
          requiresConfirmation: true,
          prompt: `Confirm this assistant action: ${label}?\n\n${action.description ?? action.label}`,
        }
      : { requiresConfirmation: false, prompt: "" };
  }

  async function executeOrchestratorAction(action: OrchestratorAction, silent = false) {
    const actionKey = action.id || `${action.type}:${JSON.stringify(action.payload ?? {})}`;
    if (!isRepeatableOrchestratorAction(action)) {
      if (executedOrchestratorActionIdsRef.current.has(actionKey)) {
        if (!silent) notify("That assistant action already ran");
        return;
      }
    }

    const approval = orchestratorActionApproval(action);
    if (approval.requiresConfirmation) {
      if (silent) {
        appendOrchestratorAssistant(
          `Ready for approval: ${action.label}. I staged this instead of running it silently because it can change workspace state or create launch evidence.`,
          [action],
          [
            { label: "Action", value: action.type },
            { label: "Result", value: "approval required" },
          ],
        );
        return;
      }
      if (!window.confirm(approval.prompt)) {
        appendOrchestratorAssistant(`Cancelled: ${action.label}. No workspace change was made.`, [], [
          { label: "Action", value: action.type },
          { label: "Result", value: "cancelled" },
        ]);
        return;
      }
    }

    if (!isRepeatableOrchestratorAction(action)) executedOrchestratorActionIdsRef.current.add(actionKey);

    switch (action.type) {
      case "open_view": {
        const view = resolveAssistantActionView(action);
        const targetId = typeof action.payload?.targetId === "string" ? action.payload.targetId : "";
        if (!view) {
          if (!silent) {
            notify("Assistant action needs a destination");
            appendOrchestratorAssistant(
              `I could not run "${action.label}" because the action did not include a valid app destination. I kept the workspace unchanged.`,
              [
                actionForView("orchestrator", "Stay in AI Assistant"),
                actionForView("command", "Open Home"),
              ],
              [
                { label: "Action", value: action.type },
                { label: "Result", value: "missing destination" },
              ],
            );
          }
          return;
        }
        if (view === "factory" && targetId && useCases.some((item) => item.id === targetId)) {
          setSelectedUseCaseId(targetId);
          setFactoryTab("detail");
          setActiveView("factory");
        } else if (view === "skills" && targetId && skills.some((item) => item.id === targetId)) {
          setSelectedSkillId(targetId);
          setSkillMode("detail");
          setActiveView("skills");
        } else if (view === "harness" && targetId && runs.some((item) => item.id === targetId)) {
          setSelectedRunId(targetId);
          setHarnessMode("detail");
          setActiveView("harness");
        } else if (view === "workflow") {
          setWorkflowMode(targetId ? "editor" : "overview");
          setActiveView("workflow");
        } else if (view) {
          openView(view);
        }
        break;
      }
      case "open_intake":
        setFactoryTab("intake");
        setActiveView("factory");
        break;
      case "draft_use_case": {
        const message = typeof action.payload?.message === "string" ? action.payload.message : "";
        const draftResult = await requestUseCaseDraft(message);
        setIntake((current) => ({ ...current, ...draftResult.draft }));
        setIntakeStep(0);
        setFactoryTab("intake");
        setActiveView("factory");
        addAudit(
          "use_case_drafted",
          draftResult.provenance === "model"
            ? "AI Orchestrator drafted an intake record from user instruction (model proposal, policy-validated)."
            : "AI Orchestrator drafted an intake record from user instruction (deterministic heuristic — no model configured).",
          "low",
          "AI Orchestrator",
        );
        break;
      }
      case "capture_work_signal": {
        const message = typeof action.payload?.message === "string" ? action.payload.message : "";
        const signal = normalizeWorkSignal(draftWorkSignalFromPrompt(message, nowStamp()));
        const privacyIssues = workSignalPrivacyIssues(signal);
        if (privacyIssues.length) {
          notify("Signal blocked by privacy guardrails");
          appendOrchestratorAssistant(
            `Blocked: ${privacyIssues.map((issue) => issue.message).join(" ")}`,
            [actionForView("governance", "Open Risk Review")],
            [
              { label: "Action", value: "capture_work_signal" },
              { label: "Result", value: "blocked" },
            ],
          );
          return;
        }
        setWorkSignals((current) => [signal, ...current.filter((item) => item.id !== signal.id)].slice(0, 50000));
        setActiveView("work");
        addAudit(
          "work_signal_captured",
          `${signal.process} captured as a redacted aggregate work signal from AI Assistant.`,
          signal.riskLevel,
          "AI Orchestrator",
        );
        notify("Work signal captured");
        break;
      }
      case "open_top_use_case": {
        const targetId = typeof action.payload?.useCaseId === "string" ? action.payload.useCaseId : "";
        const targetUseCase =
          useCases.find((item) => item.id === targetId) ??
          [...useCases].sort((a, b) => b.priorityScore - a.priorityScore)[0];
        if (!targetUseCase) {
          setFactoryTab("intake");
          setActiveView("factory");
          notify("Create a use case first");
          break;
        }
        setSelectedUseCaseId(targetUseCase.id);
        setFactoryTab("detail");
        setActiveView("factory");
        break;
      }
      case "convert_top_use_case_to_skill": {
        const targetId = typeof action.payload?.useCaseId === "string" ? action.payload.useCaseId : "";
        const targetUseCase =
          useCases.find((item) => item.id === targetId) ??
          [...useCases].sort((a, b) => b.priorityScore - a.priorityScore)[0];
        if (!targetUseCase) {
          setFactoryTab("intake");
          setActiveView("factory");
          notify("Create a use case before converting to Skill");
          break;
        }
        await convertUseCaseToSkill(targetUseCase);
        break;
      }
      case "generate_exec_brief":
        await generateExecBrief();
        break;
      case "validate_workflow":
        validateWorkflow();
        setWorkflowMode("editor");
        setActiveView("workflow");
        break;
      case "test_workflow":
        setWorkflowMode("editor");
        setActiveView("workflow");
        await testWorkflow();
        break;
      case "publish_workflow":
        setWorkflowMode("editor");
        setActiveView("workflow");
        await publishWorkflow();
        break;
      case "load_knowledge_workflow":
        loadWorkflowTemplate("knowledge");
        setWorkflowMode("editor");
        setActiveView("workflow");
        break;
      case "load_approval_workflow":
        loadWorkflowTemplate("approval");
        setWorkflowMode("editor");
        setActiveView("workflow");
        break;
      case "run_selected_skill":
        await runSkillTest(selectedSkill);
        break;
      case "run_selected_eval":
        await runEvalSuite(selectedSkill);
        setActiveView("evals");
        break;
      case "submit_selected_governance":
        await submitGovernanceReview(selectedSkill);
        break;
      case "approve_pending_tool_request": {
        const targetId = typeof action.payload?.requestId === "string" ? action.payload.requestId : "";
        const request = toolRequests.find((item) => item.id === targetId) ?? toolRequests.find((item) => item.status === "pending");
        if (!request) {
          notify("No pending tool request found");
          setActiveView("broker");
          break;
        }
        await decideToolRequest(request, "approved");
        setSelectedRunId(request.runId);
        setHarnessMode("detail");
        setActiveView("harness");
        break;
      }
      case "reject_pending_tool_request": {
        const targetId = typeof action.payload?.requestId === "string" ? action.payload.requestId : "";
        const request = toolRequests.find((item) => item.id === targetId) ?? toolRequests.find((item) => item.status === "pending");
        if (!request) {
          notify("No pending tool request found");
          setActiveView("broker");
          break;
        }
        await decideToolRequest(request, "rejected");
        setSelectedRunId(request.runId);
        setHarnessMode("detail");
        setActiveView("harness");
        break;
      }
      case "open_selected_run_trace": {
        const targetId = typeof action.payload?.runId === "string" ? action.payload.runId : "";
        const run = runs.find((item) => item.id === targetId) ?? selectedRun ?? runs[0];
        if (!run) {
          setHarnessMode("overview");
          setActiveView("harness");
          notify("No Harness run available yet");
          break;
        }
        setSelectedRunId(run.id);
        setHarnessMode("detail");
        setActiveView("harness");
        break;
      }
      case "approve_governance_review": {
        const targetId = typeof action.payload?.reviewId === "string" ? action.payload.reviewId : "";
        const review =
          governanceReviews.find((item) => item.id === targetId) ??
          governanceReviews.find((item) => ["in_review", "changes_requested", "not_submitted"].includes(item.status));
        if (!review) {
          await submitGovernanceReview(selectedSkill);
          break;
        }
        await decideGovernance(review, "approved");
        setActiveView("governance");
        break;
      }
      case "request_governance_changes": {
        const targetId = typeof action.payload?.reviewId === "string" ? action.payload.reviewId : "";
        const review =
          governanceReviews.find((item) => item.id === targetId) ??
          governanceReviews.find((item) => ["in_review", "not_submitted"].includes(item.status));
        if (!review) {
          notify("No governance review found");
          setActiveView("governance");
          break;
        }
        await decideGovernance(review, "changes_requested");
        setActiveView("governance");
        break;
      }
      case "open_command_order": {
        const orderId = typeof action.payload?.orderId === "string" ? action.payload.orderId : "";
        const targetOrder = commandOrders.find((order) => order.id === orderId) ?? activeCommandOrders(commandOrders)[0];
        if (!targetOrder) {
          setActiveView("command");
          notify("No active command order found");
          break;
        }
        openCommandOrder(targetOrder.id);
        break;
      }
      case "complete_command_order": {
        const orderId = typeof action.payload?.orderId === "string" ? action.payload.orderId : "";
        const targetOrder = commandOrders.find((order) => order.id === orderId) ?? activeCommandOrders(commandOrders)[0];
        if (!targetOrder) {
          notify("No active command order found");
          break;
        }
        completeCommandOrderRecord(targetOrder.id);
        break;
      }
      case "open_ai_settings":
        setSettingsOpen(true);
        break;
      case "clear_chat":
        executedOrchestratorActionIdsRef.current.clear();
        setOrchestratorMessages([]);
        notify("Orchestrator chat cleared");
        return;
    }

    if (!silent) {
      appendOrchestratorAssistant(orchestratorActionResultText(action), [], [
        { label: "Action", value: action.type },
        { label: "Result", value: "handled" },
      ]);
    }
  }

  function copyReport(): Promise<string> {
    if (!report) {
      notify("Generate a report first");
      return Promise.resolve("Generate a report first");
    }
    return copyTextOrDownload({
      contents: report,
      copiedMessage: "Report copied to clipboard",
      fallbackFilename: timestampedExportFilename(`${organization.name} executive report`, "md"),
      fallbackMimeType: "text/markdown;charset=utf-8",
      downloadedMessage: "Clipboard permission blocked; report markdown downloaded instead",
    }).then((result) => {
      addAudit(
        "output_generated",
        result.status === "copied"
          ? "Executive report copied to clipboard."
          : "Executive report exported as a fallback download.",
        "low",
        "Reports",
      );
      notify(result.message);
      return result.message;
    });
  }

  function exportWorkspace() {
    const exportPayload = buildWorkspaceExportPayload(workspaceSnapshot);
    const filename = timestampedExportFilename(`${organization.name} workspace export`, "json");
    const downloaded = downloadJsonFile(filename, exportPayload);
    addAudit(
      "output_generated",
      downloaded
        ? `Workspace export ${filename} generated with redacted secrets and provider credentials.`
        : "Workspace export attempted but the browser could not start a download.",
      downloaded ? "low" : "medium",
      "Admin",
    );
    notify(downloaded ? "Workspace export downloaded" : "Workspace export could not be downloaded");
  }

  function importWorkspace(raw: string) {
    const result = parseWorkspaceImport(raw, {
      currentOrganizationId: organization.id,
      currentAISettings: aiSettings,
    });

    if (!result.ok) {
      notify(result.message);
      return;
    }

    const imported = result.imported;
    setWorkspaceMode(imported.workspaceMode);
    setPlatformCatalogs(imported.catalogs);
    setWorkspaceUsers(imported.catalogs.users);
    setOrganization(imported.organization);
    setUseCases(imported.useCases);
    setSkills(imported.skills);
    setRuns(imported.runs);
    setToolRequests(imported.toolRequests);
    setGovernanceReviews(imported.governanceReviews);
    setEvalResults(imported.evalResults);
    setWorkSignals(imported.workSignals);
    setCommandOrders(imported.commandOrders);
    setRuntimeAdapters(imported.runtimeAdapters);
    setRuntimeImportJobs(imported.runtimeImportJobs);
    setNormalizedRuntimeAssets(imported.normalizedRuntimeAssets);
    setInstalledLaunchPacks(imported.installedLaunchPacks);
    setReportSchedules(imported.reportSchedules);
    setRuntimeImportAudits(imported.runtimeImportAudits);
    setAiSettings(imported.aiSettings);
    setAuditLogs([
      {
        id: `audit-${Date.now()}`,
        eventType: "workspace_imported",
        message: `Workspace imported${imported.schema ? ` from ${imported.schema}` : ""}.`,
        actor: "Admin",
        riskLevel: "low",
        createdAt: nowStamp(),
      },
      ...imported.auditLogs,
    ]);
    setNodes(imported.workflowNodes);
    setEdges(imported.workflowEdges);
    setWorkflowStatus(imported.workflowStatus);
    setReport(imported.report);
    setSelectedUseCaseId(imported.selectedUseCaseId);
    setSelectedSkillId(imported.selectedSkillId);
    setSelectedRunId(imported.selectedRunId);
    setImportOpen(false);
    notify("Workspace imported");
  }

  function loadDemoWorkspace() {
    const demo = buildDemoWorkspace(organization.id || "demo");
    setWorkspaceMode("demo");
    setPlatformCatalogs({ users: demoUsers, tools: demoTools, contextSources: demoContextSources });
    setWorkspaceUsers(demoUsers);
    setOrganization(normalizeOrganizationSettings(demo.organization, demo.organizationId));
    setUseCases(demo.useCases);
    setSkills(demo.skills);
    setRuns(demo.runs);
    setToolRequests(demo.toolRequests);
    setGovernanceReviews(demo.governanceReviews);
    setEvalResults(demo.evalResults);
    setWorkSignals(demo.workSignals);
    setCommandOrders([]);
    setRuntimeAdapters(demo.runtimeAdapters);
    setRuntimeImportJobs(demo.runtimeImportJobs);
    setNormalizedRuntimeAssets(demo.normalizedRuntimeAssets);
    setInstalledLaunchPacks(demo.installedLaunchPacks);
    setReportSchedules(demo.reportSchedules);
    setRuntimeImportAudits(demo.runtimeImportAudits);
    setAuditLogs([
      {
        id: `audit-${Date.now()}`,
        eventType: "demo_loaded",
        message: "Northwind Group demo workspace loaded.",
        actor: "Admin",
        riskLevel: "low",
        createdAt: nowStamp(),
      },
      ...demo.auditLogs,
    ]);
    setNodes(demo.workflow.nodes as Node[]);
    setEdges(demo.workflow.edges as Edge[]);
    setWorkflowStatus(demo.workflow.status);
    setReport(demo.report);
    setSelectedUseCaseId(demo.useCases[0]?.id ?? "");
    setSelectedSkillId(demo.skills[0]?.id ?? "");
    setSelectedRunId(demo.runs[0]?.id ?? "");
    setImportOpen(false);
    notify("Demo workspace loaded");
  }

  function applyProductionWorkspaceSwitch() {
    setWorkspaceMode("production");
    clearPlatformCatalogs();
    setWorkspaceUsers([]);
    setUseCases(scrubLegacyDemoRecords(useCases));
    setSkills(scrubLegacyDemoRecords(skills));
    setRuns(normalizeTemporalRecords(scrubLegacyDemoRecords(runs), ["startedAt"]));
    setToolRequests(normalizeTemporalRecords(scrubLegacyDemoRecords(toolRequests), ["requestedAt"]));
    setGovernanceReviews(scrubLegacyDemoRecords(governanceReviews));
    setEvalResults(normalizeTemporalRecords(scrubLegacyDemoRecords(evalResults), ["createdAt"]));
    setWorkSignals(normalizeTemporalRecords(scrubLegacyDemoRecords(workSignals), ["createdAt"]));
    setCommandOrders([]);
    setRuntimeAdapters([]);
    setRuntimeImportJobs([]);
    setNormalizedRuntimeAssets([]);
    setInstalledLaunchPacks([]);
    setReportSchedules([]);
    setRuntimeImportAudits([]);
    setAuditLogs(normalizeTemporalRecords(scrubLegacyDemoRecords(auditLogs), ["createdAt"]).map(normalizeAuditLog));
    if (isLegacyDemoRecord(organization)) {
      setOrganization(DEFAULT_TENANT_SETTINGS);
    }
    setNodes(scrubLegacyWorkflowNodes(nodes));
    setEdges(scrubLegacyWorkflowEdges(scrubLegacyWorkflowNodes(nodes), edges));
    setWorkflowStatus("Saved");
    setReport(isLegacyDemoRecord({ id: "report", report }) ? "" : report);
    setSelectedUseCaseId("");
    setSelectedSkillId("");
    setSelectedRunId("");
    setOnboardingComplete(false);
    setOnboardingDismissed(false);
    notify("Live production mode active");
  }

  function switchToProductionWorkspace() {
    const shouldConfirm = workspaceMode === "demo" || organization.name === "Northwind Group" || useCases.some(isLegacyDemoRecord);
    if (shouldConfirm) {
      setConfirmationAction({
        title: "Switch to live production mode?",
        description: "Demo tenant records will be removed so the workspace starts from real imported or generated data.",
        detail: "This keeps the app in a clean production posture: no Northwind sample users, records, runs, reviews, reports, or workflow artifacts are treated as customer data.",
        confirmLabel: "Switch to Live Mode",
        tone: "danger",
        testId: "production-mode-confirmation",
        onConfirm: applyProductionWorkspaceSwitch,
      });
      return;
    }

    applyProductionWorkspaceSwitch();
  }

  function changeWorkspaceMode(nextMode: WorkspaceMode) {
    if (nextMode === workspaceMode) return;
    if (nextMode === "demo") {
      loadDemoWorkspace();
      return;
    }
    switchToProductionWorkspace();
  }

  function resetWorkspace() {
    setConfirmationAction({
      title: "Clear this workspace?",
      description: "This removes imported records, generated runs, reports, saved settings, and browser cache, then persists the empty workspace to the server.",
      detail: "Use this only when preparing a tenant for a fresh production import. Export the workspace first if any proof packet, report, or configuration should be retained.",
      confirmLabel: "Clear Workspace",
      tone: "danger",
      testId: "reset-workspace-confirmation",
      onConfirm: applyWorkspaceReset,
    });
  }

  function applyWorkspaceReset() {
    setWorkspaceMode("production");
    clearPlatformCatalogs();
    setWorkspaceUsers([]);
    setUseCases([]);
    setSkills([]);
    setRuns([]);
    setToolRequests([]);
    setGovernanceReviews([]);
    setEvalResults([]);
    setWorkSignals([]);
    setCommandOrders([]);
    setRuntimeAdapters([]);
    setRuntimeImportJobs([]);
    setNormalizedRuntimeAssets([]);
    setInstalledLaunchPacks([]);
    setReportSchedules([]);
    setRuntimeImportAudits([]);
    setAiSettings(defaultAISettings);
    setOrganization(DEFAULT_TENANT_SETTINGS);
    setNodes([]);
    setEdges([]);
    setWorkflowStatus("Saved");
    setSelectedUseCaseId("");
    setSelectedSkillId("");
    setSelectedRunId("");
    setReport("");
    setSessionReplies([]);
    setOrchestratorMessages([]);
    setAuditLogs([]);
    setOnboardingComplete(false);
    setOnboardingDismissed(false);
    notify("Local workspace cleared");
  }

  function completeAutonomousOnboarding(draft: OnboardingDraft) {
    const selectedFunctions = draft.functions.length ? draft.functions : (["HR", "Finance", "Legal"] as Department[]);
    const timestamp = Date.now();
    const departmentBlueprints: Partial<Record<Department, {
      title: string;
      capabilityType: string;
      problem: string;
      process: string;
      outcome: string;
      monthlyVolume: number;
      handlingMinutes: number;
      users: number;
      riskLevel: RiskLevel;
      sources: string[];
      benefits: string[];
      risks: string[];
    }>> = {
      HR: {
        title: "Employee Policy Self-Service",
        capabilityType: "knowledge_assistant",
        problem: "Employees wait on HR for repetitive policy questions, creating avoidable case volume and inconsistent answers.",
        process: "Questions are answered through email, tickets, and chat escalations with manual policy lookup.",
        outcome: "A governed HR Skill answers from approved sources, cites policy, and escalates sensitive cases.",
        monthlyVolume: 4200,
        handlingMinutes: 11,
        users: 180,
        riskLevel: "medium",
        sources: ["HR policy handbook", "Benefits guide", "HR case metadata"],
        benefits: ["hours_saved", "employee_experience", "quality_improvement"],
        risks: ["Employee impact", "Policy accuracy", "PII handling"],
      },
      Finance: {
        title: "Finance Close Variance Briefing",
        capabilityType: "agentic_workflow",
        problem: "Finance teams spend days assembling close status, variance explanations, blockers, and owner follow-ups.",
        process: "Analysts manually reconcile spreadsheets, comments, and close calendars before leadership reviews.",
        outcome: "A bounded workflow retrieves approved close artifacts, drafts variance summaries, and routes high-risk items for review.",
        monthlyVolume: 900,
        handlingMinutes: 34,
        users: 70,
        riskLevel: "medium",
        sources: ["Finance close calendar", "Workbook metadata", "Controller review notes"],
        benefits: ["cycle_time_reduction", "hours_saved", "risk_reduction"],
        risks: ["Financial exposure", "Source freshness", "Approval boundary"],
      },
      Legal: {
        title: "Legal Intake Triage",
        capabilityType: "classification",
        problem: "Legal operations receives unstructured requests that need manual classification, urgency review, and routing.",
        process: "Ops coordinators read intake descriptions, hunt for attachments, and assign matters by judgment.",
        outcome: "A triage Skill extracts facts, classifies matter type, flags urgency, and prepares routing recommendations.",
        monthlyVolume: 650,
        handlingMinutes: 22,
        users: 45,
        riskLevel: "medium",
        sources: ["Legal playbook", "Contract repository metadata", "Matter taxonomy"],
        benefits: ["cycle_time_reduction", "quality_improvement", "risk_reduction"],
        risks: ["Legal advice boundary", "External commitment", "Confidential data"],
      },
      Procurement: {
        title: "Supplier Intelligence Comparator",
        capabilityType: "document_intelligence",
        problem: "Procurement teams compare supplier responses and risk data manually across documents and vendor systems.",
        process: "Category managers copy requirements into spreadsheets and request risk summaries from multiple teams.",
        outcome: "A document intelligence workflow compares responses, identifies gaps, and drafts sourcing recommendations with controls.",
        monthlyVolume: 480,
        handlingMinutes: 46,
        users: 55,
        riskLevel: "medium",
        sources: ["Procurement SOP", "Supplier profiles", "RFP response library"],
        benefits: ["hours_saved", "quality_improvement", "cost_avoidance"],
        risks: ["Vendor fairness", "Commercial sensitivity", "Approval boundary"],
      },
      IT: {
        title: "IT Ticket Triage Agent",
        capabilityType: "automation",
        problem: "Service desk queues contain repetitive requests that wait for routing, enrichment, and known-resolution lookup.",
        process: "Agents classify tickets, search knowledge articles, and manually assign owners.",
        outcome: "A Tier 2 workflow classifies tickets, suggests resolution paths, and creates bounded follow-up tasks.",
        monthlyVolume: 5600,
        handlingMinutes: 8,
        users: 120,
        riskLevel: "low",
        sources: ["IT knowledge base", "Service catalog", "Ticket metadata"],
        benefits: ["cycle_time_reduction", "hours_saved", "customer_experience"],
        risks: ["System access", "Incorrect routing", "Knowledge freshness"],
      },
      Operations: {
        title: "Operations Exception Radar",
        capabilityType: "reporting",
        problem: "Operational leaders lack a consistent signal layer for delayed handoffs, rework, and emerging process exceptions.",
        process: "Managers review dashboards, spreadsheets, and meeting notes separately to identify blockers.",
        outcome: "A signal intelligence layer aggregates approved metadata into process exceptions and recommended follow-ups.",
        monthlyVolume: 1700,
        handlingMinutes: 16,
        users: 90,
        riskLevel: "low",
        sources: ["Workflow metadata", "Ticket metadata", "Survey themes"],
        benefits: ["cycle_time_reduction", "quality_improvement", "risk_reduction"],
        risks: ["Individual monitoring boundary", "Signal quality", "Manager interpretation"],
      },
      Marketing: {
        title: "Campaign Brief Generator",
        capabilityType: "summarization",
        problem: "Marketing teams repeatedly assemble briefs from brand guidance, campaign goals, and channel constraints.",
        process: "Specialists draft briefs manually and wait for brand and legal checks.",
        outcome: "A draft-only Skill generates campaign briefs using approved brand and compliance sources.",
        monthlyVolume: 320,
        handlingMinutes: 30,
        users: 40,
        riskLevel: "low",
        sources: ["Brand guidelines", "Campaign playbook", "Legal claims checklist"],
        benefits: ["hours_saved", "quality_improvement", "employee_experience"],
        risks: ["External claims", "Brand consistency", "Approval boundary"],
      },
    };

    const starterUseCases = selectedFunctions.slice(0, 6).map((department, index) => {
      const blueprint =
        departmentBlueprints[department] ??
        ({
          title: `${department} AI Opportunity Triage`,
          capabilityType: "decision_support",
          problem: `${department} has manual knowledge work that needs discovery, value sizing, and governance review.`,
          process: "Teams use interviews, email threads, spreadsheets, and ad hoc reports to coordinate the work.",
          outcome: "The OS will structure the opportunity, identify the right AI pattern, and route it through governance.",
          monthlyVolume: 750,
          handlingMinutes: 18,
          users: 50,
          riskLevel: department === "Security" || department === "Compliance" ? "medium" : "low",
          sources: [`${department} process docs`, "System metadata", "Stakeholder interviews"],
          benefits: ["hours_saved", "quality_improvement", "risk_reduction"],
          risks: ["Data readiness", "Human oversight", "Reuse potential"],
        } satisfies NonNullable<(typeof departmentBlueprints)[Department]>);
      const riskScore = riskToScore(blueprint.riskLevel);
      const valueScore = blueprint.monthlyVolume > 4000 ? 5 : blueprint.monthlyVolume > 1000 ? 4 : 3;
      const feasibilityScore = draft.permissions.includes("knowledge") ? 4 : 3;
      const reuseScore = ["HR", "Finance", "Legal", "IT", "Operations"].includes(department) ? 5 : 4;
      const urgencyScore = draft.setupMode === "real" ? 4 : 3;
      const dataReadinessScore = draft.permissions.includes("knowledge") && draft.permissions.includes("identity") ? 4 : 3;
      return {
        id: `uc-onboarding-${timestamp}-${index}`,
        title: blueprint.title,
        description: blueprint.outcome,
        department,
        requestorId: currentUserId,
        ownerId: currentUserId,
        businessProblem: blueprint.problem,
        currentProcess: blueprint.process,
        desiredOutcome: blueprint.outcome,
        monthlyVolume: blueprint.monthlyVolume,
        avgHandlingTimeMinutes: blueprint.handlingMinutes,
        estimatedUsers: blueprint.users,
        capabilityType: blueprint.capabilityType,
        status: "scored",
        riskLevel: blueprint.riskLevel,
        valueScore,
        feasibilityScore,
        riskScore,
        reuseScore,
        urgencyScore,
        dataReadinessScore,
        priorityScore: calculatePriorityScore({
          valueScore,
          feasibilityScore,
          reuseScore,
          urgencyScore,
          dataReadinessScore,
          riskScore,
        }),
        expectedBenefits: blueprint.benefits,
        dataSources: blueprint.sources,
        risks: blueprint.risks,
        updatedAt: todayStamp(),
        createdAt: todayStamp(),
      } satisfies UseCase;
    });

    const starterSignals: WorkSignal[] = selectedFunctions.slice(0, 5).map((department, index) => ({
      id: `signal-onboarding-${timestamp}-${index}`,
      source: draft.permissions.includes("tickets") ? "service_now" : "survey",
      eventType: draft.permissions.includes("workSignals") ? "process_variant" : "question_asked",
      department,
      process: `${department} enablement discovery`,
      summary: `${department} selected for the first AI enablement scan. Only aggregated metadata and approved business records are eligible for analysis.`,
      metadata: {
        volume: 250 + index * 75,
        confidence: 0.74,
        system: "onboarding-readiness-scan",
        region: "global",
      },
      privacy: {
        contentRedacted: true,
        piiRedacted: true,
        consentBasis: draft.permissions.includes("workSignals") ? "system_metadata" : "explicit_opt_in",
        retentionDays: 90,
        individualScoringAllowed: false,
        rawContentStored: false,
      },
      riskLevel: department === "Legal" || department === "Finance" ? "medium" : "low",
      createdAt: nowStamp(),
    }));

    const onboardingTools: Tool[] = [
      {
        id: "identity.read_group_membership",
        displayName: "Identity group membership",
        description: "Read-only SSO group and department metadata for RBAC checks.",
        category: "identity",
        actionType: "read",
        riskLevel: "low",
        requiresApprovalByDefault: false,
        enabled: draft.permissions.includes("identity"),
        usage: 0,
        lastUsed: "Not used",
      },
      {
        id: "knowledge.search_approved_sources",
        displayName: "Approved source search",
        description: "Permission-aware retrieval across approved enterprise knowledge sources.",
        category: "document",
        actionType: "read",
        riskLevel: "low",
        requiresApprovalByDefault: false,
        enabled: draft.permissions.includes("knowledge"),
        usage: 0,
        lastUsed: "Not used",
      },
      {
        id: "service_now.read_ticket_metadata",
        displayName: "Ticket metadata reader",
        description: "Reads ticket categories, timestamps, and status fields without storing raw private messages.",
        category: "ticketing",
        actionType: "read",
        riskLevel: "medium",
        requiresApprovalByDefault: false,
        enabled: draft.permissions.includes("tickets"),
        usage: 0,
        lastUsed: "Not used",
      },
      {
        id: "jira.create_enablement_task",
        displayName: "Create enablement task",
        description: "Creates implementation tasks after human approval.",
        category: "workflow",
        actionType: "create",
        riskLevel: "medium",
        requiresApprovalByDefault: true,
        enabled: true,
        usage: 0,
        lastUsed: "Not used",
      },
    ];
    const onboardingSources: ContextSource[] = [
      {
        id: "ctx-approved-knowledge",
        name: "Approved Knowledge Sources",
        type: "knowledge_catalog",
        classification: "internal",
        ownerDepartment: "Data",
        enabled: draft.permissions.includes("knowledge"),
        lastIndexedAt: "Pending first index",
        documentCount: 0,
        skillsUsing: 0,
        health: "attention",
      },
      {
        id: "ctx-governance-controls",
        name: "Responsible AI Controls",
        type: "governance_repository",
        classification: "confidential",
        ownerDepartment: "Compliance",
        enabled: draft.permissions.includes("governance"),
        lastIndexedAt: "Pending governance import",
        documentCount: 0,
        skillsUsing: 0,
        health: "attention",
      },
    ];
    const firstUseCase = starterUseCases[0];
    const generatedSkillId = `skill-onboarding-${timestamp}`;
    const allowedOnboardingTools = Array.from(
      new Set([
        ...tools.filter((tool) => tool.enabled && tool.actionType === "read").slice(0, 2).map((tool) => tool.id),
        ...onboardingTools.filter((tool) => tool.enabled || tool.requiresApprovalByDefault).map((tool) => tool.id),
      ]),
    );
    const generatedSkill: Skill | null = firstUseCase
      ? {
          id: generatedSkillId,
          useCaseId: firstUseCase.id,
          name: `${firstUseCase.title} Skill`,
          slug: firstUseCase.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          description: firstUseCase.desiredOutcome,
          department: firstUseCase.department,
          ownerId: currentUserId,
          status: "in_review",
          version: "0.1.0",
          riskLevel: firstUseCase.riskLevel,
          autonomyTier: firstUseCase.riskLevel === "low" ? "tier_1_read_only" : "tier_2_prepare_action",
          modelProvider: aiSettings.defaultProvider,
          model: aiSettings.defaultModel,
          temperature: 0.2,
          maxTokens: 2200,
          fallbackModel: aiSettings.fallbackModel,
          costLimit: 0.35,
          systemPrompt: `You are the ${firstUseCase.title} Skill running inside the Enterprise AI Harness.\n\nUse only approved tenant context. Cite source names when available. Do not make employment, legal, financial, or external commitments. Prepare actions for human approval when tool policy requires it. If context is insufficient, say what is missing and route to the assigned owner.`,
          allowedTools: allowedOnboardingTools,
          blockedTools: [...tools, ...onboardingTools]
            .filter((tool) => !allowedOnboardingTools.includes(tool.id) && (!tool.enabled || tool.riskLevel === "restricted"))
            .map((tool) => tool.id),
          contextSources: Array.from(new Set([...firstUseCase.dataSources, "Approved Knowledge Sources", "Responsible AI Controls"])),
          evalPassRate: 82,
          adoptionCount: 0,
          valueDelivered: 0,
          runs: 0,
          updatedAt: todayStamp(),
        }
      : null;
    const baselineEval: EvalResult | null = generatedSkill
      ? {
          id: `eval-onboarding-${timestamp}`,
          skillId: generatedSkill.id,
          suiteName: `${generatedSkill.name} Setup Baseline`,
          score: 82,
          passed: false,
          criticalFailures: 1,
          createdAt: nowStamp(),
        }
      : null;
    const baselineReview: GovernanceReview | null = generatedSkill
      ? {
          id: `gov-onboarding-${timestamp}`,
          itemType: "skill",
          itemId: generatedSkill.id,
          title: `${generatedSkill.name} Launch Review`,
          department: generatedSkill.department,
          riskLevel: generatedSkill.riskLevel,
          reviewer: "Security / Legal / Privacy",
          status: "in_review",
          dueDate: todayStamp(),
          blockers: ["Confirm data owner approvals", "Run full launch readiness eval suite"],
        }
      : null;
    const workflowTemplate = createWorkflowTemplate(firstUseCase?.riskLevel === "low" ? "knowledge" : "approval");
    const starterUseCasesWithLinks = generatedSkill
      ? starterUseCases.map((useCase, index) =>
          index === 0
            ? {
                ...useCase,
                linkedSkillId: generatedSkill.id,
                status: "governance_review" as const,
              }
            : useCase,
        )
      : starterUseCases;
    const existingToolIds = new Set(tools.map((tool) => tool.id));
    const existingSourceIds = new Set(platformContextSources.map((source) => source.id));
    const onboardingUsers = workspaceUsers.length
      ? workspaceUsers
      : [
          {
            id: currentUserId,
            name: currentUserName,
            email: currentUserEmail,
            title: currentWorkspaceUser.title,
            department: currentWorkspaceUser.department,
            role: currentWorkspaceUser.role,
          },
        ];
    setPlatformCatalogs({
      users: onboardingUsers,
      tools: [...tools, ...onboardingTools.filter((tool) => !existingToolIds.has(tool.id))],
      contextSources: [
        ...platformContextSources,
        ...onboardingSources.filter((source) => !existingSourceIds.has(source.id)),
      ],
    });
    setWorkspaceUsers(onboardingUsers);

    const updatedOrganization = normalizeOrganizationSettings(
      {
        ...organization,
        name: draft.companyName.trim() || organization.name,
        workspaceLabel: draft.workspaceLabel.trim() || organization.workspaceLabel,
        updatedAt: new Date().toISOString(),
      },
      organization.id,
    );
    const launchReport = `# ${updatedOrganization.name} AI Enablement Launch Plan

## Setup Mode
${draft.setupMode === "real" ? "Production onboarding" : draft.setupMode === "pilot" ? "Guided pilot workspace" : "Demo evaluation workspace"}

## Permissions Approved
${draft.permissions.map((permission) => `- ${permission}`).join("\n")}

## First Operating Plan
1. Validate identity groups, department owners, and reviewer roles.
2. Run discovery sessions for ${selectedFunctions.join(", ")}.
3. Confirm approved context sources and data classifications.
4. Complete the generated Skill launch review and approve the first pilot scope.
5. Run the Harness trace and full eval suite before pilot launch.

## Generated Launch Package
${generatedSkill ? `- First Skill: ${generatedSkill.name} (${generatedSkill.autonomyTier.replaceAll("_", " ")})` : "- First Skill: pending"}
${baselineReview ? `- Governance Review: ${baselineReview.title} (${statusLabels[baselineReview.status]})` : "- Governance Review: pending"}
${baselineEval ? `- Baseline Eval: ${baselineEval.score}/100; full launch suite required before pilot` : "- Baseline Eval: pending"}
- Workflow Blueprint: ${workflowTemplate.nodes.length} blocks with ${workflowTemplate.edges.length} governed connections

## Starter Opportunities
${starterUseCasesWithLinks.map((item) => `- ${item.title}: priority ${item.priorityScore}/100, ${item.riskLevel} risk`).join("\n")}

## Privacy Guardrail
Work intelligence is limited to aggregated metadata, explicit opt-in records, or business records. Individual scoring, raw private-message storage, and covert monitoring are disabled by policy.`;

    setOrganization(updatedOrganization);
    setWorkspaceMode(draft.setupMode === "demo" ? "demo" : "production");
    setUseCases((current) => [...starterUseCasesWithLinks, ...current]);
    if (generatedSkill) {
      setSkills((current) => [generatedSkill, ...current]);
      setSelectedSkillId(generatedSkill.id);
    }
    if (baselineReview) {
      setGovernanceReviews((current) => [baselineReview, ...current]);
    }
    if (baselineEval) {
      setEvalResults((current) => [baselineEval, ...current]);
    }
    if (nodes.length === 0) {
      setNodes(workflowTemplate.nodes);
      setEdges(workflowTemplate.edges);
      setWorkflowStatus("Saved");
      setTestOutput("Guided setup loaded a governed workflow blueprint. Configure source permissions, approval roles, and tool policy before publishing.");
    }
    setWorkSignals((current) => [...starterSignals, ...current]);
    setReport(launchReport);
    setSelectedUseCaseId(starterUseCasesWithLinks[0]?.id ?? "");
    setFactoryTab("overview");
    setSkillMode(generatedSkill ? "detail" : "overview");
    setSkillTab("overview");
    setOnboardingComplete(true);
    setOnboardingDismissed(false);
    writeStoredValue("eaieos:onboardingComplete", true);
    writeStoredValue("eaieos:onboardingDismissed", false);
    setOnboardingOpen(false);
    setLaunchHandoffOpen(true);
    setActiveView("command");
    setOrchestratorMessages((current) => [
      {
        id: `om-onboarding-${timestamp}`,
        role: "assistant",
        content: `${updatedOrganization.name} is configured. I created the launch portfolio, generated the first Skill package, loaded a governed workflow blueprint, and opened the Command Center launch checklist. The next best action is to resolve the generated governance review and run the full launch readiness eval.`,
        createdAt: nowStamp(),
        actions: [
          makeOrchestratorAction("open_view", "Open Skills", "Inspect the generated Skill package.", { view: "skills" }),
          makeOrchestratorAction("run_selected_eval", "Run full eval", "Run the selected Skill through the launch suite.", undefined, "primary"),
          makeOrchestratorAction("open_view", "Open Risk Review", "Review launch blockers and decisions.", { view: "governance" }),
        ],
        evidence: [
          { label: "Use cases", value: String(starterUseCasesWithLinks.length) },
          { label: "Skill package", value: generatedSkill?.name ?? "pending" },
          { label: "Workflow blocks", value: String(workflowTemplate.nodes.length) },
        ],
      },
      ...current,
    ]);
    addAudit(
      "tenant_onboarding_completed",
      `${updatedOrganization.name} setup generated ${starterUseCasesWithLinks.length} opportunities, ${generatedSkill ? "1 Skill package, " : ""}${starterSignals.length} privacy-safe work signals, and a workflow blueprint.`,
      "low",
      "Onboarding Agent",
    );
    notify("Autonomous setup generated the first launch package");
  }

  function onConnect(connection: Connection) {
    setEdges((current) => addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, current));
  }

  function updateOrganization(nextSettings: Partial<OrganizationSettings>) {
    setOrganization((current) =>
      normalizeOrganizationSettings(
        {
          ...current,
          ...nextSettings,
          updatedAt: new Date().toISOString(),
        },
        current.id,
      ),
    );
    addAudit("tenant_branding_updated", "Tenant branding settings updated.", "low", "Admin");
    notify("Tenant branding saved");
  }

  function commitWorkspaceUsers(nextUsers: User[]) {
    const deduped = sortWorkspaceUsers(Array.from(new Map(nextUsers.map((user) => [user.id, user])).values()));
    setWorkspaceUsers(deduped);
    setPlatformCatalogs({ users: deduped });
  }

  async function upsertWorkspaceUser(user: User) {
    const localMutation = upsertWorkspaceUserInList(workspaceUsers, user);
    if (!localMutation.ok) {
      notify(localMutation.message);
      return;
    }

    commitWorkspaceUsers(localMutation.users);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localMutation.user),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        users?: User[];
        user?: User;
        auditLog?: AuditLog;
      };

      if (response.ok && payload.users?.length !== undefined) {
        commitWorkspaceUsers(payload.users);
        if (payload.auditLog) setAuditLogs((current) => [payload.auditLog as AuditLog, ...current]);
        notify(`${payload.user?.name ?? localMutation.user.name} saved`);
        return;
      }

      if (![503, 500].includes(response.status)) {
        commitWorkspaceUsers(workspaceUsers);
        notify(payload.error ?? "Member could not be saved");
        return;
      }
    } catch {
      // Local workspace mode keeps Admin usable when the server is offline during development.
    }

    addAudit(
      "workspace_member_upserted",
      `${localMutation.user.name} was ${localMutation.action} as ${localMutation.user.role}.`,
      "low",
      "Admin",
    );
    notify(`${localMutation.user.name} saved locally`);
  }

  async function removeWorkspaceUser(userId: string) {
    const localMutation = removeWorkspaceUserFromList(workspaceUsers, userId);
    if (!localMutation.ok) {
      notify(localMutation.message);
      return;
    }

    commitWorkspaceUsers(localMutation.users);

    try {
      const response = await fetch(`/api/users?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        users?: User[];
        auditLog?: AuditLog;
      };

      if (response.ok && payload.users?.length !== undefined) {
        commitWorkspaceUsers(payload.users);
        if (payload.auditLog) setAuditLogs((current) => [payload.auditLog as AuditLog, ...current]);
        notify(`${localMutation.user.name} removed`);
        return;
      }

      if (response.status === 404) {
        addAudit("workspace_member_removed", `${localMutation.user.name} was removed from the local tenant roster.`, "medium", "Admin");
        notify(`${localMutation.user.name} removed locally`);
        return;
      }

      if (![503, 500].includes(response.status)) {
        commitWorkspaceUsers(workspaceUsers);
        notify(payload.error ?? "Member could not be removed");
        return;
      }
    } catch {
      // Local workspace mode keeps Admin usable when the server is offline during development.
    }

    addAudit("workspace_member_removed", `${localMutation.user.name} was removed from the tenant roster.`, "medium", "Admin");
    notify(`${localMutation.user.name} removed locally`);
  }

  async function refreshProviderVaultAndReadiness() {
    const [providerResponse, readinessResponse] = await Promise.all([
      fetch("/api/providers", { cache: "no-store" }),
      fetch("/api/readiness", { cache: "no-store" }),
    ]);
    if (providerResponse.ok) {
      const payload = (await providerResponse.json()) as {
        generatedAt?: string;
        providers?: ProviderReadiness[];
      };
      setProviderVault(payload.providers ?? []);
      setProviderVaultCheckedAt(payload.generatedAt ? new Date(payload.generatedAt).toLocaleTimeString() : nowStamp());
    }
    setProductionReadiness(readinessResponse.ok ? ((await readinessResponse.json()) as ProductionReadiness) : null);
  }

  async function sealLegacyAuditChain() {
    const response = await fetch("/api/audit", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seal_legacy_chain" }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { changed?: boolean; resealed?: number; note?: string; detail?: string; error?: string }
      | null;
    if (!response.ok) {
      throw new Error(payload?.detail || payload?.error || "Audit chain could not be sealed.");
    }

    const auditResponse = await fetch("/api/audit?verify=true&limit=1000", { cache: "no-store" });
    if (auditResponse.ok) {
      const auditPayload = (await auditResponse.json()) as { auditLogs?: AuditLog[] };
      if (auditPayload.auditLogs) setAuditLogs(auditPayload.auditLogs.map(normalizeAuditLog));
    }
    await refreshProviderVaultAndReadiness();
    notify(payload?.changed ? `Sealed ${payload.resealed ?? 0} legacy audit records` : "Audit chain already verified");
  }

  async function verifyAuditChain() {
    const response = await fetch("/api/audit?verify=true&limit=1000", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as
      | { integrity?: AuditIntegrityVerification; auditLogs?: AuditLog[]; error?: string }
      | null;
    if (!response.ok || !payload?.integrity) {
      throw new Error(payload?.error || "Audit chain verification failed.");
    }
    setAuditIntegrity(payload.integrity);
    if (payload.auditLogs) setAuditLogs(payload.auditLogs.map(normalizeAuditLog));
    notify(
      payload.integrity.verified
        ? `Audit chain verified — ${payload.integrity.checked} record${payload.integrity.checked === 1 ? "" : "s"} intact`
        : `Audit chain has ${payload.integrity.gaps.length} integrity gap${payload.integrity.gaps.length === 1 ? "" : "s"}`,
    );
  }

  async function saveAISettings(nextSettings: AIProviderSettings) {
    const normalized = applyProviderRoutingDefaults(nextSettings);
    const safeSettings = redactAISettingsSecrets(normalized);
    const secrets = providerSecretsPayload(normalized);
    const secretCount = Object.keys(secrets).length;
    let secretImpact: TenantSecretReadinessImpact | undefined;

    try {
      if (secretCount) {
        const secretResponse = await fetch("/api/provider-secrets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "provider", secrets }),
        });
        const detail = (await secretResponse.json().catch(() => null)) as TenantSecretSaveResponse | null;
        if (!secretResponse.ok) {
          throw new Error(detail?.detail || detail?.error || `Provider vault returned ${secretResponse.status}`);
        }
        secretImpact = detail?.connectionImpact;
        if (detail?.auditLog) appendControlPlaneAudit(detail.auditLog);
      }

      await refreshProviderVaultAndReadiness();

      setAiSettings(safeSettings);
      writeStoredValue("eaieos:aiSettings", safeSettings);
      addAudit("provider_settings_updated", "AI provider settings saved to the server vault and routing policy updated.", "low", "Admin");
      notify(secretCount ? secretSaveToast("provider", secretCount, secretImpact) : "AI routing settings saved");
      setSettingsOpen(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "AI settings could not be saved");
    }
  }

  async function saveConnectorSecrets(secrets: Record<string, string>) {
    const cleanedSecrets = Object.fromEntries(
      Object.entries(secrets)
        .map(([name, value]) => [name, value.trim()] as const)
        .filter(([name, value]) => name.length > 0 && value.length > 0),
    );
    const savedCount = Object.keys(cleanedSecrets).length;

    if (!savedCount) {
      notify("No connector secrets entered");
      return;
    }

    try {
      const secretResponse = await fetch("/api/provider-secrets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "connector", secrets: cleanedSecrets }),
      });
      const detail = (await secretResponse.json().catch(() => null)) as TenantSecretSaveResponse | null;
      if (!secretResponse.ok) {
        throw new Error(detail?.detail || detail?.error || `Tenant vault returned ${secretResponse.status}`);
      }

      if (detail?.auditLog) appendControlPlaneAudit(detail.auditLog);
      await refreshProviderVaultAndReadiness();
      notify(secretSaveToast("connector", savedCount, detail?.connectionImpact));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Connector secrets could not be saved");
      throw error;
    }
  }

  async function deleteTenantSecrets(names: string[]) {
    const uniqueNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
    if (!uniqueNames.length) {
      notify("No tenant secrets selected for cleanup");
      return;
    }

    try {
      const secretResponse = await fetch("/api/provider-secrets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "tenant", names: uniqueNames }),
      });
      const detail = (await secretResponse.json().catch(() => null)) as TenantSecretSaveResponse | null;
      if (!secretResponse.ok) {
        throw new Error(detail?.detail || detail?.error || `Tenant vault returned ${secretResponse.status}`);
      }

      if (detail?.auditLog) appendControlPlaneAudit(detail.auditLog);
      await refreshProviderVaultAndReadiness();
      notify(`${detail?.deletedNames?.length ?? uniqueNames.length} tenant secret${(detail?.deletedNames?.length ?? uniqueNames.length) === 1 ? "" : "s"} removed from the vault`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Tenant secrets could not be deleted");
      throw error;
    }
  }

  if (!clientReady || !hasHydrated) {
    return <BootShell />;
  }

  if (authGateRequired) {
    return <AuthGate readiness={productionReadiness} />;
  }

  return (
    <>
      <AppShell
        organization={organization}
        activeView={activeView}
        activeSurfaceLabel={activeSurfaceLabel}
        selectedUseCaseTitle={selectedUseCase?.title}
        selectedSkillName={selectedSkill?.name}
        selectedRunId={selectedRun?.id}
        onboardingComplete={onboardingComplete}
        expandedHubs={expandedHubs}
        activeHubId={activeHubId}
        commandQuery={commandQuery}
        commandOpen={commandOpen}
        actionInboxOpenCount={actionInboxOpenCount}
        notificationsOpen={notificationsOpen}
        helpOpen={helpOpen}
        settingsOpen={settingsOpen}
        profileOpen={profileOpen}
        profileDisplayName={profileDisplayName}
        profileModeLabel={profileModeLabel}
        workspaceMode={workspaceMode}
        onWorkspaceModeChange={changeWorkspaceMode}
        productionReadiness={productionReadiness}
        workspaceSaveStatus={workspaceSaveStatus}
        workspaceSavedAt={workspaceSavedAt}
        assistantBusy={orchestratorBusy}
        experienceMode={experienceMode}
        interfaceMode={interfaceMode}
        onOpenView={(view) => {
          setProfileOpen(false);
          openView(view);
        }}
        onToggleHub={toggleHub}
        onOpenLaunchFlow={() => {
          setProfileOpen(false);
          if (onboardingComplete) {
            setLaunchHandoffOpen(true);
          } else {
            setOnboardingOpen(true);
          }
        }}
        onBackHome={() => setActiveView("command")}
        onCommandQueryChange={setCommandQuery}
        onCommandOpen={() => setCommandOpen(true)}
        onOpenNotifications={() => {
          setProfileOpen(false);
          setNotificationsOpen(true);
        }}
        onOpenHelp={() => {
          setProfileOpen(false);
          setHelpOpen(true);
        }}
        onOpenSettings={() => {
          setProfileOpen(false);
          setSettingsOpen(true);
        }}
        onExperienceModeChange={setExperienceMode}
        onInterfaceModeChange={setInterfaceMode}
        onToggleProfile={() => {
          setNotificationsOpen(false);
          setHelpOpen(false);
          setProfileOpen((current) => !current);
        }}
        onCloseProfile={() => setProfileOpen(false)}
        onGlobalAssistantSubmit={(prompt) => sendOrchestratorMessage(prompt)}
      >
        <AppViewRouter
          activeView={activeView}
          organization={organization}
          metrics={metrics}
          functionData={functionData}
          statusData={statusData}
          useCases={useCases}
          skills={reconciledSkills}
          governanceReviews={governanceReviews}
          evalResults={evalResults}
          runs={runs}
          toolRequests={toolRequests}
          auditLogs={auditLogs}
          users={workspaceUsers}
          report={report}
          reportGenerationMeta={reportGenerationMeta}
          workflowStatus={workflowStatus}
          enterpriseMaturity={enterpriseMaturity}
          integrationBlueprint={integrationBlueprint}
          compoundLearningLoop={compoundLearningLoop}
          transformationCommand={transformationCommand}
          commandOrders={commandOrders}
          runtimeAdapters={runtimeAdapters}
          runtimeImportJobs={runtimeImportJobs}
          normalizedRuntimeAssets={normalizedRuntimeAssets}
          installedLaunchPacks={installedLaunchPacks}
          reportSchedules={reportSchedules}
          runtimeImportAudits={runtimeImportAudits}
          orchestratorMessages={orchestratorMessages}
          orchestratorInput={orchestratorInput}
          orchestratorBusy={orchestratorBusy}
          setOrchestratorInput={setOrchestratorInput}
          workflowValidation={workflowValidation}
          selectedUseCase={selectedUseCase}
          selectedSkill={selectedSkill}
          selectedRun={selectedRun}
          productionReadiness={productionReadiness}
          providerVault={providerVault}
          actionInboxItems={actionInboxItems}
          primetimeLaunchGate={primetimeLaunchGate}
          companyBlueprint={companyBlueprint}
          workSignals={workSignals}
          contextSources={platformContextSources}
          factoryTab={factoryTab}
          intakeStep={intakeStep}
          intake={intake}
          skillMode={skillMode}
          skillTab={skillTab}
          harnessMode={harnessMode}
          workflowMode={workflowMode}
          nodes={nodes}
          edges={edges}
          retrievalQuery={retrievalQuery}
          workspaceMode={workspaceMode}
          aiSettings={aiSettings}
          providerVaultCheckedAt={providerVaultCheckedAt}
          testOutput={testOutput}
          sessionFollowUp={sessionFollowUp}
          sessionReplies={sessionReplies}
          setActiveView={setActiveView}
          setFactoryTab={setFactoryTab}
          setIntakeStep={setIntakeStep}
          setIntake={setIntake}
          setSelectedUseCaseId={setSelectedUseCaseId}
          setSelectedSkillId={setSelectedSkillId}
          setSelectedRunId={setSelectedRunId}
          setSkillMode={setSkillMode}
          setSkillTab={setSkillTab}
          setHarnessMode={setHarnessMode}
          setWorkflowMode={setWorkflowMode}
          setNodes={setNodes}
          setEdges={setEdges}
          setRetrievalQuery={setRetrievalQuery}
          setSessionFollowUp={setSessionFollowUp}
          setImportOpen={setImportOpen}
          setOnboardingOpen={setOnboardingOpen}
          setSettingsOpen={setSettingsOpen}
          openView={openView}
          openCommandOrder={openCommandOrder}
          completeCommandOrderRecord={completeCommandOrderRecord}
          generateExecBrief={generateExecBrief}
          clearOrchestratorChat={clearOrchestratorChat}
          sendOrchestratorMessage={sendOrchestratorMessage}
          executeOrchestratorAction={executeOrchestratorAction}
          submitUseCase={submitUseCase}
          createUseCaseFromWorkOpportunity={createUseCaseFromWorkOpportunity}
          convertUseCaseToSkill={convertUseCaseToSkill}
          requestUseCaseGovernance={requestUseCaseGovernance}
          updateSkillPrompt={updateSkillPrompt}
          updateSkill={updateSkill}
          toggleSkillTool={toggleSkillTool}
          runSkillTest={runSkillTest}
          runEvalSuite={runEvalSuite}
          submitGovernanceReview={submitGovernanceReview}
          installPattern={installPattern}
          decideToolRequest={decideToolRequest}
          toggleSkillKillSwitch={toggleSkillKillSwitch}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          testWorkflow={testWorkflow}
          validateWorkflow={validateWorkflow}
          addWorkflowBlock={addWorkflowBlock}
          loadWorkflowTemplate={loadWorkflowTemplate}
          clearWorkflow={clearWorkflow}
          publishWorkflow={publishWorkflow}
          decideGovernance={decideGovernance}
          copyReport={copyReport}
          updateOrganization={updateOrganization}
          exportWorkspace={exportWorkspace}
          loadDemoWorkspace={loadDemoWorkspace}
          changeWorkspaceMode={changeWorkspaceMode}
          sealLegacyAuditChain={sealLegacyAuditChain}
          verifyAuditChain={verifyAuditChain}
          auditIntegrity={auditIntegrity}
          resetWorkspace={resetWorkspace}
          saveConnectorSecrets={saveConnectorSecrets}
          onTestRuntimeAdapter={testRuntimeAdapter}
          onCommitRuntimeImport={commitRuntimeImport}
          onInstallLaunchPack={installLaunchPack}
          onCreateDefaultReportSchedules={createDefaultReportSchedules}
          onToggleReportSchedule={toggleReportSchedule}
          upsertWorkspaceUser={upsertWorkspaceUser}
          removeWorkspaceUser={removeWorkspaceUser}
          sendSessionFollowUp={sendSessionFollowUp}
        />
      </AppShell>

      <AppOverlays
        toast={toast}
        notificationsOpen={notificationsOpen}
        actionInboxItems={actionInboxItems}
        actionInboxOpenCount={actionInboxOpenCount}
        commandOpen={commandOpen}
        commandQuery={commandQuery}
        commandItems={commandItems}
        activeView={activeView}
        settingsOpen={settingsOpen}
        aiSettings={aiSettings}
        providerVault={providerVault}
        productionReadiness={productionReadiness}
        helpOpen={helpOpen}
        launchHandoffOpen={launchHandoffOpen}
        launchHandoff={launchHandoff}
        importOpen={importOpen}
        onboardingOpen={onboardingOpen}
        organization={organization}
        confirmationAction={confirmationAction}
        setCommandQuery={setCommandQuery}
        onCloseNotifications={() => setNotificationsOpen(false)}
        onOpenInboxItem={openInboxItem}
        onCloseCommand={() => setCommandOpen(false)}
        onCloseSettings={() => setSettingsOpen(false)}
        onSaveAISettings={saveAISettings}
        onSaveConnectorSecrets={saveConnectorSecrets}
        onDeleteTenantSecrets={deleteTenantSecrets}
        onOpenConnectors={() => {
          setSettingsOpen(false);
          openView("connectors");
        }}
        onCloseHelp={() => setHelpOpen(false)}
        onOpenHelpSetup={() => {
          setHelpOpen(false);
          setOnboardingOpen(true);
        }}
        onOpenHelpView={(view) => {
          setHelpOpen(false);
          openView(view);
        }}
        onCloseLaunchHandoff={() => setLaunchHandoffOpen(false)}
        onOpenLaunchHandoffStep={(step) => void openLaunchHandoffStep(step)}
        onOpenLaunchOrchestrator={() => {
          setLaunchHandoffOpen(false);
          setActiveView("orchestrator");
        }}
        onCloseImport={() => setImportOpen(false)}
        onImportWorkspace={importWorkspace}
        onCloseOnboarding={() => {
          setOnboardingOpen(false);
          setOnboardingDismissed(true);
          writeStoredValue("eaieos:onboardingDismissed", true);
        }}
        onCompleteOnboarding={completeAutonomousOnboarding}
        onCloseConfirmation={() => setConfirmationAction(null)}
      />
    </>
  );
}
