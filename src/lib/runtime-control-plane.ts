import type { AuditLog, RiskLevel } from "./enterprise-ai-data.ts";
import { sanitizeAuditText } from "./audit-sanitization.ts";
import type { ReportTemplateId } from "./report-generator.ts";
import { normalizeReportTemplate } from "./report-generator.ts";

export type RuntimeAdapterManifestId =
  | "langfuse"
  | "langsmith"
  | "phoenix_openinference"
  | "opentelemetry"
  | "mcp_broker"
  | "custom_runtime";

export type RuntimeAdapterStatus = "available" | "configured" | "tested" | "active" | "error";
export type RuntimeImportJobStatus = "draft" | "tested" | "previewed" | "committed" | "failed";
export type NormalizedRuntimeAssetType = "trace" | "eval" | "tool_call" | "prompt" | "cost" | "owner" | "proof";
export type RuntimeControlAction =
  | "adapter_tested"
  | "runtime_import_committed"
  | "launch_pack_installed"
  | "report_schedule_created"
  | "report_schedule_updated";

export type RuntimeAdapterManifest = {
  id: RuntimeAdapterManifestId;
  name: string;
  vendor: string;
  category: "observability" | "tracing" | "broker" | "custom";
  purpose: string;
  requiredFields: { name: string; label: string; secret: boolean; helper: string }[];
  normalizedMappings: { source: string; osField: string; required: boolean; proofUse: string }[];
  imports: NormalizedRuntimeAssetType[];
  evidenceCreated: string[];
  setupSteps: string[];
};

export type RuntimeAdapterRecord = {
  id: string;
  manifestId: RuntimeAdapterManifestId;
  name: string;
  status: RuntimeAdapterStatus;
  coverage: number;
  configuredFields: string[];
  missingFields: string[];
  lastTestedAt?: string;
  lastImportedAt?: string;
  proofIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type NormalizedRuntimeAssetRecord = {
  id: string;
  adapterId: string;
  manifestId: RuntimeAdapterManifestId;
  sourceType: NormalizedRuntimeAssetType;
  sourceId: string;
  name: string;
  owner: string;
  status: "mapped" | "needs_owner" | "needs_eval" | "needs_proof";
  riskLevel: RiskLevel;
  skillId?: string;
  metrics: {
    traces: number;
    evals: number;
    toolCalls: number;
    prompts: number;
    monthlyCostUsd: number;
  };
  mappedFields: string[];
  missingMappings: string[];
  evidenceGaps: string[];
  proofIds: string[];
  importedAt: string;
};

export type RuntimeImportJobRecord = {
  id: string;
  adapterId: string;
  manifestId: RuntimeAdapterManifestId;
  status: RuntimeImportJobStatus;
  step: "select" | "fields" | "test" | "preview" | "commit";
  discovered: {
    assets: number;
    traces: number;
    evals: number;
    toolCalls: number;
    prompts: number;
    costs: number;
    owners: number;
    proofIds: number;
  };
  previewAssetIds: string[];
  committedAssetIds: string[];
  message: string;
  proofIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type LaunchPackTemplateId =
  | "first_90_days_ai_office"
  | "iso_42001_assurance"
  | "regulated_agent_rollout"
  | "customer_support_ai_value";

export type LaunchPackTemplate = {
  id: LaunchPackTemplateId;
  title: string;
  audience: string;
  purpose: string;
  generatedUseCases: string[];
  controls: string[];
  reportCadences: ReportTemplateId[];
  evalSuites: string[];
  checklistItems: string[];
};

export type InstalledLaunchPackRecord = {
  id: string;
  templateId: LaunchPackTemplateId;
  title: string;
  status: "installed";
  createdObjects: {
    useCases: string[];
    controls: string[];
    reportScheduleIds: string[];
    evalSuites: string[];
    checklistItems: string[];
  };
  proofIds: string[];
  installedAt: string;
};

export type ReportScheduleRecord = {
  id: string;
  title: string;
  cadence: "daily" | "weekly" | "monthly" | "quarterly" | "event_driven";
  audience: string;
  templateId: ReportTemplateId;
  deliveryTargets: { type: "slack" | "email" | "pdf" | "in_app"; target: string; status: "ready" | "needs_destination" }[];
  status: "active" | "paused" | "needs_destination";
  nextRunAt: string;
  lastRunAt?: string;
  proofIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type RuntimeImportAuditRecord = {
  id: string;
  action: RuntimeControlAction;
  targetId: string;
  message: string;
  actor: string;
  riskLevel: RiskLevel;
  proofId: string;
  createdAt: string;
};

export type RuntimeControlPlaneSnapshot = {
  adapters: RuntimeAdapterRecord[];
  importJobs: RuntimeImportJobRecord[];
  runtimeAssets: NormalizedRuntimeAssetRecord[];
  installedPacks: InstalledLaunchPackRecord[];
  reportSchedules: ReportScheduleRecord[];
  importAudits: RuntimeImportAuditRecord[];
};

export type RuntimeControlHealthGrade = "launch_ready" | "controlled" | "forming" | "unmapped";

export type RuntimeControlGap = {
  id: string;
  severity: RiskLevel;
  label: string;
  detail: string;
  action: string;
  target: "adapter" | "asset" | "owner" | "eval" | "proof" | "cost";
};

export type RuntimeControlNextAction = {
  id: string;
  label: string;
  detail: string;
  command: "test_adapter" | "commit_import" | "assign_owner" | "attach_eval" | "attach_proof" | "map_cost" | "open_inventory";
  manifestId?: RuntimeAdapterManifestId;
  assetId?: string;
  priority: "critical" | "high" | "medium" | "low";
};

export type RuntimeControlIntelligence = {
  grade: RuntimeControlHealthGrade;
  score: number;
  summary: string;
  metrics: {
    manifests: number;
    activeAdapters: number;
    testedAdapters: number;
    importedAssets: number;
    traceSources: number;
    evalCoverage: number;
    ownerCoverage: number;
    proofCoverage: number;
    mappingCoverage: number;
    avgAdapterCoverage: number;
    monthlyCostUsd: number;
    highRiskAssets: number;
    restrictedAssets: number;
    importAudits: number;
  };
  gaps: RuntimeControlGap[];
  nextActions: RuntimeControlNextAction[];
};

export const runtimeAdapterManifests: RuntimeAdapterManifest[] = [
  {
    id: "langfuse",
    name: "Langfuse",
    vendor: "Langfuse",
    category: "observability",
    purpose: "Import LLM traces, prompt versions, scores, cost, latency, and session evidence into the OS proof model.",
    requiredFields: [
      { name: "LANGFUSE_BASE_URL", label: "Base URL", secret: false, helper: "Cloud or self-hosted Langfuse endpoint." },
      { name: "LANGFUSE_PUBLIC_KEY", label: "Public key", secret: true, helper: "Project-scoped public key." },
      { name: "LANGFUSE_SECRET_KEY", label: "Secret key", secret: true, helper: "Project-scoped secret key stored server-side." },
    ],
    normalizedMappings: [
      { source: "trace.id", osField: "runtimeAsset.sourceId", required: true, proofUse: "Trace lineage" },
      { source: "trace.userId", osField: "runtimeAsset.owner", required: true, proofUse: "Ownership and adoption" },
      { source: "observation.usage", osField: "runtimeAsset.metrics.cost", required: true, proofUse: "Cost proof" },
      { source: "score.value", osField: "runtimeAsset.metrics.evals", required: true, proofUse: "Quality proof" },
    ],
    imports: ["trace", "prompt", "eval", "cost"],
    evidenceCreated: ["runtime_trace_imported", "prompt_version_mapped", "eval_score_attached", "cost_event_attached"],
    setupSteps: ["Select project", "Validate API keys", "Map trace user/owner fields", "Preview traces", "Commit proof-linked import"],
  },
  {
    id: "langsmith",
    name: "LangSmith",
    vendor: "LangChain",
    category: "observability",
    purpose: "Normalize LangSmith runs, datasets, feedback, experiments, and agent traces into launch readiness evidence.",
    requiredFields: [
      { name: "LANGSMITH_API_KEY", label: "API key", secret: true, helper: "Workspace API key with project read access." },
      { name: "LANGSMITH_WORKSPACE_ID", label: "Workspace ID", secret: false, helper: "Workspace or org identifier." },
      { name: "LANGSMITH_PROJECT", label: "Project", secret: false, helper: "Project to import first." },
    ],
    normalizedMappings: [
      { source: "run.id", osField: "runtimeAsset.sourceId", required: true, proofUse: "Run trace lineage" },
      { source: "run.reference_example_id", osField: "runtimeAsset.metrics.evals", required: false, proofUse: "Dataset coverage" },
      { source: "feedback.score", osField: "runtimeAsset.metrics.evals", required: true, proofUse: "Regression proof" },
      { source: "run.total_cost", osField: "runtimeAsset.metrics.cost", required: false, proofUse: "Cost tracking" },
    ],
    imports: ["trace", "eval", "prompt", "cost"],
    evidenceCreated: ["agent_run_imported", "dataset_eval_attached", "feedback_score_attached", "prompt_regression_proof"],
    setupSteps: ["Select workspace", "Choose project", "Map run metadata", "Preview traces and evals", "Commit import"],
  },
  {
    id: "phoenix_openinference",
    name: "Phoenix / OpenInference",
    vendor: "Arize Phoenix",
    category: "tracing",
    purpose: "Bring OpenInference traces, retrieval quality, span attributes, eval labels, and drift signals into Enablement OS.",
    requiredFields: [
      { name: "PHOENIX_BASE_URL", label: "Phoenix endpoint", secret: false, helper: "Self-hosted or managed Phoenix endpoint." },
      { name: "PHOENIX_API_KEY", label: "API key", secret: true, helper: "Read-only tracing and dataset key." },
      { name: "PHOENIX_PROJECT_ID", label: "Project ID", secret: false, helper: "Project or namespace to import." },
    ],
    normalizedMappings: [
      { source: "span.context.trace_id", osField: "runtimeAsset.sourceId", required: true, proofUse: "Trace lineage" },
      { source: "span.attributes.openinference.span.kind", osField: "runtimeAsset.sourceType", required: true, proofUse: "Asset classification" },
      { source: "eval.label", osField: "runtimeAsset.metrics.evals", required: false, proofUse: "Quality proof" },
      { source: "retrieval.documents", osField: "runtimeAsset.mappedFields", required: false, proofUse: "Context coverage" },
    ],
    imports: ["trace", "eval", "tool_call", "proof"],
    evidenceCreated: ["openinference_trace_imported", "retrieval_quality_attached", "eval_label_attached"],
    setupSteps: ["Validate endpoint", "Select project", "Map span attributes", "Preview retrieval/eval coverage", "Commit import"],
  },
  {
    id: "opentelemetry",
    name: "OpenTelemetry",
    vendor: "OpenTelemetry Collector",
    category: "tracing",
    purpose: "Accept vendor-neutral spans, metrics, logs, token/cost attributes, and service ownership from an OTEL collector.",
    requiredFields: [
      { name: "OTEL_EXPORTER_OTLP_ENDPOINT", label: "OTLP endpoint", secret: false, helper: "Collector endpoint or gateway URL." },
      { name: "OTEL_EXPORTER_OTLP_HEADERS", label: "Auth headers", secret: true, helper: "Server-side header bundle or token reference." },
      { name: "OTEL_SERVICE_NAMESPACE", label: "Service namespace", secret: false, helper: "Namespace for AI services." },
    ],
    normalizedMappings: [
      { source: "resource.service.name", osField: "runtimeAsset.name", required: true, proofUse: "Service identity" },
      { source: "span.trace_id", osField: "runtimeAsset.sourceId", required: true, proofUse: "Trace lineage" },
      { source: "attributes.ai.prompt.hash", osField: "runtimeAsset.mappedFields", required: false, proofUse: "Prompt proof" },
      { source: "attributes.ai.cost.usd", osField: "runtimeAsset.metrics.cost", required: false, proofUse: "Cost evidence" },
    ],
    imports: ["trace", "tool_call", "prompt", "cost"],
    evidenceCreated: ["otel_trace_imported", "service_owner_mapped", "cost_metric_attached"],
    setupSteps: ["Register collector", "Map service ownership", "Map AI semantic attributes", "Preview spans", "Commit import"],
  },
  {
    id: "mcp_broker",
    name: "MCP Broker",
    vendor: "Model Context Protocol",
    category: "broker",
    purpose: "Register MCP servers, tools, approvals, action attempts, and tool-call evidence behind one OS policy layer.",
    requiredFields: [
      { name: "MCP_BROKER_URL", label: "Broker URL", secret: false, helper: "Broker endpoint used by approved Skills." },
      { name: "MCP_BROKER_TOKEN", label: "Broker token", secret: true, helper: "Server-side broker token or vault reference." },
      { name: "MCP_SERVER_ALLOWLIST", label: "Server allowlist", secret: false, helper: "Approved MCP servers and namespaces." },
    ],
    normalizedMappings: [
      { source: "tool.name", osField: "runtimeAsset.name", required: true, proofUse: "Tool inventory" },
      { source: "tool.call.id", osField: "runtimeAsset.sourceId", required: true, proofUse: "Tool-call lineage" },
      { source: "policy.decision", osField: "runtimeAsset.proofIds", required: true, proofUse: "Approval proof" },
      { source: "server.owner", osField: "runtimeAsset.owner", required: true, proofUse: "System ownership" },
    ],
    imports: ["tool_call", "owner", "proof", "cost"],
    evidenceCreated: ["mcp_tool_inventory_imported", "policy_decision_attached", "server_owner_mapped"],
    setupSteps: ["Register broker", "Map MCP servers", "Bind policy gates", "Preview tool calls", "Commit import"],
  },
  {
    id: "custom_runtime",
    name: "Custom Runtime",
    vendor: "Customer runtime",
    category: "custom",
    purpose: "Give enterprises a generic adapter contract for internal agents, RPA workers, notebooks, workflow engines, and app-owned copilots.",
    requiredFields: [
      { name: "CUSTOM_RUNTIME_NAME", label: "Runtime name", secret: false, helper: "Human-readable system name." },
      { name: "CUSTOM_RUNTIME_ENDPOINT", label: "Runtime endpoint", secret: false, helper: "API endpoint or export location." },
      { name: "CUSTOM_RUNTIME_AUTH_REF", label: "Auth reference", secret: true, helper: "Vault key, token alias, or broker route." },
    ],
    normalizedMappings: [
      { source: "asset.id", osField: "runtimeAsset.sourceId", required: true, proofUse: "Asset lineage" },
      { source: "asset.owner", osField: "runtimeAsset.owner", required: true, proofUse: "Accountability" },
      { source: "asset.trace", osField: "runtimeAsset.metrics.traces", required: false, proofUse: "Runtime proof" },
      { source: "asset.eval", osField: "runtimeAsset.metrics.evals", required: false, proofUse: "Quality proof" },
    ],
    imports: ["trace", "eval", "tool_call", "prompt", "cost", "owner", "proof"],
    evidenceCreated: ["custom_runtime_asset_imported", "owner_mapping_attached", "proof_mapping_attached"],
    setupSteps: ["Name runtime", "Upload/export schema", "Map ownership and evidence", "Preview records", "Commit import"],
  },
];

export const launchPackTemplates: LaunchPackTemplate[] = [
  {
    id: "first_90_days_ai_office",
    title: "First 90 Days AI Enablement Office",
    audience: "AI enablement leadership",
    purpose: "Stand up the operating cadence, work intake, governance, proof, and reporting loops for a new enterprise AI program.",
    generatedUseCases: ["AI opportunity intake assistant", "Executive weekly AI transformation brief", "Governed connector activation workflow"],
    controls: ["Owner matrix", "Risk triage", "Human approval gate", "Evidence ledger minimums"],
    reportCadences: ["weekly_ai_enablement_brief", "board_summary"],
    evalSuites: ["Use-case intake quality", "Executive report factuality", "Connector action safety"],
    checklistItems: ["Assign AI office owner", "Choose first function", "Connect one knowledge source", "Run first proof packet"],
  },
  {
    id: "iso_42001_assurance",
    title: "ISO/IEC 42001 Assurance Pack",
    audience: "Governance, risk, security, and audit",
    purpose: "Create the management-system evidence chain for accountable AI roles, policies, controls, monitoring, and improvement loops.",
    generatedUseCases: ["AI management-system evidence collector", "Policy exception review assistant", "Quarterly AI controls report"],
    controls: ["AIMS role register", "Policy exception log", "Monitoring cadence", "Improvement action tracker"],
    reportCadences: ["governance_summary", "board_summary"],
    evalSuites: ["Policy citation quality", "Risk classification consistency", "Exception escalation safety"],
    checklistItems: ["Map accountable roles", "Attach policy sources", "Review high-risk AI", "Export audit packet"],
  },
  {
    id: "regulated_agent_rollout",
    title: "Regulated Agent Rollout Pack",
    audience: "Legal, privacy, security, and platform teams",
    purpose: "Launch bounded agents in regulated workflows with privacy controls, eval gates, tool permissions, incident routing, and proof.",
    generatedUseCases: ["Regulated workflow triage agent", "Privacy-safe knowledge assistant", "Tool approval operations assistant"],
    controls: ["Data classification", "Restricted action gate", "Incident rollback", "Legal/privacy review"],
    reportCadences: ["governance_summary", "weekly_ai_enablement_brief"],
    evalSuites: ["PII refusal", "Tool boundary safety", "Restricted data handling"],
    checklistItems: ["Classify data", "Bind approved tools", "Run red-team evals", "Approve pilot boundary"],
  },
  {
    id: "customer_support_ai_value",
    title: "Customer Support AI Value Pack",
    audience: "CX, support, product, and finance",
    purpose: "Turn support demand signals into governed AI use cases, measurable deflection, quality checks, and value proof.",
    generatedUseCases: ["Ticket triage assistant", "Help-center answer assistant", "Escalation summary generator"],
    controls: ["External response approval", "Knowledge citation requirement", "Customer sentiment monitor", "Value baseline"],
    reportCadences: ["daily_ai_enablement_digest", "weekly_ai_enablement_brief"],
    evalSuites: ["Answer citation", "Escalation accuracy", "Customer-safe tone"],
    checklistItems: ["Connect support system", "Map help center sources", "Measure baseline handle time", "Review external reply gate"],
  },
];

export const defaultReportScheduleTemplates: Omit<ReportScheduleRecord, "proofIds" | "createdAt" | "updatedAt">[] = [
  {
    id: "schedule-daily-operator-digest",
    title: "Daily operator digest",
    cadence: "daily",
    audience: "AI enablement operators",
    templateId: "daily_ai_enablement_digest",
    deliveryTargets: [
      { type: "in_app", target: "Action Inbox", status: "ready" },
      { type: "slack", target: "#ai-ops", status: "needs_destination" },
    ],
    status: "needs_destination",
    nextRunAt: "08:00 local",
  },
  {
    id: "schedule-weekly-exec-brief",
    title: "Weekly executive brief",
    cadence: "weekly",
    audience: "Executive sponsor and function leaders",
    templateId: "weekly_ai_enablement_brief",
    deliveryTargets: [
      { type: "email", target: "AI Steering Committee", status: "needs_destination" },
      { type: "pdf", target: "Board-ready packet", status: "ready" },
    ],
    status: "needs_destination",
    nextRunAt: "Monday 8:00 AM",
  },
  {
    id: "schedule-governance-alerts",
    title: "Governance exception alerts",
    cadence: "event_driven",
    audience: "Risk, legal, privacy, and security reviewers",
    templateId: "governance_summary",
    deliveryTargets: [
      { type: "in_app", target: "Risk Review", status: "ready" },
      { type: "slack", target: "#ai-governance", status: "needs_destination" },
    ],
    status: "needs_destination",
    nextRunAt: "When exceptions open",
  },
  {
    id: "schedule-board-summary",
    title: "Board summary",
    cadence: "monthly",
    audience: "Board, CEO, CFO, CIO, and audit committee",
    templateId: "board_summary",
    deliveryTargets: [
      { type: "pdf", target: "Board packet", status: "ready" },
      { type: "email", target: "Executive distribution list", status: "needs_destination" },
    ],
    status: "needs_destination",
    nextRunAt: "First business day",
  },
];

function isoNow(now = new Date()) {
  return now.toISOString();
}

function proofId(prefix: string, now = new Date()) {
  return `${prefix}-${now.getTime()}`;
}

function uniqueById<T extends { id: string }>(records: T[]) {
  return [...new Map(records.filter((record) => record?.id).map((record) => [record.id, record])).values()];
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const redacted = "[redacted]";
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
const phonePattern = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const creditCardLikePattern = /\b(?:\d[ -]*?){13,19}\b/g;
const secretBearingUrlPattern =
  /https?:\/\/(?:hooks\.slack\.com\/services\/\S+|[^\s,;]*(?:token|secret|webhook|api[_-]?key|password|credential)[^\s,;]*)/gi;
const slackChannelPattern = /^#[a-z0-9][a-z0-9_-]{0,79}$/i;
const slackChannelIdPattern = /^[CGD][A-Z0-9]{2,}$/;
const emailDistributionAliasPattern = /^(?:dl|group|mailing-list):[a-z0-9][a-z0-9._-]{1,120}$/i;
const deliveryTargetPlaceholders = new Set([
  "ai steering committee",
  "executive distribution list",
  "stakeholders",
  "leadership",
  "email",
  "slack",
]);

export function sanitizeRuntimeControlText(value: string, maxLength = 240) {
  return sanitizeAuditText(value)
    .replace(secretBearingUrlPattern, redacted)
    .replace(emailPattern, redacted)
    .replace(ssnPattern, redacted)
    .replace(phonePattern, redacted)
    .replace(creditCardLikePattern, redacted)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizedText(value: unknown, fallback: string, maxLength = 240) {
  const raw = typeof value === "string" && value.trim() ? value : fallback;
  return sanitizeRuntimeControlText(raw, maxLength) || fallback;
}

function normalizedOptionalText(value: unknown, maxLength = 240) {
  return typeof value === "string" && value.trim() ? sanitizeRuntimeControlText(value, maxLength) || undefined : undefined;
}

function normalizedDateText(value: unknown, fallback = isoNow()) {
  if (typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : sanitizeRuntimeControlText(value, 120) || fallback;
}

function reportDeliveryTargetType(value: unknown): ReportScheduleRecord["deliveryTargets"][number]["type"] {
  return value === "slack" || value === "email" || value === "pdf" || value === "in_app" ? value : "in_app";
}

function reportDeliveryTargetIsReady(type: ReportScheduleRecord["deliveryTargets"][number]["type"], target: string) {
  const normalizedTarget = target.trim();
  if (!normalizedTarget || normalizedTarget.includes(redacted)) return false;

  if (type === "slack") {
    return slackChannelPattern.test(normalizedTarget) || slackChannelIdPattern.test(normalizedTarget);
  }

  if (type === "email") {
    return emailDistributionAliasPattern.test(normalizedTarget);
  }

  if (type === "pdf" || type === "in_app") {
    return !deliveryTargetPlaceholders.has(normalizedTarget.toLowerCase());
  }

  return false;
}

function nonNegativeNumber(value: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
}

function nonNegativeInteger(value: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
  return Math.round(nonNegativeNumber(value, fallback, max));
}

function manifestFor(id: RuntimeAdapterManifestId) {
  return runtimeAdapterManifests.find((manifest) => manifest.id === id) ?? runtimeAdapterManifests[0];
}

function isRuntimeAdapterManifestId(value: unknown): value is RuntimeAdapterManifestId {
  return runtimeAdapterManifests.some((manifest) => manifest.id === value);
}

function isLaunchPackTemplateId(value: unknown): value is LaunchPackTemplateId {
  return launchPackTemplates.some((template) => template.id === value);
}

export function adapterRecordId(manifestId: RuntimeAdapterManifestId) {
  return `adapter-${manifestId}`;
}

function normalizeStringList(value: unknown, maxLength = 180) {
  return asArray<unknown>(value)
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => sanitizeRuntimeControlText(item, maxLength))
    .filter(Boolean);
}

export function normalizeRuntimeAdapterRecords(value: unknown): RuntimeAdapterRecord[] {
  return uniqueById(
    asArray<Record<string, unknown>>(value)
      .filter((record) => isRuntimeAdapterManifestId(record.manifestId))
      .map((record) => {
        const manifest = manifestFor(record.manifestId as RuntimeAdapterManifestId);
        const configuredFields = normalizeStringList(record.configuredFields);
        const missingFields = manifest.requiredFields.map((field) => field.name).filter((field) => !configuredFields.includes(field));
        const status =
          record.status === "active" || record.status === "tested" || record.status === "configured" || record.status === "error"
            ? record.status
            : configuredFields.length
              ? "configured"
              : "available";
        const now = isoNow();

        return {
          id: normalizedText(record.id, adapterRecordId(manifest.id), 180),
          manifestId: manifest.id,
          name: normalizedText(record.name, manifest.name, 180),
          status,
          coverage: nonNegativeInteger(record.coverage, 0, 100),
          configuredFields,
          missingFields,
          lastTestedAt: normalizedOptionalText(record.lastTestedAt, 120),
          lastImportedAt: normalizedOptionalText(record.lastImportedAt, 120),
          proofIds: normalizeStringList(record.proofIds),
          createdAt: normalizedDateText(record.createdAt, now),
          updatedAt: normalizedDateText(record.updatedAt, now),
        };
      }),
  );
}

export function normalizeRuntimeAssets(value: unknown): NormalizedRuntimeAssetRecord[] {
  return uniqueById(
    asArray<Record<string, unknown>>(value)
      .filter((record) => isRuntimeAdapterManifestId(record.manifestId))
      .map((record) => {
        const now = isoNow();
        const sourceType =
          record.sourceType === "trace" ||
          record.sourceType === "eval" ||
          record.sourceType === "tool_call" ||
          record.sourceType === "prompt" ||
          record.sourceType === "cost" ||
          record.sourceType === "owner" ||
          record.sourceType === "proof"
            ? record.sourceType
            : "trace";
        const status =
          record.status === "mapped" ||
          record.status === "needs_owner" ||
          record.status === "needs_eval" ||
          record.status === "needs_proof"
            ? record.status
            : "needs_proof";
        const metrics = record.metrics && typeof record.metrics === "object" ? (record.metrics as Record<string, unknown>) : {};

        return {
          id: normalizedText(record.id, `runtime-asset-${now}`, 180),
          adapterId: normalizedText(record.adapterId, adapterRecordId(record.manifestId as RuntimeAdapterManifestId), 180),
          manifestId: record.manifestId as RuntimeAdapterManifestId,
          sourceType,
          sourceId: normalizedText(record.sourceId, String(record.id ?? "unknown-source"), 240),
          name: normalizedText(record.name, "Imported runtime asset", 240),
          owner: normalizedText(record.owner, "Unassigned", 180),
          status,
          riskLevel:
            record.riskLevel === "restricted" || record.riskLevel === "high" || record.riskLevel === "medium" || record.riskLevel === "low"
              ? record.riskLevel
              : "medium",
          skillId: normalizedOptionalText(record.skillId, 180),
          metrics: {
            traces: nonNegativeInteger(metrics.traces, 0, 100_000_000),
            evals: nonNegativeInteger(metrics.evals, 0, 100_000_000),
            toolCalls: nonNegativeInteger(metrics.toolCalls, 0, 100_000_000),
            prompts: nonNegativeInteger(metrics.prompts, 0, 100_000_000),
            monthlyCostUsd: nonNegativeNumber(metrics.monthlyCostUsd, 0, 1_000_000_000),
          },
          mappedFields: normalizeStringList(record.mappedFields),
          missingMappings: normalizeStringList(record.missingMappings),
          evidenceGaps: normalizeStringList(record.evidenceGaps, 260),
          proofIds: normalizeStringList(record.proofIds),
          importedAt: normalizedDateText(record.importedAt, now),
        };
      }),
  );
}

export function normalizeRuntimeImportJobs(value: unknown): RuntimeImportJobRecord[] {
  return uniqueById(
    asArray<Record<string, unknown>>(value)
      .filter((record) => isRuntimeAdapterManifestId(record.manifestId))
      .map((record) => {
        const now = isoNow();
        const discovered = record.discovered && typeof record.discovered === "object" ? (record.discovered as Record<string, unknown>) : {};
        const status =
          record.status === "tested" || record.status === "previewed" || record.status === "committed" || record.status === "failed"
            ? record.status
            : "draft";
        const step =
          record.step === "fields" || record.step === "test" || record.step === "preview" || record.step === "commit"
            ? record.step
            : "select";

        return {
          id: normalizedText(record.id, `runtime-import-${now}`, 180),
          adapterId: normalizedText(record.adapterId, adapterRecordId(record.manifestId as RuntimeAdapterManifestId), 180),
          manifestId: record.manifestId as RuntimeAdapterManifestId,
          status,
          step,
          discovered: {
            assets: nonNegativeInteger(discovered.assets, 0, 100_000_000),
            traces: nonNegativeInteger(discovered.traces, 0, 100_000_000),
            evals: nonNegativeInteger(discovered.evals, 0, 100_000_000),
            toolCalls: nonNegativeInteger(discovered.toolCalls, 0, 100_000_000),
            prompts: nonNegativeInteger(discovered.prompts, 0, 100_000_000),
            costs: nonNegativeInteger(discovered.costs, 0, 100_000_000),
            owners: nonNegativeInteger(discovered.owners, 0, 100_000_000),
            proofIds: nonNegativeInteger(discovered.proofIds, 0, 100_000_000),
          },
          previewAssetIds: normalizeStringList(record.previewAssetIds),
          committedAssetIds: normalizeStringList(record.committedAssetIds),
          message: normalizedText(record.message, "Runtime import job created.", 700),
          proofIds: normalizeStringList(record.proofIds),
          createdAt: normalizedDateText(record.createdAt, now),
          updatedAt: normalizedDateText(record.updatedAt, now),
        };
      }),
  );
}

export function normalizeInstalledLaunchPacks(value: unknown): InstalledLaunchPackRecord[] {
  return uniqueById(
    asArray<Record<string, unknown>>(value)
      .filter((record) => isLaunchPackTemplateId(record.templateId))
      .map((record) => {
        const template = launchPackTemplates.find((pack) => pack.id === record.templateId) ?? launchPackTemplates[0];
        const createdObjects = record.createdObjects && typeof record.createdObjects === "object" ? (record.createdObjects as Record<string, unknown>) : {};
        return {
          id: normalizedText(record.id, `installed-pack-${template.id}`, 180),
          templateId: template.id,
          title: normalizedText(record.title, template.title, 180),
          status: "installed",
          createdObjects: {
            useCases: normalizeStringList(createdObjects.useCases, 220),
            controls: normalizeStringList(createdObjects.controls, 220),
            reportScheduleIds: normalizeStringList(createdObjects.reportScheduleIds),
            evalSuites: normalizeStringList(createdObjects.evalSuites, 220),
            checklistItems: normalizeStringList(createdObjects.checklistItems, 260),
          },
          proofIds: normalizeStringList(record.proofIds),
          installedAt: normalizedDateText(record.installedAt, isoNow()),
        };
      }),
  );
}

export function normalizeReportSchedules(value: unknown): ReportScheduleRecord[] {
  return uniqueById(
    asArray<Record<string, unknown>>(value).map((record) => {
      const now = isoNow();
      const status = record.status === "active" || record.status === "paused" || record.status === "needs_destination" ? record.status : "needs_destination";
      const cadence =
        record.cadence === "daily" ||
        record.cadence === "weekly" ||
        record.cadence === "monthly" ||
        record.cadence === "quarterly" ||
        record.cadence === "event_driven"
          ? record.cadence
          : "weekly";
      const deliveryTargets: ReportScheduleRecord["deliveryTargets"] = asArray<Record<string, unknown>>(record.deliveryTargets).map((target) => {
        const type = reportDeliveryTargetType(target.type);
        const normalizedTarget = normalizedText(target.target, "In-app inbox", 240);
        const targetReady = reportDeliveryTargetIsReady(type, normalizedTarget);
        return {
          type,
          target: normalizedTarget,
          status: target.status === "ready" && targetReady ? "ready" : "needs_destination",
        };
      });
      const hasDestinationGap = deliveryTargets.some((target) => target.status === "needs_destination");

      return {
        id: normalizedText(record.id, `report-schedule-${now}`, 180),
        title: normalizedText(record.title, "Report schedule", 180),
        cadence,
        audience: normalizedText(record.audience, "AI stakeholders", 240),
        templateId: normalizeReportTemplate(record.templateId),
        deliveryTargets,
        status: status === "active" && hasDestinationGap ? "needs_destination" : status,
        nextRunAt: normalizedText(record.nextRunAt, "Next cadence", 160),
        lastRunAt: normalizedOptionalText(record.lastRunAt, 120),
        proofIds: normalizeStringList(record.proofIds),
        createdAt: normalizedDateText(record.createdAt, now),
        updatedAt: normalizedDateText(record.updatedAt, now),
      };
    }),
  );
}

export function normalizeRuntimeImportAudits(value: unknown): RuntimeImportAuditRecord[] {
  return uniqueById(
    asArray<Record<string, unknown>>(value).map((record) => {
      const action =
        record.action === "adapter_tested" ||
        record.action === "runtime_import_committed" ||
        record.action === "launch_pack_installed" ||
        record.action === "report_schedule_created" ||
        record.action === "report_schedule_updated"
          ? record.action
          : "runtime_import_committed";

      return {
        id: normalizedText(record.id, `runtime-audit-${isoNow()}`, 180),
        action,
        targetId: normalizedText(record.targetId, "unknown-target", 180),
        message: normalizedText(record.message, "Runtime control-plane action recorded.", 700),
        actor: normalizedText(record.actor, "Enablement OS", 180),
        riskLevel:
          record.riskLevel === "restricted" || record.riskLevel === "high" || record.riskLevel === "medium" || record.riskLevel === "low"
            ? record.riskLevel
            : "medium",
        proofId: normalizedText(record.proofId, proofId("proof-runtime"), 180),
        createdAt: normalizedDateText(record.createdAt, isoNow()),
      };
    }),
  );
}

function createImportAudit(params: {
  action: RuntimeControlAction;
  targetId: string;
  message: string;
  actor?: string;
  riskLevel?: RiskLevel;
  now?: Date;
}) {
  const createdAt = isoNow(params.now);
  const proof = proofId(`proof-${params.action}`, params.now);
  const audit: RuntimeImportAuditRecord = {
    id: `runtime-audit-${params.action}-${params.targetId}-${params.now?.getTime() ?? Date.now()}`,
    action: params.action,
    targetId: params.targetId,
    message: params.message,
    actor: params.actor ?? "Enablement OS",
    riskLevel: params.riskLevel ?? "medium",
    proofId: proof,
    createdAt,
  };
  const auditLog: AuditLog = {
    id: `audit-${params.action}-${params.now?.getTime() ?? Date.now()}`,
    eventType: params.action,
    message: `${params.message} Proof: ${proof}.`,
    actor: audit.actor,
    riskLevel: audit.riskLevel,
    createdAt,
  };

  return { audit, auditLog };
}

function discoveredFor(manifest: RuntimeAdapterManifest) {
  const traces = manifest.imports.includes("trace") ? 24 : 0;
  const evals = manifest.imports.includes("eval") ? 6 : 0;
  const toolCalls = manifest.imports.includes("tool_call") ? 18 : 0;
  const prompts = manifest.imports.includes("prompt") ? 9 : 0;
  const costs = manifest.imports.includes("cost") ? 12 : 0;
  const owners = manifest.imports.includes("owner") ? 5 : 3;
  return {
    assets: Math.max(3, manifest.imports.length),
    traces,
    evals,
    toolCalls,
    prompts,
    costs,
    owners,
    proofIds: manifest.evidenceCreated.length,
  };
}

function previewAssetsFor(manifest: RuntimeAdapterManifest, adapterId: string, now = new Date()): NormalizedRuntimeAssetRecord[] {
  const importedAt = isoNow(now);
  const proof = proofId(`proof-${manifest.id}-import`, now);
  const base = [
    {
      sourceType: "trace" as const,
      name: `${manifest.name} runtime traces`,
      metrics: { traces: 24, evals: 0, toolCalls: 8, prompts: 3, monthlyCostUsd: 410 },
      mappedFields: ["sourceId", "traceCount", "toolCalls", "cost"],
      missingMappings: ["skillId"],
      evidenceGaps: ["Map traces to governed Skills"],
      status: "needs_proof" as const,
    },
    {
      sourceType: "eval" as const,
      name: `${manifest.name} eval coverage`,
      metrics: { traces: 0, evals: 6, toolCalls: 0, prompts: 0, monthlyCostUsd: 80 },
      mappedFields: ["score", "dataset", "createdAt"],
      missingMappings: ["reviewOwner"],
      evidenceGaps: ["Assign eval owner"],
      status: "needs_owner" as const,
    },
    {
      sourceType: "tool_call" as const,
      name: `${manifest.name} tool calls`,
      metrics: { traces: 0, evals: 0, toolCalls: 18, prompts: 0, monthlyCostUsd: 120 },
      mappedFields: ["toolId", "decision", "externalStatus"],
      missingMappings: ["policyId"],
      evidenceGaps: ["Attach Broker policy decision"],
      status: "needs_proof" as const,
    },
    {
      sourceType: "prompt" as const,
      name: `${manifest.name} prompt versions`,
      metrics: { traces: 0, evals: 0, toolCalls: 0, prompts: 9, monthlyCostUsd: 0 },
      mappedFields: ["promptHash", "version", "owner"],
      missingMappings: [],
      evidenceGaps: [],
      status: "mapped" as const,
    },
    {
      sourceType: "cost" as const,
      name: `${manifest.name} cost telemetry`,
      metrics: { traces: 0, evals: 0, toolCalls: 0, prompts: 0, monthlyCostUsd: 610 },
      mappedFields: ["cost", "model", "tenant"],
      missingMappings: ["department"],
      evidenceGaps: ["Map cost to department and value stream"],
      status: "needs_proof" as const,
    },
  ].filter((asset) => manifest.imports.includes(asset.sourceType));

  return base.map((asset, index) => ({
    id: `runtime-asset-${manifest.id}-${asset.sourceType}`,
    adapterId,
    manifestId: manifest.id,
    sourceType: asset.sourceType,
    sourceId: `${manifest.id}-${asset.sourceType}-${index + 1}`,
    name: asset.name,
    owner: index === 0 ? "Platform" : "Unassigned",
    status: asset.status,
    riskLevel: asset.sourceType === "tool_call" ? "high" : "medium",
    metrics: asset.metrics,
    mappedFields: asset.mappedFields,
    missingMappings: asset.missingMappings,
    evidenceGaps: asset.evidenceGaps,
    proofIds: asset.evidenceGaps.length ? [] : [proof],
    importedAt,
  }));
}

export function testRuntimeAdapterAction(params: {
  manifestId: RuntimeAdapterManifestId;
  adapters: RuntimeAdapterRecord[];
  importJobs: RuntimeImportJobRecord[];
  importAudits: RuntimeImportAuditRecord[];
  now?: Date;
}) {
  const manifest = manifestFor(params.manifestId);
  const now = params.now ?? new Date();
  const timestamp = isoNow(now);
  const adapterId = adapterRecordId(manifest.id);
  const configuredFields = manifest.requiredFields.map((field) => field.name);
  const { audit, auditLog } = createImportAudit({
    action: "adapter_tested",
    targetId: adapterId,
    message: `${manifest.name} adapter contract validated (required fields + mapping). This records configuration only — it does not verify a live connection or that telemetry is flowing.`,
    now,
  });
  const adapter: RuntimeAdapterRecord = {
    id: adapterId,
    manifestId: manifest.id,
    name: manifest.name,
    status: "tested",
    coverage: 62,
    configuredFields,
    missingFields: [],
    lastTestedAt: timestamp,
    proofIds: [audit.proofId],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const job: RuntimeImportJobRecord = {
    id: `runtime-import-${manifest.id}`,
    adapterId,
    manifestId: manifest.id,
    status: "tested",
    step: "preview",
    discovered: discoveredFor(manifest),
    previewAssetIds: [],
    committedAssetIds: [],
    message: `${manifest.name} contract validated. The preview shows EXPECTED (template) runtime assets — no live fetch is performed until a real adapter is wired.`,
    proofIds: [audit.proofId],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    adapters: uniqueById([adapter, ...params.adapters.filter((item) => item.id !== adapterId)]),
    importJobs: uniqueById([job, ...params.importJobs.filter((item) => item.id !== job.id)]),
    importAudits: uniqueById([audit, ...params.importAudits]),
    auditLog,
  };
}

export function commitRuntimeImportAction(params: {
  manifestId: RuntimeAdapterManifestId;
  adapters: RuntimeAdapterRecord[];
  importJobs: RuntimeImportJobRecord[];
  runtimeAssets: NormalizedRuntimeAssetRecord[];
  importAudits: RuntimeImportAuditRecord[];
  now?: Date;
}) {
  const manifest = manifestFor(params.manifestId);
  const now = params.now ?? new Date();
  const timestamp = isoNow(now);
  const adapterId = adapterRecordId(manifest.id);
  const assets = previewAssetsFor(manifest, adapterId, now);
  const { audit, auditLog } = createImportAudit({
    action: "runtime_import_committed",
    targetId: adapterId,
    message: `${manifest.name} runtime import committed with ${assets.length} normalized asset records and automatic proof references.`,
    now,
  });
  const adapter: RuntimeAdapterRecord = {
    id: adapterId,
    manifestId: manifest.id,
    name: manifest.name,
    status: "active",
    coverage: 84,
    configuredFields: manifest.requiredFields.map((field) => field.name),
    missingFields: [],
    lastTestedAt: params.adapters.find((item) => item.id === adapterId)?.lastTestedAt ?? timestamp,
    lastImportedAt: timestamp,
    proofIds: [audit.proofId, ...normalizeStringList(params.adapters.find((item) => item.id === adapterId)?.proofIds)].slice(0, 8),
    createdAt: params.adapters.find((item) => item.id === adapterId)?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const job: RuntimeImportJobRecord = {
    id: `runtime-import-${manifest.id}`,
    adapterId,
    manifestId: manifest.id,
    status: "committed",
    step: "commit",
    discovered: discoveredFor(manifest),
    previewAssetIds: assets.map((asset) => asset.id),
    committedAssetIds: assets.map((asset) => asset.id),
    message: `${manifest.name} normalized assets are now visible in AI Inventory and Proof Ledger.`,
    proofIds: [audit.proofId],
    createdAt: params.importJobs.find((item) => item.id === `runtime-import-${manifest.id}`)?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const stampedAssets = assets.map((asset) => ({
    ...asset,
    proofIds: uniqueById(asset.proofIds.map((id) => ({ id }))).map((item) => item.id).concat(audit.proofId).slice(0, 8),
  }));

  return {
    adapters: uniqueById([adapter, ...params.adapters.filter((item) => item.id !== adapterId)]),
    importJobs: uniqueById([job, ...params.importJobs.filter((item) => item.id !== job.id)]),
    runtimeAssets: uniqueById([...stampedAssets, ...params.runtimeAssets.filter((asset) => asset.adapterId !== adapterId)]),
    importAudits: uniqueById([audit, ...params.importAudits]),
    auditLog,
  };
}

export function installLaunchPackAction(params: {
  templateId: LaunchPackTemplateId;
  installedPacks: InstalledLaunchPackRecord[];
  reportSchedules: ReportScheduleRecord[];
  importAudits: RuntimeImportAuditRecord[];
  now?: Date;
}) {
  const template = launchPackTemplates.find((item) => item.id === params.templateId) ?? launchPackTemplates[0];
  const now = params.now ?? new Date();
  const timestamp = isoNow(now);
  const packId = `installed-pack-${template.id}`;
  const { audit, auditLog } = createImportAudit({
    action: "launch_pack_installed",
    targetId: packId,
    message: `${template.title} installed with generated use cases, controls, eval suites, checklist items, and report cadences.`,
    now,
  });
  const schedules = template.reportCadences.map((templateId, index): ReportScheduleRecord => {
    const base = defaultReportScheduleTemplates.find((schedule) => schedule.templateId === templateId);
    return {
      id: `schedule-${template.id}-${templateId}`,
      title: base?.title ?? `${template.title} report cadence ${index + 1}`,
      cadence: base?.cadence ?? "weekly",
      audience: base?.audience ?? template.audience,
      templateId,
      deliveryTargets: base?.deliveryTargets ?? [{ type: "in_app", target: "Reports", status: "ready" }],
      status: base?.deliveryTargets.every((target) => target.status === "ready") ? "active" : "needs_destination",
      nextRunAt: base?.nextRunAt ?? "Next cadence",
      proofIds: [audit.proofId],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
  const installed: InstalledLaunchPackRecord = {
    id: packId,
    templateId: template.id,
    title: template.title,
    status: "installed",
    createdObjects: {
      useCases: template.generatedUseCases,
      controls: template.controls,
      reportScheduleIds: schedules.map((schedule) => schedule.id),
      evalSuites: template.evalSuites,
      checklistItems: template.checklistItems,
    },
    proofIds: [audit.proofId],
    installedAt: timestamp,
  };

  return {
    installedPacks: uniqueById([installed, ...params.installedPacks.filter((pack) => pack.id !== packId)]),
    reportSchedules: uniqueById([...schedules, ...params.reportSchedules]),
    importAudits: uniqueById([audit, ...params.importAudits]),
    auditLog,
  };
}

export function createDefaultReportSchedulesAction(params: {
  reportSchedules: ReportScheduleRecord[];
  importAudits: RuntimeImportAuditRecord[];
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const timestamp = isoNow(now);
  const { audit, auditLog } = createImportAudit({
    action: "report_schedule_created",
    targetId: "default-report-schedules",
    message: "Default reporting subscriptions created for daily operator digest, weekly executive brief, governance alerts, and board summary.",
    now,
    riskLevel: "low",
  });
  const schedules = defaultReportScheduleTemplates.map((schedule) => ({
    ...schedule,
    proofIds: [audit.proofId],
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  return {
    reportSchedules: uniqueById([...schedules, ...params.reportSchedules]),
    importAudits: uniqueById([audit, ...params.importAudits]),
    auditLog,
  };
}

export function toggleReportScheduleAction(params: {
  scheduleId: string;
  reportSchedules: ReportScheduleRecord[];
  importAudits: RuntimeImportAuditRecord[];
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const schedule = params.reportSchedules.find((item) => item.id === params.scheduleId);
  if (!schedule) return null;
  const deliveryTargets = schedule.deliveryTargets.map((target) => {
    const ready = target.status === "ready" && reportDeliveryTargetIsReady(target.type, target.target);
    return {
      ...target,
      status: ready ? ("ready" as const) : ("needs_destination" as const),
    };
  });
  const hasDestinationGap = deliveryTargets.some((target) => target.status === "needs_destination");
  const nextStatus: ReportScheduleRecord["status"] = schedule.status === "active"
    ? "paused"
    : hasDestinationGap
      ? "needs_destination"
      : "active";
  const { audit, auditLog } = createImportAudit({
    action: "report_schedule_updated",
    targetId: schedule.id,
    message: `${schedule.title} report schedule ${nextStatus === "active" ? "activated" : nextStatus === "paused" ? "paused" : "still needs delivery destinations"}.`,
    now,
    riskLevel: "low",
  });
  const updated: ReportScheduleRecord = {
    ...schedule,
    status: nextStatus,
    deliveryTargets,
    proofIds: [audit.proofId, ...schedule.proofIds].slice(0, 8),
    updatedAt: isoNow(now),
  };

  return {
    reportSchedules: uniqueById([updated, ...params.reportSchedules.filter((item) => item.id !== schedule.id)]),
    importAudits: uniqueById([audit, ...params.importAudits]),
    auditLog,
  };
}

export function buildRuntimeGraphDrilldown(params: {
  adapters: RuntimeAdapterRecord[];
  importJobs: RuntimeImportJobRecord[];
  runtimeAssets: NormalizedRuntimeAssetRecord[];
}) {
  const assets = params.runtimeAssets;
  const missingMappings = assets.flatMap((asset) => asset.missingMappings.map((mapping) => `${asset.name}: ${mapping}`));
  const evidenceGaps = assets.flatMap((asset) => asset.evidenceGaps.map((gap) => `${asset.name}: ${gap}`));
  const ownerGaps = assets.filter((asset) => asset.owner === "Unassigned" || asset.status === "needs_owner");
  const evalAssets = assets.filter((asset) => asset.sourceType === "eval" || asset.metrics.evals > 0);
  const traceAssets = assets.filter((asset) => asset.sourceType === "trace" || asset.metrics.traces > 0);

  return {
    traceSources: traceAssets.length,
    evalCoverage: assets.length ? Math.round((evalAssets.length / assets.length) * 100) : 0,
    ownerCoverage: assets.length ? Math.round(((assets.length - ownerGaps.length) / assets.length) * 100) : 0,
    missingMappings,
    evidenceGaps,
    activeAdapters: params.adapters.filter((adapter) => adapter.status === "active").length,
    importJobs: params.importJobs.length,
  };
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function uniqueByGapId<T extends { id: string }>(records: T[]) {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

export function buildRuntimeControlIntelligence(params: {
  adapters: RuntimeAdapterRecord[];
  importJobs: RuntimeImportJobRecord[];
  runtimeAssets: NormalizedRuntimeAssetRecord[];
  importAudits: RuntimeImportAuditRecord[];
}): RuntimeControlIntelligence {
  const adapters = normalizeRuntimeAdapterRecords(params.adapters);
  const importJobs = normalizeRuntimeImportJobs(params.importJobs);
  const runtimeAssets = normalizeRuntimeAssets(params.runtimeAssets);
  const importAudits = normalizeRuntimeImportAudits(params.importAudits);
  const activeAdapters = adapters.filter((adapter) => adapter.status === "active");
  const testedAdapters = adapters.filter((adapter) => adapter.status === "tested" || adapter.status === "active");
  const traceAssets = runtimeAssets.filter((asset) => asset.sourceType === "trace" || asset.metrics.traces > 0);
  const evalAssets = runtimeAssets.filter((asset) => asset.sourceType === "eval" || asset.metrics.evals > 0);
  const proofAssets = runtimeAssets.filter((asset) => asset.proofIds.length > 0);
  const ownerAssets = runtimeAssets.filter((asset) => asset.owner && asset.owner !== "Unassigned" && asset.status !== "needs_owner");
  const mappedAssets = runtimeAssets.filter((asset) => asset.missingMappings.length === 0);
  const highRiskAssets = runtimeAssets.filter((asset) => asset.riskLevel === "high");
  const restrictedAssets = runtimeAssets.filter((asset) => asset.riskLevel === "restricted");
  const monthlyCostUsd = runtimeAssets.reduce((sum, asset) => sum + Math.max(0, asset.metrics.monthlyCostUsd || 0), 0);
  const avgAdapterCoverage = average(activeAdapters.map((adapter) => adapter.coverage));
  const importedAssets = runtimeAssets.length;
  const evalCoverage = percent(evalAssets.length, importedAssets);
  const ownerCoverage = percent(ownerAssets.length, importedAssets);
  const proofCoverage = percent(proofAssets.length, importedAssets);
  const mappingCoverage = percent(mappedAssets.length, importedAssets);
  const adapterCoverage = percent(activeAdapters.length, runtimeAdapterManifests.length);
  const testedCoverage = percent(testedAdapters.length, runtimeAdapterManifests.length);
  const traceCoverage = importedAssets ? percent(traceAssets.length, importedAssets) : 0;
  const auditCoverage = importAudits.length ? 100 : 0;
  const score = Math.round(
    adapterCoverage * 0.18 +
      testedCoverage * 0.1 +
      Math.min(100, importedAssets * 10) * 0.12 +
      traceCoverage * 0.12 +
      evalCoverage * 0.14 +
      ownerCoverage * 0.12 +
      proofCoverage * 0.12 +
      mappingCoverage * 0.08 +
      auditCoverage * 0.02,
  );
  const grade: RuntimeControlHealthGrade =
    score >= 82 && activeAdapters.length > 0 && proofCoverage >= 80 && ownerCoverage >= 70
      ? "launch_ready"
      : score >= 62 && activeAdapters.length > 0
        ? "controlled"
        : score >= 30 || testedAdapters.length > 0 || importedAssets > 0
          ? "forming"
          : "unmapped";

  const firstUntestedManifest = runtimeAdapterManifests.find((manifest) => !testedAdapters.some((adapter) => adapter.manifestId === manifest.id));
  const firstUncommittedJob = importJobs.find((job) => job.status === "tested" || job.status === "previewed");
  const firstOwnerGap = runtimeAssets.find((asset) => asset.owner === "Unassigned" || asset.status === "needs_owner");
  const firstEvalGap = runtimeAssets.find((asset) => asset.sourceType !== "eval" && asset.metrics.evals === 0);
  const firstProofGap = runtimeAssets.find((asset) => asset.proofIds.length === 0 || asset.status === "needs_proof");
  const firstMappingGap = runtimeAssets.find((asset) => asset.missingMappings.length > 0);
  const firstCostGap = monthlyCostUsd > 0 ? runtimeAssets.find((asset) => asset.metrics.monthlyCostUsd > 0 && asset.missingMappings.includes("department")) : undefined;

  const gaps = uniqueByGapId<RuntimeControlGap>([
    ...(activeAdapters.length
      ? []
      : [
          {
            id: "runtime-no-active-adapter",
            severity: "high" as const,
            label: "No active runtime adapter",
            detail: "Runtime traces, evals, costs, and prompt changes are not yet committed into the OS source of truth.",
            action: firstUntestedManifest ? `Test and commit ${firstUntestedManifest.name}.` : "Connect at least one runtime telemetry source.",
            target: "adapter" as const,
          },
        ]),
    ...(testedAdapters.length < Math.min(2, runtimeAdapterManifests.length)
      ? [
          {
            id: "runtime-single-source-risk",
            severity: "medium" as const,
            label: "Limited runtime source diversity",
            detail: "Enterprise AI portfolios usually span observability, broker, and custom runtimes. One source can hide shadow agents.",
            action: firstUntestedManifest ? `Add ${firstUntestedManifest.name} as the next adapter contract.` : "Review adapter coverage quarterly.",
            target: "adapter" as const,
          },
        ]
      : []),
    ...(firstOwnerGap
      ? [
          {
            id: "runtime-owner-gap",
            severity: "high" as const,
            label: "Runtime assets need owners",
            detail: `${100 - ownerCoverage}% of imported runtime assets do not yet have accountable ownership.`,
            action: `Assign an owner for ${firstOwnerGap.name}.`,
            target: "owner" as const,
          },
        ]
      : []),
    ...(firstEvalGap
      ? [
          {
            id: "runtime-eval-gap",
            severity: "medium" as const,
            label: "Evaluation coverage is thin",
            detail: `${evalCoverage}% of imported runtime assets carry eval evidence. Launch decisions need quality proof, not just traces.`,
            action: `Attach an eval suite to ${firstEvalGap.name}.`,
            target: "eval" as const,
          },
        ]
      : []),
    ...(firstProofGap
      ? [
          {
            id: "runtime-proof-gap",
            severity: "high" as const,
            label: "Proof references are incomplete",
            detail: `${proofCoverage}% of runtime assets have proof IDs. Every imported trace, tool call, cost, and eval should have ledger provenance.`,
            action: `Attach or regenerate proof for ${firstProofGap.name}.`,
            target: "proof" as const,
          },
        ]
      : []),
    ...(firstMappingGap
      ? [
          {
            id: "runtime-mapping-gap",
            severity: "medium" as const,
            label: "Normalized mappings are incomplete",
            detail: `${100 - mappingCoverage}% of imported runtime assets still have missing OS mappings.`,
            action: `Resolve ${firstMappingGap.missingMappings[0] ?? "missing mapping"} on ${firstMappingGap.name}.`,
            target: "asset" as const,
          },
        ]
      : []),
    ...(firstCostGap
      ? [
          {
            id: "runtime-cost-gap",
            severity: "medium" as const,
            label: "Runtime spend is not tied to value streams",
            detail: `$${monthlyCostUsd.toLocaleString()} in monthly runtime cost is visible, but department/value attribution is incomplete.`,
            action: `Map ${firstCostGap.name} cost to department and business value.`,
            target: "cost" as const,
          },
        ]
      : []),
    ...(highRiskAssets.length + restrictedAssets.length > 0 && proofCoverage < 100
      ? [
          {
            id: "runtime-high-risk-proof",
            severity: "restricted" as const,
            label: "High-risk assets need complete proof",
            detail: `${highRiskAssets.length + restrictedAssets.length} high or restricted runtime asset(s) exist. Launch review should not proceed without full proof.`,
            action: "Complete proof and owner mappings for high-risk runtime assets first.",
            target: "proof" as const,
          },
        ]
      : []),
  ]);

  const nextActions = uniqueByGapId<RuntimeControlNextAction>([
    ...(firstUntestedManifest
      ? [
          {
            id: `test-${firstUntestedManifest.id}`,
            label: `Test ${firstUntestedManifest.name}`,
            detail: "Validate fields, mappings, and proof events before importing data.",
            command: "test_adapter" as const,
            manifestId: firstUntestedManifest.id,
            priority: activeAdapters.length ? "medium" as const : "critical" as const,
          },
        ]
      : []),
    ...(firstUncommittedJob
      ? [
          {
            id: `commit-${firstUncommittedJob.manifestId}`,
            label: `Commit ${manifestFor(firstUncommittedJob.manifestId).name} import`,
            detail: firstUncommittedJob.message || "Previewed runtime assets are ready to become inventory and evidence records.",
            command: "commit_import" as const,
            manifestId: firstUncommittedJob.manifestId,
            priority: "high" as const,
          },
        ]
      : []),
    ...(firstOwnerGap
      ? [
          {
            id: `owner-${firstOwnerGap.id}`,
            label: "Assign runtime owner",
            detail: firstOwnerGap.name,
            command: "assign_owner" as const,
            assetId: firstOwnerGap.id,
            priority: "high" as const,
          },
        ]
      : []),
    ...(firstEvalGap
      ? [
          {
            id: `eval-${firstEvalGap.id}`,
            label: "Attach eval evidence",
            detail: firstEvalGap.name,
            command: "attach_eval" as const,
            assetId: firstEvalGap.id,
            priority: "medium" as const,
          },
        ]
      : []),
    ...(firstProofGap
      ? [
          {
            id: `proof-${firstProofGap.id}`,
            label: "Close proof gap",
            detail: firstProofGap.name,
            command: "attach_proof" as const,
            assetId: firstProofGap.id,
            priority: "high" as const,
          },
        ]
      : []),
    ...(firstCostGap
      ? [
          {
            id: `cost-${firstCostGap.id}`,
            label: "Map runtime cost",
            detail: firstCostGap.name,
            command: "map_cost" as const,
            assetId: firstCostGap.id,
            priority: "medium" as const,
          },
        ]
      : []),
    {
      id: "open-runtime-inventory",
      label: "Review runtime inventory",
      detail: "Inspect imported traces, evals, tool calls, prompts, costs, owners, and evidence gaps.",
      command: "open_inventory",
      priority: importedAssets ? "low" : "medium",
    },
  ]).slice(0, 6);

  const gradeLabel: Record<RuntimeControlHealthGrade, string> = {
    launch_ready: "launch-ready",
    controlled: "controlled",
    forming: "forming",
    unmapped: "unmapped",
  };
  const summary =
    grade === "launch_ready"
      ? "Runtime telemetry is connected, owned, evaluated, and proof-linked enough for governed scale."
      : grade === "controlled"
        ? "Runtime telemetry is operating, but ownership, eval, mapping, or proof gaps still need closure."
        : grade === "forming"
          ? "Runtime telemetry is being connected; the next step is committing imports and closing proof gaps."
          : "Runtime telemetry is not mapped yet. Connect at least one observability, broker, or custom runtime adapter.";

  return {
    grade,
    score,
    summary: `${gradeLabel[grade]}: ${summary}`,
    metrics: {
      manifests: runtimeAdapterManifests.length,
      activeAdapters: activeAdapters.length,
      testedAdapters: testedAdapters.length,
      importedAssets,
      traceSources: traceAssets.length,
      evalCoverage,
      ownerCoverage,
      proofCoverage,
      mappingCoverage,
      avgAdapterCoverage,
      monthlyCostUsd,
      highRiskAssets: highRiskAssets.length,
      restrictedAssets: restrictedAssets.length,
      importAudits: importAudits.length,
    },
    gaps,
    nextActions,
  };
}
