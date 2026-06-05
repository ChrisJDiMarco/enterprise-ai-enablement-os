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
import { defaultAISettings, normalizeAISettings, type AIProviderSettings } from "./model-router.ts";
import { normalizeCommandOrders } from "./command-orders.ts";
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
  const storedAISettings = normalizeAISettings(readStoredValue("eaieos:aiSettings", defaultAISettings));
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
      users: storedUsers.length ? storedUsers : shouldRestoreNorthwindCatalog ? demoUsers : platformUsers,
      tools: storedTools.length ? storedTools : shouldRestoreNorthwindCatalog ? demoTools : tools,
      contextSources: storedContextSources.length
        ? storedContextSources
        : shouldRestoreNorthwindCatalog
          ? demoContextSources
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
  const incomingSettings = normalizeAISettings(workspace.aiSettings ?? localAISettings);
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
      users: workspaceUsers.length ? workspaceUsers : shouldRestoreNorthwindCatalog ? demoUsers : [],
      tools: workspaceTools.length ? workspaceTools : shouldRestoreNorthwindCatalog ? demoTools : [],
      contextSources: workspaceContextSources.length
        ? workspaceContextSources
        : shouldRestoreNorthwindCatalog
          ? demoContextSources
          : [],
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
    aiSettings: {
      ...incomingSettings,
      openaiKey: incomingSettings.openaiKey || localAISettings.openaiKey,
      anthropicKey: incomingSettings.anthropicKey || localAISettings.anthropicKey,
      googleKey: incomingSettings.googleKey || localAISettings.googleKey,
      azureKey: incomingSettings.azureKey || localAISettings.azureKey,
      kimiKey: incomingSettings.kimiKey || localAISettings.kimiKey,
      glmKey: incomingSettings.glmKey || localAISettings.glmKey,
      deepseekKey: incomingSettings.deepseekKey || localAISettings.deepseekKey,
      openrouterKey: incomingSettings.openrouterKey || localAISettings.openrouterKey,
    },
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
  if (!importedSettings) return currentAISettings;
  const normalized = normalizeAISettings(importedSettings);

  return {
    ...currentAISettings,
    ...normalized,
    openaiKey: importedSettings.openaiKey === "[redacted]" ? currentAISettings.openaiKey : importedSettings.openaiKey ?? "",
    anthropicKey:
      importedSettings.anthropicKey === "[redacted]"
        ? currentAISettings.anthropicKey
        : importedSettings.anthropicKey ?? "",
    googleKey: importedSettings.googleKey === "[redacted]" ? currentAISettings.googleKey : importedSettings.googleKey ?? "",
    azureKey: importedSettings.azureKey === "[redacted]" ? currentAISettings.azureKey : importedSettings.azureKey ?? "",
    kimiKey: importedSettings.kimiKey === "[redacted]" ? currentAISettings.kimiKey : importedSettings.kimiKey ?? "",
    glmKey: importedSettings.glmKey === "[redacted]" ? currentAISettings.glmKey : importedSettings.glmKey ?? "",
    deepseekKey:
      importedSettings.deepseekKey === "[redacted]" ? currentAISettings.deepseekKey : importedSettings.deepseekKey ?? "",
    openrouterKey:
      importedSettings.openrouterKey === "[redacted]"
        ? currentAISettings.openrouterKey
        : importedSettings.openrouterKey ?? "",
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
      parsed.organizationId ?? params.currentOrganizationId,
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
      scrubForImportedMode(Array.isArray(parsed.runs) ? parsed.runs : initialRuns),
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
          scrubForImportedMode(Array.isArray(parsed.auditLogs) ? parsed.auditLogs : initialAuditLogs),
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
