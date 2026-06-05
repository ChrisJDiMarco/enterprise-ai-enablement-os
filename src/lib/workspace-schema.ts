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
import type { AIProviderSettings } from "@/lib/model-router";
import { normalizeCommandOrders, type CommandOrderRecord } from "./command-orders.ts";

export type WorkflowSnapshot = {
  status: "Saved" | "Testing" | "Published";
  nodes: unknown[];
  edges: unknown[];
};

export type OrganizationSettings = {
  id: string;
  name: string;
  slug: string;
  workspaceLabel: string;
  primaryColor: string;
  logoUrl?: string;
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

export function normalizeWorkspaceMode(value: unknown): WorkspaceMode {
  return value === "demo" ? "demo" : "production";
}

function normalizeWorkspaceWorkSignals(input: WorkSignal[]) {
  const byId = new Map<string, WorkSignal>();

  input.forEach((signal) => {
    if (
      !signal?.id ||
      typeof signal.process !== "string" ||
      typeof signal.summary !== "string" ||
      !signal.privacy?.contentRedacted ||
      !signal.privacy?.piiRedacted ||
      signal.privacy.rawContentStored ||
      signal.privacy.individualScoringAllowed
    ) {
      return;
    }
    byId.set(signal.id, {
      ...signal,
      summary: signal.summary.replace(/\s+/g, " ").trim().slice(0, 700),
      process: signal.process.replace(/\s+/g, " ").trim().slice(0, 180),
      createdAt: signal.createdAt || new Date().toISOString(),
    });
  });

  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function defaultOrganizationSettings(organizationId = "default"): OrganizationSettings {
  const now = new Date().toISOString();

  return {
    id: organizationId,
    name: "Enterprise AI",
    slug: "enterprise-ai",
    workspaceLabel: "Enablement OS",
    primaryColor: "#635bff",
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
    logoUrl: typeof input?.logoUrl === "string" && input.logoUrl.trim() ? input.logoUrl.trim().slice(0, 2000) : undefined,
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
  const resolvedOrganizationId = input.organizationId || organizationId;

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
    workflow: {
      status: input.workflow?.status || "Saved",
      nodes: Array.isArray(input.workflow?.nodes) ? input.workflow.nodes : [],
      edges: Array.isArray(input.workflow?.edges) ? input.workflow.edges : [],
    },
    report: input.report || "",
    createdAt: input.createdAt || fallback.createdAt,
    updatedAt: now,
  };
}
