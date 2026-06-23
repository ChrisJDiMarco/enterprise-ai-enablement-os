import { z } from "zod";
import { isKnownTenantSecretName, tenantSecretValueIssue } from "./tenant-secret-readiness.ts";

export const userRoleSchema = z.enum([
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
]);

export const riskLevelSchema = z.enum(["low", "medium", "high", "restricted"]);

export const departmentSchema = z.enum([
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
]);

export const workSignalSourceSchema = z.enum([
  "service_now",
  "jira",
  "slack",
  "teams",
  "email",
  "sharepoint",
  "workday",
  "crm_system",
  "support_system",
  "source_control",
  "data_platform",
  "ai_observability",
  "revenue_system",
  "erp_system",
  "finance_system",
  "procurement_system",
  "legal_system",
  "learning_platform",
  "harness",
  "workflow",
  "survey",
  "other",
]);

export const workSignalEventTypeSchema = z.enum([
  "question_asked",
  "ticket_created",
  "approval_waiting",
  "document_updated",
  "workflow_delayed",
  "skill_used",
  "feedback_given",
  "handoff_delayed",
  "rework_detected",
  "training_completed",
  "governance_blocker",
  "context_gap",
  "process_variant",
]);

const brandingAssetUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  z
    .string()
    .trim()
    .max(2000)
    .refine((value) => {
      if (value.startsWith("/") && !value.startsWith("//") && !/[\r\n]/.test(value)) {
        return true;
      }

      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "logoUrl must be an HTTPS URL or root-relative path.")
    .optional(),
);

export const autonomyTierSchema = z.enum([
  "tier_0_draft_only",
  "tier_1_read_only",
  "tier_2_prepare_action",
  "tier_3_execute_bounded_action",
  "tier_4_autonomous_workflow",
  "tier_5_restricted",
]);

export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const auditLogInputSchema = z.object({
  id: z.string().trim().min(1).max(160).optional(),
  eventType: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
  actor: z.string().trim().min(1).max(200).optional(),
  riskLevel: riskLevelSchema,
  createdAt: z.string().trim().min(1).max(120).optional(),
});

export const auditMaintenanceInputSchema = z.object({
  action: z.literal("seal_legacy_chain"),
}).strict();

export const skillInputSchema = z.object({
  id: z.string().trim().min(1).max(180),
  name: z.string().trim().min(1).max(240),
  slug: z.string().trim().max(240).optional(),
  systemPrompt: z.string().min(1).max(50000),
  riskLevel: riskLevelSchema,
  autonomyTier: autonomyTierSchema,
  version: z.string().trim().max(80).optional(),
  allowedTools: z.array(z.string().trim().min(1).max(240)).max(500).default([]),
  blockedTools: z.array(z.string().trim().min(1).max(240)).max(500).default([]),
  contextSources: z.array(z.string().trim().min(1).max(240)).max(1000).default([]),
  temperature: z.number().finite().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(250000).optional(),
  costLimit: z.number().finite().min(0).max(10000).optional(),
}).passthrough();

export const toolInputSchema = z.object({
  id: z.string().trim().min(1).max(240),
  displayName: z.string().trim().max(240).optional(),
  description: z.string().trim().max(4000).optional(),
  category: z.string().trim().max(120).optional(),
  actionType: z.enum(["read", "write", "create", "update", "delete", "execute"]),
  riskLevel: riskLevelSchema,
  requiresApprovalByDefault: z.boolean(),
  enabled: z.boolean(),
  usage: z.number().finite().optional(),
  lastUsed: z.string().max(120).optional(),
}).passthrough();

export const contextSourceInputSchema = z.object({
  id: z.string().trim().min(1).max(240),
  name: z.string().trim().min(1).max(240),
  type: z.string().trim().min(1).max(120),
  classification: z.enum(["public", "internal", "confidential", "restricted", "regulated"]).optional(),
  dataClassification: z.enum(["public", "internal", "confidential", "restricted", "regulated"]).optional(),
  ownerDepartment: z.string().trim().max(120).optional(),
  enabled: z.boolean(),
  lastIndexedAt: z.string().max(120).optional(),
  documentCount: z.number().finite().optional(),
  skillsUsing: z.number().finite().optional(),
  health: z.string().max(80).optional(),
}).passthrough();

export const workSignalInputSchema = z.object({
  id: z.string().trim().min(1).max(160).optional(),
  source: workSignalSourceSchema,
  eventType: workSignalEventTypeSchema,
  department: departmentSchema,
  process: z.string().trim().min(1).max(180),
  teamId: z.string().trim().min(1).max(160).optional(),
  userId: z.string().trim().min(1).max(160).optional(),
  summary: z.string().trim().min(1).max(700),
  metadata: z.object({
    volume: z.number().finite().min(0).max(10000000).optional(),
    cycleTimeHours: z.number().finite().min(0).max(100000).optional(),
    delayHours: z.number().finite().min(0).max(100000).optional(),
    confidence: z.number().finite().min(0).max(1).optional(),
    sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
    relatedSkillId: z.string().trim().min(1).max(180).optional(),
    relatedUseCaseId: z.string().trim().min(1).max(180).optional(),
    relatedContextSource: z.string().trim().min(1).max(240).optional(),
    system: z.string().trim().min(1).max(160).optional(),
    region: z.string().trim().min(1).max(160).optional(),
    count: z.number().finite().min(0).max(10000000).optional(),
  }).default({}),
  privacy: z.object({
    contentRedacted: z.literal(true),
    piiRedacted: z.literal(true),
    consentBasis: z.enum(["aggregated", "system_metadata", "explicit_opt_in", "business_record"]),
    retentionDays: z.number().int().min(1).max(730),
    individualScoringAllowed: z.literal(false),
    rawContentStored: z.literal(false),
  }),
  riskLevel: riskLevelSchema,
  createdAt: z.string().trim().min(1).max(120).optional(),
}).strict();

export const workSignalBatchInputSchema = z.object({
  signals: z.array(workSignalInputSchema).min(1).max(100),
}).strict();

export const workspaceInputSchema = z.object({
  schema: z.literal("enterprise-ai-enablement-os.workspace.v1").optional(),
  organizationId: z.string().trim().min(1).max(180).optional(),
  workspaceMode: z.enum(["production", "demo"]).optional(),
  organization: z.object({
    id: z.string().trim().min(1).max(180).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    workspaceLabel: z.string().trim().min(1).max(120).optional(),
    primaryColor: z.string().trim().regex(/^#[0-9a-f]{6}$/i).optional(),
    logoUrl: brandingAssetUrlSchema,
    updatedAt: z.string().optional(),
  }).optional(),
  users: z.array(z.unknown()).max(5000).default([]),
  tools: z.array(z.unknown()).max(5000).default([]),
  contextSources: z.array(z.unknown()).max(10000).default([]),
  useCases: z.array(z.unknown()).max(5000).default([]),
  skills: z.array(z.unknown()).max(5000).default([]),
  runs: z.array(z.unknown()).max(20000).default([]),
  toolRequests: z.array(z.unknown()).max(20000).default([]),
  auditLogs: z.array(z.unknown()).max(50000).default([]),
  governanceReviews: z.array(z.unknown()).max(10000).default([]),
  evalResults: z.array(z.unknown()).max(50000).default([]),
  workSignals: z.array(workSignalInputSchema.passthrough()).max(50000).default([]),
  commandOrders: z.array(z.unknown()).max(10000).default([]),
  runtimeAdapters: z.array(z.unknown()).max(1000).default([]),
  runtimeImportJobs: z.array(z.unknown()).max(10000).default([]),
  normalizedRuntimeAssets: z.array(z.unknown()).max(100000).default([]),
  installedLaunchPacks: z.array(z.unknown()).max(1000).default([]),
  reportSchedules: z.array(z.unknown()).max(10000).default([]),
  runtimeImportAudits: z.array(z.unknown()).max(50000).default([]),
  workflow: z.object({
    status: z.enum(["Saved", "Testing", "Published"]).optional(),
    nodes: z.array(z.unknown()).max(5000).default([]),
    edges: z.array(z.unknown()).max(10000).default([]),
  }).default({ status: "Saved", nodes: [], edges: [] }),
  report: z.string().max(500000).default(""),
  aiSettings: jsonObjectSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

export const workspaceCommandTypeSchema = z.enum([
  "create_use_case",
  "convert_use_case_to_skill",
  "run_eval_suite",
  "submit_governance_review",
  "decide_governance",
  "decide_tool_request",
  "publish_workflow",
  "generate_report",
  "test_runtime_adapter",
  "commit_runtime_import",
  "install_launch_pack",
  "create_report_schedules",
  "toggle_report_schedule",
  "update_organization",
]);

export const workspaceCommandInputSchema = z.object({
  id: z.string().trim().min(1).max(180).optional(),
  type: workspaceCommandTypeSchema,
  payload: jsonObjectSchema.default({}),
}).strict();

export const reportTemplateSchema = z.enum([
  "weekly_ai_enablement_brief",
  "monthly_portfolio_review",
  "governance_summary",
  "adoption_report",
  "roi_report",
  "pilot_readout",
  "board_summary",
]);

export const reportGenerateInputSchema = z.object({
  template: reportTemplateSchema.default("weekly_ai_enablement_brief"),
  workspace: workspaceInputSchema.optional(),
  routingSettings: jsonObjectSchema.optional(),
}).strict();

export const useCasePilotBriefGenerateInputSchema = z.object({
  useCaseId: z.string().trim().min(1).max(180),
  workspace: workspaceInputSchema.optional(),
  routingSettings: jsonObjectSchema.optional(),
}).strict();

export const useCaseDraftGenerateInputSchema = z.object({
  message: z.string().trim().min(3).max(4000),
  routingSettings: jsonObjectSchema.optional(),
}).strict();

export const workspaceUserInputSchema = z.object({
  id: z.string().trim().min(1).max(180).optional(),
  name: z.string().trim().min(2).max(180),
  email: z.string().trim().email().max(320),
  title: z.string().trim().max(180).optional().default("Workspace member"),
  department: departmentSchema.default("Other"),
  role: userRoleSchema.default("viewer"),
}).strict();

export const workspaceUserDeleteInputSchema = z.object({
  userId: z.string().trim().min(1).max(180),
}).strict();

/**
 * Local/emergency login body. Every field is optional (the route supplies safe
 * defaults), but anything provided is validated and bounded before it is sealed
 * into a signed session — otherwise a caller could mint a signed admin session
 * with an arbitrary/unbounded identity or tenant. Not `.strict()`: the same body
 * may also carry emergency-token fields that are read out-of-band.
 */
export const localLoginInputSchema = z.object({
  id: z.string().trim().min(1).max(180).optional(),
  organizationId: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9._-]+$/, "organizationId may only contain letters, numbers, dot, dash, and underscore")
    .optional(),
  name: z.string().trim().min(1).max(180).optional(),
  email: z.string().trim().email().max(320).optional(),
  role: userRoleSchema.optional(),
  department: z.string().trim().min(1).max(120).optional(),
});

const scimNameSchema = z.object({
  formatted: z.string().trim().min(1).max(180).optional(),
  givenName: z.string().trim().min(1).max(90).optional(),
  familyName: z.string().trim().min(1).max(90).optional(),
}).passthrough();

export const workspaceUserProvisionUserSchema = z.object({
  id: z.string().trim().min(1).max(180).optional(),
  externalId: z.string().trim().min(1).max(240).optional(),
  name: z.union([z.string().trim().min(1).max(180), scimNameSchema]).optional(),
  userName: z.string().trim().email().max(320).optional(),
  email: z.string().trim().email().max(320).optional(),
  title: z.string().trim().max(180).optional().default("Workspace member"),
  department: departmentSchema.default("Other"),
  role: userRoleSchema.default("viewer"),
  active: z.boolean().default(true),
}).strict().superRefine((value, context) => {
  const email = value.email ?? value.userName;
  if (!email) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["email"],
      message: "A provisioned user requires email or userName.",
    });
  }
  if (value.active !== false && !value.name) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: "Active provisioned users require a display name.",
    });
  }
});

export const workspaceUserProvisionBatchInputSchema = z.object({
  organizationId: z.string().trim().min(1).max(180).optional(),
  source: z.enum(["scim", "idp_sync", "admin_import", "manual"]).default("idp_sync"),
  deprovisionMissing: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  users: z.array(workspaceUserProvisionUserSchema).min(1).max(1000),
}).strict();

export const tenantProvisionInputSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  workspaceLabel: z.string().trim().min(2).max(120).default("AI Enablement OS"),
  primaryColor: z.string().trim().regex(/^#[0-9a-f]{6}$/i).default("#635bff"),
  logoUrl: brandingAssetUrlSchema,
  adminName: z.string().trim().min(2).max(160).default("Workspace Admin"),
  adminEmail: z.string().trim().email().default("admin@example.com"),
  adminDepartment: departmentSchema.default("Other"),
  adminRole: userRoleSchema.default("admin"),
  workspaceMode: z.enum(["production", "demo"]).default("production"),
}).strict();

const tenantSecretNameSchema = z.string().trim().min(2).max(120).regex(/^[A-Z0-9_]+$/);

export const tenantSecretsInputSchema = z.object({
  secrets: z.record(
    tenantSecretNameSchema,
    z.string().trim().min(1).max(20000),
  ).refine((value) => Object.keys(value).length <= 30, "At most 30 secrets can be updated at once.")
    .superRefine((value, context) => {
      for (const name of Object.keys(value)) {
        if (!isKnownTenantSecretName(name)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [name],
            message: `${name} is not a supported tenant vault secret name. Use a provider, connector, or control-plane secret from the catalog.`,
          });
        }

        const valueIssue = tenantSecretValueIssue(name, value[name]);
        if (valueIssue) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [name],
            message: valueIssue,
          });
        }
      }
    }),
  scope: z.enum(["provider", "connector", "tenant"]).default("tenant"),
}).strict();

export const providerSecretsInputSchema = tenantSecretsInputSchema;

export const tenantSecretsDeleteInputSchema = z.object({
  names: z.array(tenantSecretNameSchema).min(1).max(30)
    .refine((value) => new Set(value).size === value.length, "Secret names must be unique."),
  scope: z.enum(["provider", "connector", "tenant"]).default("tenant"),
}).strict();

export const providerSecretsDeleteInputSchema = tenantSecretsDeleteInputSchema;

export const databaseBackupDrillInputSchema = z.object({
  action: z.literal("backup_restore_drill").default("backup_restore_drill"),
  dryRun: z.boolean().default(true),
}).strict();

export const privacyRetentionMaintenanceInputSchema = z.object({
  action: z.literal("retention_sweep").default("retention_sweep"),
  dryRun: z.boolean().default(true),
}).strict();

export const harnessRunInputSchema = z.object({
  skillId: z.string().trim().min(1).max(180).optional(),
  skill: skillInputSchema.optional(),
  tools: z.array(toolInputSchema).max(1000).default([]),
  routingSettings: jsonObjectSchema.optional(),
  triggeredBy: z.string().trim().max(200).optional(),
  timestamp: z.string().trim().max(120).optional(),
  runId: z.string().trim().max(160).optional(),
  toolRequestId: z.string().trim().max(160).optional(),
  message: z.string().max(50000).optional(),
}).refine((input) => input.skillId || input.skill?.id, {
  message: "A workspace Skill id is required before Harness execution.",
  path: ["skillId"],
});

export const connectorExecutionInputSchema = z.object({
  skillId: z.string().trim().min(1).max(180).optional(),
  skill: skillInputSchema.optional(),
  tools: z.array(toolInputSchema).max(1000).default([]),
  toolId: z.string().trim().min(1).max(240),
  payload: jsonObjectSchema.default({}),
  approved: z.boolean().optional(),
  approvalId: z.string().trim().min(1).max(180).optional(),
  idempotencyKey: z.string().trim().min(1).max(180).optional(),
}).refine((input) => input.skillId || input.skill?.id, {
  message: "A workspace Skill id is required before connector execution.",
  path: ["skillId"],
});

export const evalTestInputSchema = z.object({
  id: z.string().trim().min(1).max(180).optional(),
  name: z.string().trim().min(1).max(240),
  type: z.enum([
    "grounding",
    "hallucination",
    "permission",
    "prompt_injection",
    "tool_safety",
    "decision_boundary",
    "quality",
    "latency",
    "cost",
    "regression",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  input: z.string().max(20000),
  expectedBehavior: z.string().max(20000),
});

export const evalRunInputSchema = z.object({
  skillId: z.string().trim().min(1).max(180).optional(),
  skill: skillInputSchema.optional(),
  tests: z.array(evalTestInputSchema).max(250).optional(),
  suiteId: z.string().trim().min(1).max(180).optional(),
  suiteName: z.string().trim().min(1).max(240).optional(),
  threshold: z.number().finite().min(0).max(100).optional(),
}).refine((input) => input.skillId || input.skill?.id, {
  message: "A workspace Skill id is required before eval execution.",
  path: ["skillId"],
});

export const evalScheduleMaintenanceInputSchema = z.object({
  action: z.enum(["queue_due", "run_due"]).default("queue_due"),
  dryRun: z.boolean().default(true),
  includeBlocked: z.boolean().optional(),
  maxSkills: z.number().int().min(1).max(100).default(25),
  threshold: z.number().finite().min(0).max(100).optional(),
}).strict();

export const contextRetrieveInputSchema = z.object({
  skillId: z.string().trim().min(1).max(180).optional(),
  skill: skillInputSchema.optional(),
  sources: z.array(contextSourceInputSchema).max(1000).default([]),
  query: z.string().max(20000).default(""),
  limit: z.number().int().min(1).max(25).default(5),
}).strict().refine((input) => input.skillId || input.skill?.id, {
  message: "A workspace Skill id is required before context retrieval.",
  path: ["skillId"],
});

export const contextIndexDocumentInputSchema = z.object({
  id: z.string().trim().min(1).max(180).optional(),
  sourceId: z.string().trim().min(1).max(240),
  sourceName: z.string().trim().min(1).max(240),
  title: z.string().trim().min(1).max(300),
  content: z.string().trim().min(1).max(200000),
  uri: z.string().trim().max(4000).optional(),
  classification: z.enum(["public", "internal", "confidential", "restricted", "regulated"]).default("internal"),
  ownerDepartment: z.string().trim().min(1).max(120).default("Other"),
  ingestionMethod: z.enum(["manual", "api_import", "connector_sync", "sync_worker", "vector_store"]).default("manual"),
  ingestionStatus: z.enum(["indexed", "quarantined", "failed"]).default("indexed"),
  indexedAt: z.string().trim().max(80).optional(),
  sourceUpdatedAt: z.string().trim().max(80).optional(),
  syncJobId: z.string().trim().max(180).optional(),
  checksum: z.string().trim().max(180).optional(),
  permissionHash: z.string().trim().max(180).optional(),
  metadata: jsonObjectSchema.optional(),
});

export const contextIndexInputSchema = z.object({
  documents: z.array(contextIndexDocumentInputSchema).min(1).max(100),
}).strict();

export const workflowJobCreateInputSchema = z.object({
  workflowId: z.string().trim().min(1).max(180).optional(),
  skillId: z.string().trim().min(1).max(180).optional(),
  input: jsonObjectSchema.default({}),
}).strict();

export const workflowJobStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_for_approval",
  "completed",
  "failed",
  "cancelled",
]);

export const workflowJobUpdateInputSchema = z.object({
  id: z.string().trim().min(1).max(180),
  status: workflowJobStatusSchema,
  output: jsonObjectSchema.optional(),
  error: z.string().max(4000).optional(),
});

export const workflowJobMaintenanceInputSchema = z.object({
  action: z.literal("reconcile_stale"),
  dryRun: z.boolean().default(true),
  staleAfterMinutes: z.number().int().min(1).max(10080).optional(),
  maxJobs: z.number().int().min(1).max(500).optional(),
}).strict();

export const orchestratorActionTypeSchema = z.enum([
  "open_view",
  "open_intake",
  "draft_use_case",
  "capture_work_signal",
  "open_top_use_case",
  "convert_top_use_case_to_skill",
  "generate_exec_brief",
  "validate_workflow",
  "test_workflow",
  "publish_workflow",
  "load_knowledge_workflow",
  "load_approval_workflow",
  "run_selected_skill",
  "run_selected_eval",
  "submit_selected_governance",
  "approve_pending_tool_request",
  "reject_pending_tool_request",
  "open_selected_run_trace",
  "approve_governance_review",
  "request_governance_changes",
  "open_command_order",
  "complete_command_order",
  "open_ai_settings",
  "clear_chat",
]);

export const orchestratorMessageInputSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(20000),
  createdAt: z.string().max(120).optional(),
});

export const orchestratorChatInputSchema = z.object({
  message: z.string().trim().min(1).max(20000),
  history: z.array(orchestratorMessageInputSchema).max(24).default([]),
  workspace: jsonObjectSchema.default({}),
  routingSettings: jsonObjectSchema.optional(),
  selectedSkillId: z.string().trim().min(1).max(180).optional(),
  selectedRunId: z.string().trim().min(1).max(180).optional(),
});

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "body",
    message: issue.message,
  }));
}

export function boundedQueryLimit(
  value: string | null | undefined,
  options: { defaultLimit: number; maxLimit: number; minLimit?: number },
) {
  const minLimit = Math.max(1, Math.trunc(options.minLimit ?? 1));
  const maxLimit = Math.max(minLimit, Math.trunc(options.maxLimit));
  const defaultLimit = Math.min(maxLimit, Math.max(minLimit, Math.trunc(options.defaultLimit)));
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return defaultLimit;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return defaultLimit;

  return Math.min(maxLimit, Math.max(minLimit, Math.trunc(parsed)));
}
