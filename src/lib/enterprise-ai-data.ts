export type Department =
  | "HR"
  | "Finance"
  | "Legal"
  | "Procurement"
  | "IT"
  | "Marketing"
  | "Operations"
  | "Security"
  | "Compliance"
  | "Data"
  | "Other";

export type RiskLevel = "low" | "medium" | "high" | "restricted";

export type UseCaseStatus =
  | "draft"
  | "submitted"
  | "triage"
  | "discovery"
  | "scored"
  | "governance_review"
  | "approved_for_pilot"
  | "in_pilot"
  | "measuring"
  | "scaled"
  | "parked"
  | "rejected";

export type SkillStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "pilot"
  | "production"
  | "deprecated"
  | "archived";

export type AutonomyTier =
  | "tier_0_draft_only"
  | "tier_1_read_only"
  | "tier_2_prepare_action"
  | "tier_3_execute_bounded_action"
  | "tier_4_autonomous_workflow"
  | "tier_5_restricted";

export type User = {
  id: string;
  name: string;
  email: string;
  title: string;
  department: Department;
  role: string;
};

export type UseCase = {
  id: string;
  title: string;
  description: string;
  department: Department;
  requestorId: string;
  ownerId?: string;
  businessProblem: string;
  currentProcess: string;
  desiredOutcome: string;
  monthlyVolume: number;
  avgHandlingTimeMinutes: number;
  estimatedUsers: number;
  capabilityType: string;
  status: UseCaseStatus;
  riskLevel: RiskLevel;
  valueScore: number;
  feasibilityScore: number;
  riskScore: number;
  reuseScore: number;
  urgencyScore: number;
  dataReadinessScore: number;
  priorityScore: number;
  expectedBenefits: string[];
  dataSources: string[];
  risks: string[];
  linkedSkillId?: string;
  updatedAt: string;
  createdAt: string;
};

export type Skill = {
  id: string;
  useCaseId?: string;
  name: string;
  slug: string;
  description: string;
  department: Department | "Cross-Functional";
  ownerId: string;
  status: SkillStatus;
  version: string;
  riskLevel: RiskLevel;
  autonomyTier: AutonomyTier;
  modelProvider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  fallbackModel: string;
  costLimit: number;
  systemPrompt: string;
  allowedTools: string[];
  blockedTools: string[];
  contextSources: string[];
  evalPassRate: number;
  adoptionCount: number;
  valueDelivered: number;
  runs: number;
  updatedAt: string;
};

export type Tool = {
  id: string;
  displayName: string;
  description: string;
  category: string;
  actionType: "read" | "write" | "create" | "update" | "delete" | "execute";
  riskLevel: RiskLevel;
  requiresApprovalByDefault: boolean;
  enabled: boolean;
  usage: number;
  lastUsed: string;
};

export type ContextSource = {
  id: string;
  name: string;
  type: string;
  classification: "public" | "internal" | "confidential" | "restricted" | "regulated";
  ownerDepartment: Department;
  enabled: boolean;
  lastIndexedAt: string;
  documentCount: number;
  skillsUsing: number;
  health: "healthy" | "attention" | "stale";
};

export type ToolRequest = {
  id: string;
  skillId: string;
  runId: string;
  user: string;
  toolId: string;
  reason: string;
  riskLevel: RiskLevel;
  status: "pending" | "approved" | "rejected" | "blocked";
  requestedAt: string;
};

export type RunTraceStep = {
  label: string;
  status: "completed" | "running" | "waiting" | "blocked";
  detail: string;
  latencyMs: number;
};

export type RunExecutionMode = "live" | "simulated";

export type Run = {
  id: string;
  skillId: string;
  useCaseId?: string;
  triggeredBy: string;
  status: "queued" | "running" | "waiting_for_approval" | "completed" | "failed" | "blocked";
  riskLevel: RiskLevel;
  currentStage: string;
  costUsd: number;
  latencyMs: number;
  startedAt: string;
  output: string;
  trace: RunTraceStep[];
  /**
   * Honesty marker. "live" means a real model provider produced the output.
   * "simulated" means the deterministic local runtime produced it (no provider call).
   * Absent on records persisted before this field existed — treat as unknown, not live.
   */
  executionMode?: RunExecutionMode;
  /** Why the run was simulated (e.g. no provider configured). Set when executionMode is "simulated". */
  simulationReason?: string;
};

export type AuditLog = {
  id: string;
  eventType: string;
  message: string;
  actor: string;
  riskLevel: RiskLevel;
  createdAt: string;
  integrity?: {
    algorithm: "sha256-v1";
    sequence: number;
    previousHash: string;
    hash: string;
    canonicalHash: string;
    sealedAt: string;
  };
};

export type GovernanceReview = {
  id: string;
  itemType: "use_case" | "skill";
  itemId: string;
  title: string;
  department: Department | "Cross-Functional";
  riskLevel: RiskLevel;
  reviewer: string;
  status: "not_submitted" | "in_review" | "changes_requested" | "approved_with_conditions" | "approved" | "rejected";
  dueDate: string;
  blockers: string[];
};

export type EvalResult = {
  id: string;
  skillId: string;
  suiteName: string;
  score: number;
  passed: boolean;
  criticalFailures: number;
  createdAt: string;
};

export type WorkSignalSource =
  | "service_now"
  | "jira"
  | "slack"
  | "teams"
  | "email"
  | "sharepoint"
  | "workday"
  | "crm_system"
  | "support_system"
  | "source_control"
  | "data_platform"
  | "ai_observability"
  | "revenue_system"
  | "erp_system"
  | "finance_system"
  | "procurement_system"
  | "legal_system"
  | "learning_platform"
  | "harness"
  | "workflow"
  | "survey"
  | "other";

export type WorkSignalEventType =
  | "question_asked"
  | "ticket_created"
  | "approval_waiting"
  | "document_updated"
  | "workflow_delayed"
  | "skill_used"
  | "feedback_given"
  | "handoff_delayed"
  | "rework_detected"
  | "training_completed"
  | "governance_blocker"
  | "context_gap"
  | "process_variant";

export type WorkSignal = {
  id: string;
  source: WorkSignalSource;
  eventType: WorkSignalEventType;
  department: Department;
  process: string;
  teamId?: string;
  userId?: string;
  summary: string;
  metadata: {
    volume?: number;
    cycleTimeHours?: number;
    delayHours?: number;
    confidence?: number;
    sentiment?: "positive" | "neutral" | "negative";
    relatedSkillId?: string;
    relatedUseCaseId?: string;
    relatedContextSource?: string;
    system?: string;
    region?: string;
    count?: number;
  };
  privacy: {
    contentRedacted: boolean;
    piiRedacted: boolean;
    consentBasis: "aggregated" | "system_metadata" | "explicit_opt_in" | "business_record";
    retentionDays: number;
    individualScoringAllowed: false;
    rawContentStored: false;
  };
  riskLevel: RiskLevel;
  createdAt: string;
};

// Platform catalogs. Empty in production until configured; the demo loader
// populates them via setPlatformCatalogs (consumers read these live bindings).
export let users: User[] = [];

export let tools: Tool[] = [];

export let contextSources: ContextSource[] = [];

export function setPlatformCatalogs(next: {
  users?: User[];
  tools?: Tool[];
  contextSources?: ContextSource[];
}) {
  if (next.users) users = next.users;
  if (next.tools) tools = next.tools;
  if (next.contextSources) contextSources = next.contextSources;
}

export function clearPlatformCatalogs() {
  users = [];
  tools = [];
  contextSources = [];
}

export const initialUseCases: UseCase[] = [];

export const initialSkills: Skill[] = [];

export const initialRuns: Run[] = [];

export const initialToolRequests: ToolRequest[] = [];

export const initialAuditLogs: AuditLog[] = [];

export const initialGovernanceReviews: GovernanceReview[] = [];

export const initialEvalResults: EvalResult[] = [];

export const initialWorkSignals: WorkSignal[] = [];

export function getUserName(id?: string) {
  if (!id) return "Unassigned";
  const configuredUser = users.find((user) => user.id === id);
  if (configuredUser) return configuredUser.name;
  if (id === "current-user") return "Workspace Admin";
  return "User not configured";
}

export function calculatePriorityScore(input: {
  valueScore: number;
  feasibilityScore: number;
  reuseScore: number;
  urgencyScore: number;
  dataReadinessScore: number;
  riskScore: number;
}) {
  const weighted =
    input.valueScore * 0.3 +
    input.feasibilityScore * 0.2 +
    input.reuseScore * 0.2 +
    input.urgencyScore * 0.15 +
    input.dataReadinessScore * 0.1 -
    input.riskScore * 0.15;

  return Math.max(0, Math.min(100, Math.round((weighted / 4.25) * 100)));
}

export function riskToScore(risk: RiskLevel) {
  if (risk === "low") return 1;
  if (risk === "medium") return 2.5;
  if (risk === "high") return 4;
  return 5;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
