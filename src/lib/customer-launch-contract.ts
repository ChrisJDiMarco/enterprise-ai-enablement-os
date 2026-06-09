import type { ConnectorEventSummary } from "./connector-events.ts";
import type { ConnectorReadinessSummary } from "./enterprise-connectors.ts";
import type { ContextReadinessSummary } from "./context-index.ts";
import { evalCadenceConfigFromEnv, type EvalCadenceConfig, type EvalSchedulePlan } from "./eval-scheduler.ts";
import { observabilityConfigFromEnv, type ObservabilityConfig } from "./observability.ts";
import {
  privacyLifecycleConfigFromEnv,
  type PrivacyLifecycleConfig,
  type PrivacyLifecycleOperations,
} from "./privacy-lifecycle.ts";
import type { ProviderReadiness } from "./provider-registry.ts";
import type { OperationsReadiness } from "./production-ops-readiness.ts";
import type { HarnessTraceSummary } from "./trace-store.ts";
import type { WorkflowJobSummary } from "./workflow-jobs.ts";

export type LaunchDomainStatus = "ready" | "needs-work" | "blocked";

export type CustomerLaunchDomain = {
  id:
    | "identity"
    | "tenant-data"
    | "model-ops"
    | "connector-activation"
    | "context-ingestion"
    | "workflow-runtime"
    | "continuous-evals"
    | "evidence-ops"
    | "observability"
    | "privacy-lifecycle";
  label: string;
  owner: "Identity" | "Platform" | "Data" | "AI" | "Integrations" | "Security" | "Operations" | "Privacy";
  status: LaunchDomainStatus;
  score: number;
  summary: string;
  evidence: string[];
  nextAction: string;
  env: string[];
};

export type CustomerLaunchContract = {
  status: LaunchDomainStatus;
  score: number;
  readyCount: number;
  needsWorkCount: number;
  blockedCount: number;
  domains: CustomerLaunchDomain[];
  nextActions: CustomerLaunchDomain[];
};

type RuntimeEnv = Record<string, string | undefined>;

type ContractInput = {
  env?: RuntimeEnv;
  auth: {
    authRequired: boolean;
    oidcConfigured: boolean;
  };
  database: {
    durable: boolean;
    configured: boolean;
  };
  apiProtection: {
    configured: boolean;
    salted: boolean;
  };
  secretVault: {
    configured: boolean;
    encrypted: boolean;
    mode: string;
  };
  provisioningConfigured: boolean;
  modelBudgetConfigured?: boolean;
  connectorEventSummary?: ConnectorEventSummary;
  contextIngestionConfigured?: boolean;
  contextReadiness?: ContextReadinessSummary;
  evalCadence?: EvalCadenceConfig;
  evalSchedulePlan?: EvalSchedulePlan;
  harnessTraceSummary?: HarnessTraceSummary;
  observability?: ObservabilityConfig;
  privacyLifecycle?: PrivacyLifecycleConfig;
  privacyOperations?: PrivacyLifecycleOperations;
  workflowJobSummary?: WorkflowJobSummary;
  providers: ProviderReadiness[];
  connectors: ConnectorReadinessSummary;
  workflowMode: string;
  operations: {
    backup: OperationsReadiness;
    migrations: OperationsReadiness;
    traceStore: OperationsReadiness;
    evalRunner: OperationsReadiness;
    auditIntegrity: OperationsReadiness;
  };
};

function hasValue(env: RuntimeEnv, name: string) {
  return Boolean(env[name]?.trim());
}

function isEnabled(env: RuntimeEnv, name: string) {
  return env[name] === "true";
}

function evalScheduleEvidence(plan?: EvalSchedulePlan) {
  if (!plan) return "tenant eval schedule not loaded";
  return `schedule ${plan.healthyCount} healthy / ${plan.dueCount} due / ${plan.blockedCount} blocked`;
}

function workflowJobEvidence(summary?: WorkflowJobSummary) {
  if (!summary) return "tenant workflow jobs not loaded";
  return `jobs ${summary.total} total / ${summary.active} active / ${summary.failed} failed / ${summary.staleActive} stale active`;
}

function contextReadinessEvidence(summary?: ContextReadinessSummary) {
  if (!summary) return "context readiness not loaded";
  return `context ${summary.indexedDocuments} indexed document(s) / ${summary.totalDocuments} total record(s) / ${summary.enabledSources} enabled source(s) / ${summary.staleSources} stale / ${summary.unindexedEnabledSources} unindexed / ${summary.automatedDocuments} automated / ${summary.failedDocuments} failed / ${summary.quarantinedDocuments} quarantined`;
}

function connectorEventEvidence(summary?: ConnectorEventSummary) {
  if (!summary) return "connector execution evidence not loaded";
  return `connector events ${summary.total} total / ${summary.executed} executed / ${summary.requiresApproval} approval-gated / ${summary.blocked} blocked / ${summary.envelopeCount} enveloped / ${summary.missingEnvelopeCount} legacy / ${summary.redactedPayloadCount} redacted`;
}

function harnessTraceEvidence(summary?: HarnessTraceSummary) {
  if (!summary) return "Harness trace evidence not loaded";
  return `Harness traces ${summary.total} total / ${summary.completed} completed / ${summary.waitingForApproval} approval-gated / ${summary.failed} failed / ${summary.promptQualityUnsafe} unsafe prompt(s) / ${summary.promptQualityAverage} average quality`;
}

function privacyOperationsEvidence(operations?: PrivacyLifecycleOperations) {
  if (!operations) return "privacy operations not loaded";
  return `privacy ops ${operations.requestCount} request(s) / ${operations.blockedCount} blocked / ${operations.exportCount} export(s) / ${operations.retentionSweepCount} retention sweep(s)`;
}

function domain(input: Omit<CustomerLaunchDomain, "score" | "status"> & {
  ready: boolean;
  blocked?: boolean;
  partialScore?: number;
}): CustomerLaunchDomain {
  const status: LaunchDomainStatus = input.blocked ? "blocked" : input.ready ? "ready" : "needs-work";
  const score = input.ready ? 100 : input.blocked ? Math.min(input.partialScore ?? 20, 49) : input.partialScore ?? 60;
  return {
    id: input.id,
    label: input.label,
    owner: input.owner,
    status,
    score,
    summary: input.summary,
    evidence: input.evidence,
    nextAction: input.nextAction,
    env: input.env,
  };
}

export function deriveCustomerLaunchContract(input: ContractInput): CustomerLaunchContract {
  const env = input.env ?? process.env;
  const production = env.NODE_ENV === "production";
  const externalProviders = input.providers.filter((provider) => provider.id !== "local" && provider.configured);
  const envBudgetConfigured =
    hasValue(env, "TENANT_MONTHLY_BUDGET_USD") ||
    hasValue(env, "MODEL_BUDGET_USD") ||
    isEnabled(env, "MODEL_BUDGET_ENFORCEMENT_ENABLED");
  const budgetConfigured = input.modelBudgetConfigured ?? envBudgetConfigured;
  const envContextIngestionConfigured =
    hasValue(env, "VECTOR_STORE_URL") ||
    hasValue(env, "CONTEXT_INDEX_JOB_URL") ||
    hasValue(env, "CONTEXT_SYNC_WORKER_URL") ||
    isEnabled(env, "CONTEXT_SYNC_ENABLED") ||
    isEnabled(env, "ALLOW_MANUAL_CONTEXT_INDEXING_IN_PRODUCTION");
  const contextIngestionConfigured = input.contextIngestionConfigured ?? envContextIngestionConfigured;
  const contextSourcesNeedAttention =
    (input.contextReadiness?.staleSources ?? 0) > 0 ||
    (input.contextReadiness?.attentionSources ?? 0) > 0 ||
    (input.contextReadiness?.unindexedEnabledSources ?? 0) > 0 ||
    (input.contextReadiness?.failedDocuments ?? 0) > 0 ||
    (input.contextReadiness?.quarantinedDocuments ?? 0) > 0;
  const contextHasIndexedDocuments = (input.contextReadiness?.indexedDocuments ?? 0) > 0;
  const contextHasAutomationEvidence = envContextIngestionConfigured || (input.contextReadiness?.automatedDocuments ?? 0) > 0;
  const contextManualOnly =
    contextHasIndexedDocuments &&
    !contextHasAutomationEvidence &&
    (input.contextReadiness?.manualDocuments ?? 0) >= (input.contextReadiness?.indexedDocuments ?? 0);
  const evalCadence = input.evalCadence ?? evalCadenceConfigFromEnv(env);
  const evalScheduleBlocked = (input.evalSchedulePlan?.blockedCount ?? 0) > 0;
  const observability = input.observability ?? observabilityConfigFromEnv(env);
  const privacyLifecycle = input.privacyLifecycle ?? privacyLifecycleConfigFromEnv(env);
  const blockedPrivacyRequests = input.privacyOperations?.blockedCount ?? 0;
  const failedWorkflowJobs = input.workflowJobSummary?.failed ?? 0;
  const staleWorkflowJobs = input.workflowJobSummary?.staleActive ?? 0;
  const workflowJobsHealthy = failedWorkflowJobs === 0 && staleWorkflowJobs === 0;
  const connectorExecutionEvidenceReady =
    (input.connectorEventSummary?.executed ?? 0) > 0 &&
    (input.connectorEventSummary?.blocked ?? 0) === 0 &&
    (input.connectorEventSummary?.missingEnvelopeCount ?? 0) === 0;
  const harnessTraceEvidenceReady =
    (input.harnessTraceSummary?.total ?? 0) > 0 &&
    (input.harnessTraceSummary?.completed ?? 0) > 0 &&
    (input.harnessTraceSummary?.failed ?? 0) === 0 &&
    (input.harnessTraceSummary?.promptQualityUnsafe ?? 0) === 0;
  const connectorEvidenceNextAction =
    (input.connectorEventSummary?.total ?? 0) === 0
      ? "Execute one governed connector path, preserve the execution envelope, and attach the result to the proof packet."
      : (input.connectorEventSummary?.missingEnvelopeCount ?? 0) > 0
        ? "Migrate or rerun legacy connector events so every launch-relevant execution has a signed envelope and redacted payload preview."
        : (input.connectorEventSummary?.blocked ?? 0) > 0
          ? "Resolve blocked connector executions and rerun the governed connector path before launch."
          : "Connect the first customer systems, test read/write gates, and keep connector execution evidence current.";
  const harnessEvidenceNextAction =
    (input.harnessTraceSummary?.total ?? 0) === 0
      ? "Run one governed Skill through the Harness and attach the trace evidence before launch promotion."
      : (input.harnessTraceSummary?.failed ?? 0) > 0 || (input.harnessTraceSummary?.promptQualityUnsafe ?? 0) > 0
        ? "Resolve failed Harness traces or unsafe prompt contracts, then rerun the governed Skill before launch promotion."
        : "Complete backup/restore drill and verify the audit chain after first tenant mutation.";

  const domains: CustomerLaunchDomain[] = [
    domain({
      id: "identity",
      label: "Identity, SSO, and user lifecycle",
      owner: "Identity",
      ready: input.auth.authRequired && input.auth.oidcConfigured && input.provisioningConfigured,
      blocked: production && (!input.auth.authRequired || !input.auth.oidcConfigured),
      partialScore: input.auth.authRequired ? 68 : 45,
      summary: "Every user, reviewer, builder, and executive should arrive through enterprise identity with lifecycle sync.",
      evidence: [
        input.auth.authRequired ? "auth required" : "local auth fallback",
        input.auth.oidcConfigured ? "OIDC configured" : "OIDC missing",
        input.provisioningConfigured ? "provisioning token configured" : "manual roster",
      ],
      nextAction: input.auth.oidcConfigured
        ? "Wire SCIM or provisioning token for joiner, mover, and leaver lifecycle."
        : "Configure OIDC SSO and map role claims before inviting customer users.",
      env: ["AUTH_REQUIRED", "OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "PROVISIONING_API_TOKEN"],
    }),
    domain({
      id: "tenant-data",
      label: "Tenant isolation, persistence, and secrets",
      owner: "Data",
      ready: input.database.durable && input.secretVault.encrypted && input.apiProtection.configured,
      blocked: production && (!input.database.durable || !input.secretVault.configured || !input.apiProtection.configured),
      partialScore: input.database.configured ? 72 : 40,
      summary: "Customer data needs durable Postgres, encrypted tenant secrets, API origin controls, and non-demo startup.",
      evidence: [
        input.database.durable ? "durable database" : "file/local persistence",
        input.secretVault.encrypted ? "encrypted tenant vault" : input.secretVault.mode,
        input.apiProtection.configured ? "API protection configured" : "API protection missing",
      ],
      nextAction: "Provision Postgres, run migrations, set TENANT_SECRET_KEY, and restrict API origins.",
      env: ["DATABASE_URL", "DB_MIGRATIONS_APPLIED", "TENANT_SECRET_KEY", "API_TRUSTED_ORIGINS"],
    }),
    domain({
      id: "model-ops",
      label: "Model routing, keys, and spend controls",
      owner: "AI",
      ready: externalProviders.length > 0 && budgetConfigured,
      blocked: production && externalProviders.length === 0,
      partialScore: externalProviders.length ? 72 : 35,
      summary: "Production needs at least one external model provider plus budget guardrails per tenant.",
      evidence: [
        externalProviders.length ? `${externalProviders.length} external provider(s)` : "local deterministic runtime only",
        budgetConfigured ? "budget control configured" : "budget control missing",
      ],
      nextAction: budgetConfigured
        ? "Run provider failover and model-lane smoke tests."
        : "Set a tenant model budget and enforce spend/latency limits before broad launch.",
      env: ["OPENAI_API_KEY", "OPENROUTER_API_KEY", "TENANT_MONTHLY_BUDGET_USD", "MODEL_BUDGET_ENFORCEMENT_ENABLED"],
    }),
    domain({
      id: "connector-activation",
      label: "Connector activation and MCP broker",
      owner: "Integrations",
      ready: input.connectors.productionReady && connectorExecutionEvidenceReady,
      blocked: production && !input.connectors.productionReady,
      partialScore: input.connectors.productionReady
        ? connectorExecutionEvidenceReady
          ? 100
          : 74
        : input.connectors.readyCount
          ? 70
          : input.connectors.partialCount
            ? 52
            : 25,
      summary: "Tool execution should go through the MCP/connector broker or native adapters with least-privilege secrets.",
      evidence: [
        input.connectors.brokerMode,
        `${input.connectors.readyCount}/${input.connectors.requiredCount} connector families ready or broker-managed`,
        connectorEventEvidence(input.connectorEventSummary),
      ],
      nextAction: input.connectors.productionReady
        ? connectorEvidenceNextAction
        : "Connect the first customer systems, test read/write gates, and capture connector evidence.",
      env: ["MCP_BROKER_URL", "CONNECTOR_BROKER_TOKEN", "SLACK_BOT_TOKEN", "MS_GRAPH_CLIENT_ID", "JIRA_API_TOKEN"],
    }),
    domain({
      id: "context-ingestion",
      label: "Context ingestion and permission-aware retrieval",
      owner: "Data",
      ready: contextIngestionConfigured && contextHasAutomationEvidence && !contextSourcesNeedAttention && !contextManualOnly,
      partialScore: contextSourcesNeedAttention ? 62 : contextManualOnly ? 68 : 55,
      summary: "The OS needs scheduled source indexing from approved knowledge systems with owner, classification, and permission metadata.",
      evidence: [
        contextHasAutomationEvidence
          ? "automated context ingestion evidence"
          : contextIngestionConfigured
            ? "manual context ingestion evidence"
            : "manual/local context indexing only",
        contextReadinessEvidence(input.contextReadiness),
      ],
      nextAction: contextSourcesNeedAttention
        ? "Refresh stale sources, resolve failed or quarantined context records, index enabled catalog sources, and rerun retrieval tests before promotion."
        : contextManualOnly
          ? "Configure a context sync worker, connector sync, vector store, or explicitly approve manual indexing for this launch."
        : "Configure a context sync worker or vector store, then index one approved source per pilot function.",
      env: ["VECTOR_STORE_URL", "CONTEXT_INDEX_JOB_URL", "CONTEXT_SYNC_ENABLED"],
    }),
    domain({
      id: "workflow-runtime",
      label: "Durable workflow execution",
      owner: "Platform",
      ready: input.workflowMode !== "local-job-ledger" && workflowJobsHealthy,
      blocked: production && input.workflowMode === "local-job-ledger",
      partialScore: input.workflowMode === "local-job-ledger" ? 48 : failedWorkflowJobs ? 58 : staleWorkflowJobs ? 62 : 48,
      summary: "Agentic workflows need retries, resumability, worker ownership, and failure recovery.",
      evidence: [input.workflowMode, workflowJobEvidence(input.workflowJobSummary)],
      nextAction:
        input.workflowMode === "local-job-ledger"
          ? "Provision Temporal or an external workflow engine and run a publish/test/resume smoke."
          : failedWorkflowJobs
            ? "Investigate failed workflow jobs and rerun a publish/test/resume smoke before promotion."
            : staleWorkflowJobs
              ? "Investigate stale active workflow jobs and rerun a publish/test/resume smoke before promotion."
              : "Keep workflow workers monitored and rerun the publish/test/resume smoke before promotion.",
      env: ["TEMPORAL_ADDRESS", "WORKFLOW_ENGINE_URL"],
    }),
    domain({
      id: "continuous-evals",
      label: "Continuous evals and drift detection",
      owner: "AI",
      ready: input.operations.evalRunner.configured && evalCadence.configured && !evalScheduleBlocked,
      partialScore: evalScheduleBlocked ? 58 : input.operations.evalRunner.configured ? 72 : 42,
      summary: "Launch evals are not enough; prompts, context, tools, and models need recurring regression and red-team checks.",
      evidence: [
        input.operations.evalRunner.reason,
        evalCadence.configured ? `${evalCadence.mode} configured` : evalCadence.reason,
        evalScheduleEvidence(input.evalSchedulePlan),
      ],
      nextAction: evalScheduleBlocked
        ? "Resolve blocked eval suites before any pilot or production promotion."
        : evalCadence.configured
          ? "Keep scheduled eval cadence active and review due suites before promotion."
          : "Enable scheduled eval cadence and block promotion when critical evals fail.",
      env: ["EVAL_RUNNER_URL", "EVAL_SCHEDULE_ENABLED", "EVAL_SCHEDULE_CRON"],
    }),
    domain({
      id: "evidence-ops",
      label: "Evidence, audit integrity, and recovery",
      owner: "Operations",
      ready:
        input.operations.traceStore.configured &&
        input.operations.auditIntegrity.configured &&
        input.operations.backup.configured &&
        input.operations.migrations.configured &&
        harnessTraceEvidenceReady,
      blocked: production && (!input.operations.traceStore.configured || !input.operations.auditIntegrity.configured),
      partialScore: input.operations.traceStore.configured
        ? harnessTraceEvidenceReady
          ? 82
          : 68
        : 45,
      summary: "Every executive claim should be backed by traces, evals, governance approvals, audit chain, and restore evidence.",
      evidence: [
        input.operations.traceStore.reason,
        harnessTraceEvidence(input.harnessTraceSummary),
        input.operations.auditIntegrity.reason,
        input.operations.backup.reason,
      ],
      nextAction: harnessEvidenceNextAction,
      env: ["DATABASE_BACKUP_URL", "DATABASE_RESTORE_DRILL_AT", "AUDIT_INTEGRITY_ENABLED"],
    }),
    domain({
      id: "observability",
      label: "Observability and incident response",
      owner: "Platform",
      ready: observability.configured,
      partialScore: 50,
      summary: "Production operators need app metrics, errors, logs, traces, uptime checks, and incident owners.",
      evidence: [
        `${observability.mode}`,
        observability.sinks.length ? `sinks ${observability.sinks.join(", ")}` : "no external sinks",
        observability.reason,
      ],
      nextAction: observability.configured
        ? "Send a synthetic operational event through the configured sink and document the incident owner."
        : "Configure OTEL/Sentry/log drain and define incident escalation ownership.",
      env: ["OTEL_EXPORTER_OTLP_ENDPOINT", "SENTRY_DSN", "LOG_DRAIN_URL"],
    }),
    domain({
      id: "privacy-lifecycle",
      label: "Privacy, retention, and data subject workflow",
      owner: "Privacy",
      ready: privacyLifecycle.configured && blockedPrivacyRequests === 0,
      partialScore: blockedPrivacyRequests ? 48 : 52,
      summary: "Customers need retention controls, privacy export/delete workflows, and documented work-signal boundaries.",
      evidence: [
        `retention ${privacyLifecycle.retentionDays} days`,
        privacyLifecycle.configured ? `${privacyLifecycle.mode} configured` : "privacy workflow missing",
        privacyLifecycle.reason,
        privacyOperationsEvidence(input.privacyOperations),
      ],
      nextAction:
        blockedPrivacyRequests > 0
          ? "Resolve blocked privacy requests and rerun export/delete/review receipt smoke before inviting customer privacy reviewers."
          : privacyLifecycle.configured
            ? "Run a privacy export and DSR receipt smoke before inviting customer privacy reviewers."
            : "Set retention policy and connect privacy request workflow before broad rollout.",
      env: ["DATA_RETENTION_DAYS", "PRIVACY_EXPORT_ENABLED", "PRIVACY_REQUEST_WORKFLOW_URL"],
    }),
  ];

  const readyCount = domains.filter((item) => item.status === "ready").length;
  const blockedCount = domains.filter((item) => item.status === "blocked").length;
  const needsWorkCount = domains.filter((item) => item.status === "needs-work").length;
  const score = Math.round(domains.reduce((sum, item) => sum + item.score, 0) / Math.max(domains.length, 1));
  const status: LaunchDomainStatus = blockedCount ? "blocked" : score >= 85 && needsWorkCount === 0 ? "ready" : "needs-work";

  return {
    status,
    score,
    readyCount,
    needsWorkCount,
    blockedCount,
    domains,
    nextActions: domains
      .filter((item) => item.status !== "ready")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "blocked" ? -1 : 1;
        return a.score - b.score;
      })
      .slice(0, 5),
  };
}
