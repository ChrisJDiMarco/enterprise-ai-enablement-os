import type {
  AuditLog,
  ContextSource,
  EvalResult,
  GovernanceReview,
  Run,
  Skill,
  Tool,
  ToolRequest,
  UseCase,
  User,
  WorkSignal,
} from "@/lib/enterprise-ai-data";
import { normalizeAISettings, redactAISettingsSecrets, type AIProviderSettings } from "./model-router.ts";
import { normalizeWorkSignals } from "./work-signal-policy.ts";
import {
  normalizeInstalledLaunchPacks,
  normalizeReportSchedules,
  normalizeRuntimeAdapterRecords,
  normalizeRuntimeAssets,
  normalizeRuntimeImportAudits,
  normalizeRuntimeImportJobs,
  type InstalledLaunchPackRecord,
  type NormalizedRuntimeAssetRecord,
  type ReportScheduleRecord,
  type RuntimeAdapterRecord,
  type RuntimeImportAuditRecord,
  type RuntimeImportJobRecord,
} from "./runtime-control-plane.ts";
import { normalizeCommandOrders, type CommandOrderRecord } from "./command-orders.ts";

export type WorkflowSnapshot = {
  status: "Saved" | "Testing" | "Published";
  nodes: unknown[];
  edges: unknown[];
};

export type OrganizationSecurityPolicy = {
  sessionTimeoutHours: number;
  requireMfa: boolean;
  allowLocalLogin: boolean;
};

export type OrganizationSettings = {
  id: string;
  name: string;
  slug: string;
  workspaceLabel: string;
  primaryColor: string;
  logoUrl?: string;
  securityPolicy: OrganizationSecurityPolicy;
  updatedAt: string;
};

export type WorkspaceMode = "production" | "demo";

export type EnterpriseWorkspace = {
  schema: "enterprise-ai-enablement-os.workspace.v1";
  organizationId: string;
  workspaceMode: WorkspaceMode;
  organization: OrganizationSettings;
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
  commandOrders: CommandOrderRecord[];
  runtimeAdapters: RuntimeAdapterRecord[];
  runtimeImportJobs: RuntimeImportJobRecord[];
  normalizedRuntimeAssets: NormalizedRuntimeAssetRecord[];
  installedLaunchPacks: InstalledLaunchPackRecord[];
  reportSchedules: ReportScheduleRecord[];
  runtimeImportAudits: RuntimeImportAuditRecord[];
  workflow: WorkflowSnapshot;
  report: string;
  aiSettings?: Partial<AIProviderSettings>;
  createdAt: string;
  updatedAt: string;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeHexColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : "#635bff";
}

export function normalizeBrandingAssetUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, 2000);
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !/[\r\n]/.test(trimmed)) return trimmed;

  try {
    return new URL(trimmed).protocol === "https:" ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeWorkspaceMode(value: unknown): WorkspaceMode {
  return value === "demo" ? "demo" : "production";
}

function normalizeWorkspaceWorkSignals(input: WorkSignal[]) {
  return normalizeWorkSignals(input);
}

function normalizeWorkspaceAISettings(input: Partial<AIProviderSettings> | undefined) {
  return input && typeof input === "object"
    ? redactAISettingsSecrets(normalizeAISettings(input))
    : undefined;
}

// Permissive defaults so per-tenant policy can only ever TIGHTEN access
// (additive with the env baseline), never silently open a hole.
export const defaultOrganizationSecurityPolicy: OrganizationSecurityPolicy = {
  sessionTimeoutHours: 8,
  requireMfa: false,
  allowLocalLogin: true,
};

const MIN_SESSION_TIMEOUT_HOURS = 1;
const MAX_SESSION_TIMEOUT_HOURS = 720; // 30 days — matches the absolute session ceiling.

export function normalizeOrganizationSecurityPolicy(
  input: Partial<OrganizationSecurityPolicy> | undefined,
): OrganizationSecurityPolicy {
  const hours = Number(input?.sessionTimeoutHours);
  return {
    sessionTimeoutHours: Number.isFinite(hours)
      ? Math.min(MAX_SESSION_TIMEOUT_HOURS, Math.max(MIN_SESSION_TIMEOUT_HOURS, Math.round(hours)))
      : defaultOrganizationSecurityPolicy.sessionTimeoutHours,
    requireMfa: input?.requireMfa === true,
    allowLocalLogin: input?.allowLocalLogin !== false,
  };
}

export function defaultOrganizationSettings(organizationId = "default"): OrganizationSettings {
  const now = new Date().toISOString();

  return {
    id: organizationId,
    name: "Enterprise AI",
    slug: "enterprise-ai",
    workspaceLabel: "Enablement OS",
    primaryColor: "#635bff",
    securityPolicy: { ...defaultOrganizationSecurityPolicy },
    updatedAt: now,
  };
}

export function normalizeOrganizationSettings(
  input: Partial<OrganizationSettings> | undefined,
  organizationId = "default",
): OrganizationSettings {
  const fallback = defaultOrganizationSettings(organizationId);
  const name = typeof input?.name === "string" && input.name.trim() ? input.name.trim().slice(0, 120) : fallback.name;
  const workspaceLabel =
    typeof input?.workspaceLabel === "string" && input.workspaceLabel.trim()
      ? input.workspaceLabel.trim().slice(0, 120)
      : fallback.workspaceLabel;
  const slug =
    typeof input?.slug === "string" && input.slug.trim()
      ? slugify(input.slug)
      : slugify(name) || fallback.slug;

  return {
    ...fallback,
    ...input,
    id: organizationId,
    name,
    slug,
    workspaceLabel,
    primaryColor: normalizeHexColor(input?.primaryColor),
    logoUrl: normalizeBrandingAssetUrl(input?.logoUrl),
    securityPolicy: normalizeOrganizationSecurityPolicy(input?.securityPolicy),
    updatedAt: input?.updatedAt || new Date().toISOString(),
  };
}

export function emptyWorkspace(organizationId = "default"): EnterpriseWorkspace {
  const now = new Date().toISOString();

  return {
    schema: "enterprise-ai-enablement-os.workspace.v1",
    organizationId,
    workspaceMode: "production",
    organization: defaultOrganizationSettings(organizationId),
    users: [],
    tools: [],
    contextSources: [],
    useCases: [],
    skills: [],
    runs: [],
    toolRequests: [],
    auditLogs: [],
    governanceReviews: [],
    evalResults: [],
    workSignals: [],
    commandOrders: [],
    runtimeAdapters: [],
    runtimeImportJobs: [],
    normalizedRuntimeAssets: [],
    installedLaunchPacks: [],
    reportSchedules: [],
    runtimeImportAudits: [],
    workflow: {
      status: "Saved",
      nodes: [],
      edges: [],
    },
    report: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeWorkspace(input: Partial<EnterpriseWorkspace>, organizationId = "default"): EnterpriseWorkspace {
  const fallback = emptyWorkspace(organizationId);
  const now = new Date().toISOString();
  const resolvedOrganizationId = organizationId;

  return {
    ...fallback,
    ...input,
    schema: "enterprise-ai-enablement-os.workspace.v1",
    organizationId: resolvedOrganizationId,
    workspaceMode: normalizeWorkspaceMode(input.workspaceMode),
    organization: normalizeOrganizationSettings(input.organization, resolvedOrganizationId),
    users: Array.isArray(input.users) ? input.users : [],
    tools: Array.isArray(input.tools) ? input.tools : [],
    contextSources: Array.isArray(input.contextSources) ? input.contextSources : [],
    useCases: Array.isArray(input.useCases) ? input.useCases : [],
    skills: Array.isArray(input.skills) ? input.skills : [],
    runs: Array.isArray(input.runs) ? input.runs : [],
    toolRequests: Array.isArray(input.toolRequests) ? input.toolRequests : [],
    auditLogs: Array.isArray(input.auditLogs) ? input.auditLogs : [],
    governanceReviews: Array.isArray(input.governanceReviews) ? input.governanceReviews : [],
    evalResults: Array.isArray(input.evalResults) ? input.evalResults : [],
    workSignals: normalizeWorkspaceWorkSignals(Array.isArray(input.workSignals) ? input.workSignals : []),
    commandOrders: normalizeCommandOrders(input.commandOrders),
    runtimeAdapters: normalizeRuntimeAdapterRecords(input.runtimeAdapters),
    runtimeImportJobs: normalizeRuntimeImportJobs(input.runtimeImportJobs),
    normalizedRuntimeAssets: normalizeRuntimeAssets(input.normalizedRuntimeAssets),
    installedLaunchPacks: normalizeInstalledLaunchPacks(input.installedLaunchPacks),
    reportSchedules: normalizeReportSchedules(input.reportSchedules),
    runtimeImportAudits: normalizeRuntimeImportAudits(input.runtimeImportAudits),
    workflow: {
      status: input.workflow?.status || "Saved",
      nodes: Array.isArray(input.workflow?.nodes) ? input.workflow.nodes : [],
      edges: Array.isArray(input.workflow?.edges) ? input.workflow.edges : [],
    },
    report: input.report || "",
    aiSettings: normalizeWorkspaceAISettings(input.aiSettings),
    createdAt: input.createdAt || fallback.createdAt,
    updatedAt: now,
  };
}
