import type { Department, RiskLevel } from "@/lib/enterprise-ai-data";

export type View =
  | "command"
  | "blueprint"
  | "strategy"
  | "process"
  | "work"
  | "factory"
  | "harness"
  | "skills"
  | "workflow"
  | "broker"
  | "context"
  | "evals"
  | "governance"
  | "launch"
  | "roi"
  | "training"
  | "reports"
  | "admin"
  | "evidence"
  | "orchestrator"
  | "estate"
  | "connectors"
  | "session";

export type HarnessMode = "overview" | "runs" | "detail";

export type IntakeForm = {
  title: string;
  department: Department;
  businessProblem: string;
  currentProcess: string;
  desiredOutcome: string;
  aiHelp: string;
  aiNotDo: string;
  monthlyVolume: number;
  avgHandlingTimeMinutes: number;
  estimatedUsers: number;
  dataSensitivity: RiskLevel;
  dataSources: string;
  humanReview: boolean;
  externalCommunication: boolean;
};

export type OnboardingPermissionId =
  | "identity"
  | "knowledge"
  | "workSignals"
  | "tickets"
  | "calendar"
  | "governance"
  | "desktopBridge";

export type OnboardingDraft = {
  companyName: string;
  workspaceLabel: string;
  setupMode: "real" | "pilot" | "demo";
  functions: Department[];
  permissions: OnboardingPermissionId[];
};

export type CommandItem = {
  id: string;
  label: string;
  description: string;
  group: string;
  action: () => void;
};

export type OrchestratorActionType =
  | "open_view"
  | "open_intake"
  | "draft_use_case"
  | "capture_work_signal"
  | "open_top_use_case"
  | "convert_top_use_case_to_skill"
  | "generate_exec_brief"
  | "validate_workflow"
  | "test_workflow"
  | "publish_workflow"
  | "load_knowledge_workflow"
  | "load_approval_workflow"
  | "run_selected_skill"
  | "run_selected_eval"
  | "submit_selected_governance"
  | "approve_pending_tool_request"
  | "reject_pending_tool_request"
  | "open_selected_run_trace"
  | "approve_governance_review"
  | "request_governance_changes"
  | "open_command_order"
  | "complete_command_order"
  | "open_ai_settings"
  | "clear_chat";

export type OrchestratorAction = {
  id: string;
  type: OrchestratorActionType;
  label: string;
  description?: string;
  payload?: Record<string, unknown>;
  tone?: "primary" | "secondary" | "danger";
};

export type OrchestratorMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  actions?: OrchestratorAction[];
  evidence?: { label: string; value: string }[];
  /** True when the reply came from the deterministic local planner instead of a live model. */
  simulated?: boolean;
};

export type ProductionReadiness = {
  status?: "ready" | "degraded" | "blocked";
  generatedAt?: string;
  customerLaunchContract?: {
    status: "ready" | "needs-work" | "blocked";
    score: number;
    readyCount: number;
    needsWorkCount: number;
    blockedCount: number;
    domains: {
      id: string;
      label: string;
      owner: string;
      status: "ready" | "needs-work" | "blocked";
      score: number;
      summary: string;
      evidence: string[];
      nextAction: string;
      env: string[];
    }[];
    nextActions: {
      id: string;
      label: string;
      owner: string;
      status: "ready" | "needs-work" | "blocked";
      score: number;
      summary: string;
      evidence: string[];
      nextAction: string;
      env: string[];
    }[];
  };
  auth?: {
    authRequired: boolean;
    oidcConfigured: boolean;
    localLoginEnabled: boolean;
    mode: string;
    issueCount?: number;
    warningCount?: number;
    issues?: string[];
    warnings?: string[];
  };
  blockers?: { id: string; label: string; detail: string; status: string }[];
  warnings?: { id: string; label: string; detail: string; status: string }[];
  manualActions?: {
    id: string;
    title: string;
    severity: "blocker" | "warning";
    owner: string;
    action: string;
    why: string;
    env: string[];
    verify: string;
  }[];
  manualActionsMarkdown?: string;
  database?: {
    mode: string;
    configured: boolean;
    durable: boolean;
    reason: string;
  };
  apiProtection?: {
    configured: boolean;
    salted: boolean;
    mode: string;
    reason: string;
  };
  secretVault?: {
    configured: boolean;
    encrypted: boolean;
    mode: string;
    reason: string;
  };
  userProvisioning?: {
    configured: boolean;
    mode: string;
    reason: string;
  };
  connectors?: {
    configured: boolean;
    mode: string;
    eventSummary?: {
      total: number;
      executed: number;
      requiresApproval: number;
      blocked: number;
      envelopeCount: number;
      missingEnvelopeCount: number;
      redactedPayloadCount: number;
      latestAt?: string;
    };
    catalog?: {
      brokerConfigured: boolean;
      brokerMode: string;
      readyCount: number;
      partialCount: number;
      missingCount: number;
      requiredCount: number;
      productionReady: boolean;
      connectors: {
        id: string;
        label: string;
        system: string;
        category: string;
        status: string;
        executionMode: string;
        requiredSecretNames: string[];
        optionalSecretNames?: string[];
        configuredSecrets: string[];
        missingSecrets: string[];
        requiredScopes: string[];
        capabilities: string[];
        productionUse: string;
        setupAction: string;
        activationState?: string;
        nextActivationAction?: string;
        activationChecklist?: {
          id: string;
          label: string;
          status: "complete" | "pending";
          owner: string;
          action: string;
        }[];
      }[];
    };
  };
  workflows?: {
    configured: boolean;
    mode: string;
  };
  harnessTraceSummary?: {
    total: number;
    completed: number;
    waitingForApproval: number;
    blocked: number;
    failed: number;
    promptQualityAverage: number;
    promptQualityUnsafe: number;
    policyBlocked: number;
    approvalGated: number;
    latestAt?: string;
  };
  operations?: {
    backup?: {
      configured: boolean;
      mode: string;
      reason: string;
      evidence: string[];
    };
    migrations?: {
      configured: boolean;
      mode: string;
      reason: string;
      evidence: string[];
    };
    traceStore?: {
      configured: boolean;
      mode: string;
      reason: string;
      evidence: string[];
    };
    evalRunner?: {
      configured: boolean;
      mode: string;
      reason: string;
      evidence: string[];
    };
    auditIntegrity?: {
      configured: boolean;
      mode: string;
      reason: string;
      evidence: string[];
    };
  };
  session?: {
    organizationId: string;
    role: string;
    expiresAt: number;
  } | null;
};
