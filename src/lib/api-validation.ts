import { z } from "zod";

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

export const workspaceInputSchema = z.object({
  schema: z.literal("enterprise-ai-enablement-os.workspace.v1").optional(),
  organizationId: z.string().trim().min(1).max(180).optional(),
  organization: z.object({
    id: z.string().trim().min(1).max(180).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    workspaceLabel: z.string().trim().min(1).max(120).optional(),
    primaryColor: z.string().trim().regex(/^#[0-9a-f]{6}$/i).optional(),
    logoUrl: z.string().trim().max(2000).optional(),
    updatedAt: z.string().optional(),
  }).optional(),
  useCases: z.array(z.unknown()).max(5000).default([]),
  skills: z.array(z.unknown()).max(5000).default([]),
  runs: z.array(z.unknown()).max(20000).default([]),
  toolRequests: z.array(z.unknown()).max(20000).default([]),
  auditLogs: z.array(z.unknown()).max(50000).default([]),
  governanceReviews: z.array(z.unknown()).max(10000).default([]),
  evalResults: z.array(z.unknown()).max(50000).default([]),
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

export const harnessRunInputSchema = z.object({
  skill: skillInputSchema,
  tools: z.array(toolInputSchema).max(1000).default([]),
  routingSettings: jsonObjectSchema.optional(),
  triggeredBy: z.string().trim().max(200).optional(),
  timestamp: z.string().trim().max(120).optional(),
  runId: z.string().trim().max(160).optional(),
  toolRequestId: z.string().trim().max(160).optional(),
  message: z.string().max(50000).optional(),
});

export const connectorExecutionInputSchema = z.object({
  skill: skillInputSchema,
  tools: z.array(toolInputSchema).max(1000).default([]),
  toolId: z.string().trim().min(1).max(240),
  payload: jsonObjectSchema.default({}),
  approved: z.boolean().optional(),
});

export const contextRetrieveInputSchema = z.object({
  skill: skillInputSchema,
  sources: z.array(contextSourceInputSchema).max(1000).default([]),
  query: z.string().max(20000).default(""),
  limit: z.number().int().min(1).max(25).default(5),
});

export const workflowJobCreateInputSchema = z.object({
  workflowId: z.string().trim().min(1).max(180).optional(),
  skillId: z.string().trim().min(1).max(180).optional(),
  input: jsonObjectSchema.default({}),
});

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

export const orchestratorActionTypeSchema = z.enum([
  "open_view",
  "open_intake",
  "draft_use_case",
  "generate_exec_brief",
  "validate_workflow",
  "test_workflow",
  "publish_workflow",
  "load_knowledge_workflow",
  "load_approval_workflow",
  "run_selected_skill",
  "run_selected_eval",
  "submit_selected_governance",
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
});

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "body",
    message: issue.message,
  }));
}
