import type { Edge, Node } from "@xyflow/react";

import {
  contextSources as platformContextSources,
  initialAuditLogs,
  initialEvalResults,
  initialGovernanceReviews,
  initialRuns,
  initialSkills,
  initialToolRequests,
  initialUseCases,
  initialWorkSignals,
  tools,
  users as platformUsers,
  type ContextSource,
  type AuditLog,
  type EvalResult,
  type GovernanceReview,
  type Run,
  type Skill,
  type Tool,
  type ToolRequest,
  type UseCase,
  type User,
  type WorkSignal,
} from "./enterprise-ai-data.ts";
import { demoContextSources, demoTools, demoUsers, demoWorkSignals } from "./demo/demo-workspace.ts";
import { defaultAISettings, normalizeAISettings, redactAISettingsSecrets, type AIProviderSettings } from "./model-router.ts";
import { normalizeCommandOrders } from "./command-orders.ts";
import {
  normalizeInstalledLaunchPacks,
  normalizeReportSchedules,
  normalizeRuntimeAdapterRecords,
  normalizeRuntimeAssets,
  normalizeRuntimeImportAudits,
  normalizeRuntimeImportJobs,
} from "./runtime-control-plane.ts";
import { normalizeAuditLog, normalizeTemporalRecords } from "./ui/format.ts";
import { readStoredValue } from "./ui/storage.ts";
import {
  defaultOrganizationSettings,
  normalizeOrganizationSettings,
  normalizeWorkspaceMode,
  type EnterpriseWorkspace,
  type OrganizationSettings,
  type WorkspaceMode,
} from "./workspace-schema.ts";
import {
  isLegacyDemoRecord,
  normalizeWorkflowNodes,
  scrubLegacyDemoRecords,
  scrubLegacyWorkflowEdges,
  scrubLegacyWorkflowNodes,
} from "./workflow/legacy.ts";

const DEFAULT_TENANT_SETTINGS = defaultOrganizationSettings("default");

type CatalogState = {
  users: User[];
  tools: Tool[];
  contextSources: ContextSource[];
};

export type BrowserWorkspaceState = {
  localAISettings: AIProviderSettings;
  workspace: Partial<EnterpriseWorkspace>;
};

export type ResolvedWorkspaceClientState = {
  workspaceMode: WorkspaceMode;
  organization: OrganizationSettings;
  catalogs: CatalogState;
  useCases: EnterpriseWorkspace["useCases"];
  skills: EnterpriseWorkspace["skills"];
  runs: EnterpriseWorkspace["runs"];
  toolRequests: EnterpriseWorkspace["toolRequests"];
  auditLogs: EnterpriseWorkspace["auditLogs"];
  governanceReviews: EnterpriseWorkspace["governanceReviews"];
  evalResults: EnterpriseWorkspace["evalResults"];
  workSignals: EnterpriseWorkspace["workSignals"];
  commandOrders: EnterpriseWorkspace["commandOrders"];
  runtimeAdapters: EnterpriseWorkspace["runtimeAdapters"];
  runtimeImportJobs: EnterpriseWorkspace["runtimeImportJobs"];
  normalizedRuntimeAssets: EnterpriseWorkspace["normalizedRuntimeAssets"];
  installedLaunchPacks: EnterpriseWorkspace["installedLaunchPacks"];
  reportSchedules: EnterpriseWorkspace["reportSchedules"];
  runtimeImportAudits: EnterpriseWorkspace["runtimeImportAudits"];
  aiSettings: AIProviderSettings;
  workflowStatus: EnterpriseWorkspace["workflow"]["status"];
  workflowNodes: Node[];
  workflowEdges: Edge[];
  report: string;
};

export type ImportedWorkspaceState = ResolvedWorkspaceClientState & {
  schema?: string;
  selectedUseCaseId: string;
  selectedSkillId: string;
  selectedRunId: string;
};

export type WorkspaceImportResult =
  | { ok: true; imported: ImportedWorkspaceState }
  | { ok: false; message: string };

function scrubForWorkspaceMode<T>(workspaceMode: WorkspaceMode, records: T[]) {
  return workspaceMode === "demo" ? records : scrubLegacyDemoRecords(records);
}

function isNorthwindDemoWorkspace(workspaceMode: WorkspaceMode, organization: OrganizationSettings, useCases: unknown[]) {
  return (
    workspaceMode === "demo" &&
    organization.name === "Northwind Group" &&
    useCases.some((item) => typeof item === "object" && item !== null && String((item as { id?: unknown }).id ?? "").startsWith("uc-"))
  );
}

function mergeCatalogById<T extends { id: string }>(primary: T[], fallback: T[]) {
  const seen = new Set(primary.map((item) => item.id));
  return [...primary, ...fallback.filter((item) => !seen.has(item.id))];
}

function normalizeClientAISettings(input: Partial<AIProviderSettings> | undefined) {
  return redactAISettingsSecrets(normalizeAISettings(input ?? defaultAISettings));
}

export function readBrowserWorkspace(): BrowserWorkspaceState {
  const storedWorkspaceMode = normalizeWorkspaceMode(readStoredValue("eaieos:workspaceMode", "production"));
  const scrubForMode = <T,>(records: T[]) => scrubForWorkspaceMode(storedWorkspaceMode, records);
  const storedUseCases = scrubForMode(readStoredValue("eaieos:useCases", initialUseCases));
  const storedSkills = scrubForMode(readStoredValue("eaieos:skills", initialSkills));
  const storedRuns = normalizeTemporalRecords(scrubForMode(readStoredValue("eaieos:runs", initialRuns)), ["startedAt"]);
  const storedToolRequests = normalizeTemporalRecords(
    scrubForMode(readStoredValue("eaieos:toolRequests", initialToolRequests)),
    ["requestedAt"],
  );
  const storedAuditLogs = normalizeTemporalRecords(readStoredValue("eaieos:auditLogs", initialAuditLogs), ["createdAt"]);
  const cleanAuditLogs = scrubForMode(storedAuditLogs).map(normalizeAuditLog);
  const storedGovernanceReviews = scrubForMode(readStoredValue("eaieos:governanceReviews", initialGovernanceReviews));
  const storedEvalResults = normalizeTemporalRecords(
    scrubForMode(readStoredValue("eaieos:evalResults", initialEvalResults)),
    ["createdAt"],
  );
  const storedWorkSignals = normalizeTemporalRecords(
    scrubForMode(readStoredValue("eaieos:workSignals", initialWorkSignals)),
    ["createdAt"],
  );
  const storedCommandOrders = normalizeCommandOrders(readStoredValue("eaieos:commandOrders", []));
  const storedRuntimeAdapters = normalizeRuntimeAdapterRecords(readStoredValue("eaieos:runtimeAdapters", []));
  const storedRuntimeImportJobs = normalizeRuntimeImportJobs(readStoredValue("eaieos:runtimeImportJobs", []));
  const storedNormalizedRuntimeAssets = normalizeRuntimeAssets(readStoredValue("eaieos:normalizedRuntimeAssets", []));
  const storedInstalledLaunchPacks = normalizeInstalledLaunchPacks(readStoredValue("eaieos:installedLaunchPacks", []));
  const storedReportSchedules = normalizeReportSchedules(readStoredValue("eaieos:reportSchedules", []));
  const storedRuntimeImportAudits = normalizeRuntimeImportAudits(readStoredValue("eaieos:runtimeImportAudits", []));
  const storedAISettings = normalizeClientAISettings(readStoredValue("eaieos:aiSettings", defaultAISettings));
  const storedOrganization = normalizeOrganizationSettings(
    readStoredValue<Partial<OrganizationSettings>>("eaieos:organization", DEFAULT_TENANT_SETTINGS),
    "default",
  );
  const productionOrganization =
    storedWorkspaceMode === "production" && isLegacyDemoRecord(storedOrganization)
      ? DEFAULT_TENANT_SETTINGS
      : storedOrganization;
  const storedUsers = scrubForMode(readStoredValue("eaieos:users", platformUsers));
  const storedTools = scrubForMode(readStoredValue("eaieos:tools", tools));
  const storedContextSources = scrubForMode(readStoredValue("eaieos:contextSources", platformContextSources));
  const shouldRestoreNorthwindCatalog = isNorthwindDemoWorkspace(storedWorkspaceMode, storedOrganization, storedUseCases);
  const storedWorkflowStatus = readStoredValue<EnterpriseWorkspace["workflow"]["status"]>("eaieos:workflowStatus", "Saved");
  const storedWorkflowNodes = scrubLegacyWorkflowNodes(readStoredValue<Node[]>("eaieos:workflowNodes", []));
  const storedWorkflowEdges = scrubLegacyWorkflowEdges(
    storedWorkflowNodes,
    readStoredValue<Edge[]>("eaieos:workflowEdges", []),
  );

  return {
    localAISettings: storedAISettings,
    workspace: {
      schema: "enterprise-ai-enablement-os.workspace.v1",
      organizationId: "default",
      workspaceMode: storedWorkspaceMode,
      organization: productionOrganization,
      users: shouldRestoreNorthwindCatalog
        ? mergeCatalogById(storedUsers, demoUsers)
        : storedUsers.length
          ? storedUsers
          : platformUsers,
      tools: shouldRestoreNorthwindCatalog
        ? mergeCatalogById(storedTools, demoTools)
        : storedTools.length
          ? storedTools
          : tools,
      contextSources: shouldRestoreNorthwindCatalog
        ? mergeCatalogById(storedContextSources, demoContextSources)
        : storedContextSources.length
          ? storedContextSources
          : platformContextSources,
      useCases: storedUseCases,
      skills: storedSkills,
      runs: storedRuns,
      toolRequests: storedToolRequests,
      auditLogs: cleanAuditLogs,
      governanceReviews: storedGovernanceReviews,
      evalResults: storedEvalResults,
      workSignals: storedWorkSignals.length ? storedWorkSignals : shouldRestoreNorthwindCatalog ? demoWorkSignals : [],
      commandOrders: storedCommandOrders,
      runtimeAdapters: storedRuntimeAdapters,
      runtimeImportJobs: storedRuntimeImportJobs,
      normalizedRuntimeAssets: storedNormalizedRuntimeAssets,
      installedLaunchPacks: storedInstalledLaunchPacks,
      reportSchedules: storedReportSchedules,
      runtimeImportAudits: storedRuntimeImportAudits,
      workflow: {
        status: storedWorkflowStatus,
        nodes: storedWorkflowNodes,
        edges: storedWorkflowEdges,
      },
      report: readStoredValue("eaieos:report", ""),
      aiSettings: storedAISettings,
    } satisfies Partial<EnterpriseWorkspace>,
  };
}

export function resolveWorkspaceClientState(
  workspace: Partial<EnterpriseWorkspace>,
  localAISettings: AIProviderSettings,
  fallbackWorkspaceMode: WorkspaceMode,
): ResolvedWorkspaceClientState {
  const incomingWorkspaceMode = normalizeWorkspaceMode(workspace.workspaceMode ?? fallbackWorkspaceMode);
  const scrubForMode = <T,>(records: T[]) => scrubForWorkspaceMode(incomingWorkspaceMode, records);
  const safeLocalAISettings = normalizeClientAISettings(localAISettings);
  const incomingSettings = normalizeClientAISettings(workspace.aiSettings ?? safeLocalAISettings);
  const incomingOrganization = normalizeOrganizationSettings(
    workspace.organization,
    workspace.organizationId ?? DEFAULT_TENANT_SETTINGS.id,
  );
  const productionOrganization =
    incomingWorkspaceMode === "production" && isLegacyDemoRecord(incomingOrganization)
      ? DEFAULT_TENANT_SETTINGS
      : incomingOrganization;
  const workflowNodes =
    incomingWorkspaceMode === "demo"
      ? normalizeWorkflowNodes((workspace.workflow?.nodes ?? []) as Node[])
      : scrubLegacyWorkflowNodes((workspace.workflow?.nodes ?? []) as Node[]);
  const workflowEdges = scrubLegacyWorkflowEdges(workflowNodes, (workspace.workflow?.edges ?? []) as Edge[]);
  const workspaceUsers = scrubForMode(workspace.users ?? []);
  const workspaceTools = scrubForMode(workspace.tools ?? []);
  const workspaceContextSources = scrubForMode(workspace.contextSources ?? []);
  const shouldRestoreNorthwindCatalog = isNorthwindDemoWorkspace(
    incomingWorkspaceMode,
    incomingOrganization,
    workspace.useCases ?? [],
  );

  return {
    workspaceMode: incomingWorkspaceMode,
    organization: productionOrganization,
    catalogs: {
      users: shouldRestoreNorthwindCatalog ? mergeCatalogById(workspaceUsers, demoUsers) : workspaceUsers,
      tools: shouldRestoreNorthwindCatalog ? mergeCatalogById(workspaceTools, demoTools) : workspaceTools,
      contextSources: shouldRestoreNorthwindCatalog
        ? mergeCatalogById(workspaceContextSources, demoContextSources)
        : workspaceContextSources,
    },
    useCases: scrubForMode(workspace.useCases ?? []),
    skills: scrubForMode(workspace.skills ?? []),
    runs: normalizeTemporalRecords(scrubForMode(workspace.runs ?? []), ["startedAt"]),
    toolRequests: normalizeTemporalRecords(scrubForMode(workspace.toolRequests ?? []), ["requestedAt"]),
    auditLogs: normalizeTemporalRecords(scrubForMode(workspace.auditLogs ?? []), ["createdAt"]).map(normalizeAuditLog),
    governanceReviews: scrubForMode(workspace.governanceReviews ?? []),
    evalResults: normalizeTemporalRecords(scrubForMode(workspace.evalResults ?? []), ["createdAt"]),
    workSignals: normalizeTemporalRecords(scrubForMode(workspace.workSignals ?? []), ["createdAt"]),
    commandOrders: normalizeCommandOrders(workspace.commandOrders ?? []),
    runtimeAdapters: normalizeRuntimeAdapterRecords(workspace.runtimeAdapters),
    runtimeImportJobs: normalizeRuntimeImportJobs(workspace.runtimeImportJobs),
    normalizedRuntimeAssets: normalizeRuntimeAssets(workspace.normalizedRuntimeAssets),
    installedLaunchPacks: normalizeInstalledLaunchPacks(workspace.installedLaunchPacks),
    reportSchedules: normalizeReportSchedules(workspace.reportSchedules),
    runtimeImportAudits: normalizeRuntimeImportAudits(workspace.runtimeImportAudits),
    aiSettings: incomingSettings,
    workflowStatus: workspace.workflow?.status ?? "Saved",
    workflowNodes,
    workflowEdges,
    report: workspace.report ?? "",
  };
}

function mergeImportedAISettings(
  importedSettings: Partial<AIProviderSettings> | undefined,
  currentAISettings: AIProviderSettings,
) {
  const currentSafeSettings = normalizeClientAISettings(currentAISettings);
  if (!importedSettings) return currentSafeSettings;
  const normalized = normalizeClientAISettings(importedSettings);

  return {
    ...currentSafeSettings,
    ...normalized,
  };
}

export function parseWorkspaceImport(
  raw: string,
  params: {
    currentOrganizationId: string;
    currentAISettings: AIProviderSettings;
  },
): WorkspaceImportResult {
  try {
    const parsed = JSON.parse(raw) as Partial<{
      schema: string;
      users: User[];
      tools: Tool[];
      contextSources: ContextSource[];
      useCases: UseCase[];
      skills: Skill[];
      runs: Run[];
      toolRequests: ToolRequest[];
      auditLogs: AuditLog[];
      governanceReviews: GovernanceReview[];
      evalResults: EvalResult[];
      workSignals: WorkSignal[];
      commandOrders: EnterpriseWorkspace["commandOrders"];
      runtimeAdapters: EnterpriseWorkspace["runtimeAdapters"];
      runtimeImportJobs: EnterpriseWorkspace["runtimeImportJobs"];
      normalizedRuntimeAssets: EnterpriseWorkspace["normalizedRuntimeAssets"];
      installedLaunchPacks: EnterpriseWorkspace["installedLaunchPacks"];
      reportSchedules: EnterpriseWorkspace["reportSchedules"];
      runtimeImportAudits: EnterpriseWorkspace["runtimeImportAudits"];
      workflow: {
        status: EnterpriseWorkspace["workflow"]["status"];
        nodes: Node[];
        edges: Edge[];
      };
      workspaceMode: WorkspaceMode;
      organizationId: string;
      organization: Partial<OrganizationSettings>;
      report: string;
      aiSettings: Partial<AIProviderSettings>;
    }>;

    if (!Array.isArray(parsed.useCases) || !Array.isArray(parsed.skills)) {
      return { ok: false, message: "Import failed: missing use cases or Skills" };
    }

    const importedWorkspaceMode = normalizeWorkspaceMode(parsed.workspaceMode);
    const scrubForImportedMode = <T,>(records: T[]) => scrubForWorkspaceMode(importedWorkspaceMode, records);
    const importedUseCases = scrubForImportedMode(parsed.useCases);
    const importedSkills = scrubForImportedMode(parsed.skills);
    const normalizedOrganization = normalizeOrganizationSettings(
      parsed.organization,
      params.currentOrganizationId,
    );
    const importedOrganization =
      importedWorkspaceMode === "production" && isLegacyDemoRecord(normalizedOrganization)
        ? defaultOrganizationSettings(params.currentOrganizationId)
        : normalizedOrganization;
    const importedNodes = parsed.workflow?.nodes
      ? importedWorkspaceMode === "demo"
        ? normalizeWorkflowNodes(parsed.workflow.nodes)
        : scrubLegacyWorkflowNodes(parsed.workflow.nodes)
      : [];
    const importedEdges = parsed.workflow?.edges ? scrubLegacyWorkflowEdges(importedNodes, parsed.workflow.edges) : [];
    const report =
      typeof parsed.report === "string" &&
      !(importedWorkspaceMode === "production" && isLegacyDemoRecord({ id: "imported-report", report: parsed.report }))
        ? parsed.report
        : "";
    const importedRuns = normalizeTemporalRecords(
      scrubForImportedMode(Array.isArray(parsed.runs) ? parsed.runs : []),
      ["startedAt"],
    );

    return {
      ok: true,
      imported: {
        schema: parsed.schema,
        workspaceMode: importedWorkspaceMode,
        organization: importedOrganization,
        catalogs: {
          users: scrubForImportedMode(Array.isArray(parsed.users) ? parsed.users : []),
          tools: scrubForImportedMode(Array.isArray(parsed.tools) ? parsed.tools : []),
          contextSources: scrubForImportedMode(Array.isArray(parsed.contextSources) ? parsed.contextSources : []),
        },
        useCases: importedUseCases,
        skills: importedSkills,
        runs: importedRuns,
        toolRequests: normalizeTemporalRecords(
          scrubForImportedMode(Array.isArray(parsed.toolRequests) ? parsed.toolRequests : []),
          ["requestedAt"],
        ),
        auditLogs: normalizeTemporalRecords(
          scrubForImportedMode(Array.isArray(parsed.auditLogs) ? parsed.auditLogs : []),
          ["createdAt"],
        ).map(normalizeAuditLog),
        governanceReviews: scrubForImportedMode(
          Array.isArray(parsed.governanceReviews) ? parsed.governanceReviews : [],
        ),
        evalResults: normalizeTemporalRecords(
          scrubForImportedMode(Array.isArray(parsed.evalResults) ? parsed.evalResults : []),
          ["createdAt"],
        ),
        workSignals: normalizeTemporalRecords(
          scrubForImportedMode(Array.isArray(parsed.workSignals) ? parsed.workSignals : []),
          ["createdAt"],
        ),
        commandOrders: normalizeCommandOrders(parsed.commandOrders ?? []),
        runtimeAdapters: normalizeRuntimeAdapterRecords(parsed.runtimeAdapters),
        runtimeImportJobs: normalizeRuntimeImportJobs(parsed.runtimeImportJobs),
        normalizedRuntimeAssets: normalizeRuntimeAssets(parsed.normalizedRuntimeAssets),
        installedLaunchPacks: normalizeInstalledLaunchPacks(parsed.installedLaunchPacks),
        reportSchedules: normalizeReportSchedules(parsed.reportSchedules),
        runtimeImportAudits: normalizeRuntimeImportAudits(parsed.runtimeImportAudits),
        aiSettings: mergeImportedAISettings(parsed.aiSettings, params.currentAISettings),
        workflowStatus: parsed.workflow?.status ?? "Saved",
        workflowNodes: importedNodes,
        workflowEdges: importedEdges,
        report,
        selectedUseCaseId: importedUseCases[0]?.id ?? "",
        selectedSkillId: importedSkills[0]?.id ?? "",
        selectedRunId: importedRuns[0]?.id ?? "",
      },
    };
  } catch {
    return { ok: false, message: "Import failed: invalid JSON" };
  }
}
