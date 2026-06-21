import { authReadiness } from "./auth-readiness.ts";
import { connectorEvidenceFreshness, type ConnectorEventSummary } from "./connector-events.ts";
import { deriveContextReadinessSummary, type ContextIndexStats, type ContextReadinessSummary } from "./context-index.ts";
import { deriveCustomerLaunchContract } from "./customer-launch-contract.ts";
import { getDatabaseReadiness } from "./database.ts";
import { getEnterpriseConnectorReadiness } from "./enterprise-connectors.ts";
import { evalCadenceConfigFromEnv, type EvalCadenceConfig, type EvalSchedulePlan } from "./eval-scheduler.ts";
import type { AIProviderSettings } from "./model-router.ts";
import { observabilityConfigFromEnv, type ObservabilityConfig } from "./observability.ts";
import {
  privacyLifecycleConfigFromEnv,
  type PrivacyLifecycleConfig,
  type PrivacyLifecycleOperations,
} from "./privacy-lifecycle.ts";
import { getProviderReadiness } from "./provider-registry.ts";
import { buildLaunchManualActions, launchManualActionsMarkdown } from "./launch-manifest.ts";
import type { BackupDrillOperations } from "./database-ops.ts";
import type { TenantSecretEvidence } from "./tenant-secret-evidence.ts";
import {
  auditIntegrityReadinessFromEnv,
  backupReadinessFromEnv,
  evalRunnerReadinessFromEnv,
  migrationReadinessFromEnv,
  traceStoreReadinessFromEnv,
  type OperationsReadiness,
} from "./production-ops-readiness.ts";
import { apiProtectionReadinessFromEnv } from "./runtime-readiness-policy.ts";
import { configuredRuntimeHttpOrPostgresUrl, configuredRuntimeHttpUrl } from "./runtime-url-config.ts";
import { tenantProvisioningReadinessFromEnv, type TenantProvisioningReadiness } from "./tenant-provisioning-readiness.ts";
import { getSecretVaultReadiness } from "./tenant-secret-vault.ts";
import { harnessTraceFreshness, type HarnessTraceSummary } from "./trace-store.ts";
import type { WorkflowJobReconciliationPlan, WorkflowJobSummary } from "./workflow-jobs.ts";

export type ReadinessStatus = "pass" | "warn" | "fail";

export type ReadinessCheck = {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
};

function check(id: string, label: string, status: ReadinessStatus, detail: string): ReadinessCheck {
  return { id, label, status, detail };
}

function productionStrict() {
  return process.env.NODE_ENV === "production";
}

function productionOverrideEnabled(name: string) {
  return process.env[name] === "true";
}

function hasValue(name: string) {
  return Boolean(process.env[name]?.trim());
}

export type ProductionReadinessOptions = {
  configuredSecretNames?: string[];
  secretEvidence?: TenantSecretEvidence;
  auditIntegrity?: OperationsReadiness;
  aiSettings?: Partial<AIProviderSettings>;
  backupDrillOperations?: BackupDrillOperations;
  connectorEventSummary?: ConnectorEventSummary;
  contextIndexStats?: ContextIndexStats;
  contextReadiness?: ContextReadinessSummary;
  evalCadence?: EvalCadenceConfig;
  evalSchedulePlan?: EvalSchedulePlan;
  harnessTraceSummary?: HarnessTraceSummary;
  observability?: ObservabilityConfig;
  privacyLifecycle?: PrivacyLifecycleConfig;
  privacyOperations?: PrivacyLifecycleOperations;
  tenantProvisioning?: TenantProvisioningReadiness;
  workflowReconciliationPlan?: WorkflowJobReconciliationPlan;
  workflowJobSummary?: WorkflowJobSummary;
};

function positiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function evalScheduleSummary(plan?: EvalSchedulePlan) {
  if (!plan) return "No tenant eval schedule was loaded.";
  return `Tenant eval schedule: ${plan.healthyCount.toLocaleString("en-US")} healthy, ${plan.dueCount.toLocaleString("en-US")} due, ${plan.blockedCount.toLocaleString("en-US")} blocked on a ${plan.cadenceDays.toLocaleString("en-US")}-day cadence.`;
}

function backupDrillOperationsSummary(operations?: BackupDrillOperations) {
  if (!operations) return "";
  const latest = operations.latestAt ? ` Latest drill: ${operations.latestAt}.` : "";
  const status = operations.latestStatus ? ` Latest status: ${operations.latestStatus}.` : "";
  return `Tenant backup drill evidence: ${operations.drillCount.toLocaleString("en-US")} verified drill(s).${status}${latest}`;
}

function workflowJobSummaryText(summary?: WorkflowJobSummary) {
  if (!summary) return "No tenant workflow job ledger was loaded.";
  const latest = summary.latestUpdatedAt ? ` Latest update: ${summary.latestUpdatedAt}.` : "";
  const oldestActive = summary.oldestActiveAt ? ` Oldest active update: ${summary.oldestActiveAt}.` : "";
  return `Tenant workflow jobs: ${summary.total.toLocaleString("en-US")} total, ${summary.completed.toLocaleString("en-US")} completed, ${summary.active.toLocaleString("en-US")} active (${summary.queued.toLocaleString("en-US")} queued, ${summary.running.toLocaleString("en-US")} running, ${summary.waitingForApproval.toLocaleString("en-US")} waiting for approval), ${summary.failed.toLocaleString("en-US")} failed, ${summary.cancelled.toLocaleString("en-US")} cancelled, ${summary.staleActive.toLocaleString("en-US")} stale active after ${summary.staleAfterMinutes.toLocaleString("en-US")} minute(s).${oldestActive}${latest}`;
}

function workflowReconciliationSummaryText(plan?: WorkflowJobReconciliationPlan) {
  if (!plan) return "No stale job reconciliation preview was loaded.";
  if (plan.selected === 0) return "Stale job reconciliation preview: no eligible stale jobs.";
  return `Stale job reconciliation preview: ${plan.plannedCancels.toLocaleString("en-US")} queued cancellation(s), ${plan.plannedFailures.toLocaleString("en-US")} running failure(s), and ${plan.approvalEscalations.toLocaleString("en-US")} approval escalation(s) across ${plan.selected.toLocaleString("en-US")} job(s).`;
}

function privacyOperationsSummary(operations?: PrivacyLifecycleOperations) {
  if (!operations) return "No tenant privacy operation evidence was loaded.";
  const latest = operations.latestAt ? ` Latest privacy operation: ${operations.latestAt}.` : "";
  return `Tenant privacy operations: ${operations.requestCount.toLocaleString("en-US")} request(s), ${operations.acceptedCount.toLocaleString("en-US")} accepted, ${operations.forwardedCount.toLocaleString("en-US")} forwarded, ${operations.blockedCount.toLocaleString("en-US")} blocked, ${operations.exportCount.toLocaleString("en-US")} export(s), ${operations.retentionSweepCount.toLocaleString("en-US")} retention sweep(s).${latest}`;
}

function contextReadinessSummaryText(summary?: ContextReadinessSummary) {
  if (!summary) return "No tenant context index evidence was loaded.";
  const latest = summary.latestIndexedAt ? ` Latest indexed update: ${summary.latestIndexedAt}.` : "";
  return `Tenant context evidence: ${summary.indexedDocuments.toLocaleString("en-US")} indexed document(s), ${summary.totalDocuments.toLocaleString("en-US")} total record(s), ${summary.indexedSources.toLocaleString("en-US")} indexed source(s), ${summary.enabledSources.toLocaleString("en-US")} enabled catalog source(s), ${summary.healthySources.toLocaleString("en-US")} healthy, ${summary.attentionSources.toLocaleString("en-US")} needing attention, ${summary.staleSources.toLocaleString("en-US")} stale after ${summary.staleAfterDays.toLocaleString("en-US")} day(s), ${summary.unindexedEnabledSources.toLocaleString("en-US")} enabled source(s) without indexed documents, ${summary.automatedDocuments.toLocaleString("en-US")} automated ingestion record(s), ${summary.manualDocuments.toLocaleString("en-US")} manual record(s), ${summary.failedDocuments.toLocaleString("en-US")} failed, ${summary.quarantinedDocuments.toLocaleString("en-US")} quarantined.${latest}`;
}

function connectorEventSummaryText(summary?: ConnectorEventSummary) {
  if (!summary) return "No tenant connector event ledger was loaded.";
  const latest = summary.latestAt ? ` Latest connector event: ${summary.latestAt}.` : "";
  return `Tenant connector evidence: ${summary.total.toLocaleString("en-US")} event(s), ${summary.executed.toLocaleString("en-US")} executed, ${summary.simulated.toLocaleString("en-US")} policy rehearsal(s), ${summary.requiresApproval.toLocaleString("en-US")} approval-gated, ${summary.blocked.toLocaleString("en-US")} blocked, ${summary.envelopeCount.toLocaleString("en-US")} with execution envelopes, ${summary.redactedPayloadCount.toLocaleString("en-US")} with redacted payload previews, ${summary.missingEnvelopeCount.toLocaleString("en-US")} legacy event(s) without envelopes.${latest}`;
}

function connectorEvidenceRefreshAction(summary?: ConnectorEventSummary) {
  const freshness = connectorEvidenceFreshness(summary);
  return freshness.fresh
    ? freshness.reason
    : `${freshness.reason} Rerun one governed connector path and preserve the execution envelope before launch promotion.`;
}

function harnessTraceSummaryText(summary?: HarnessTraceSummary) {
  if (!summary) return "No tenant Harness trace evidence was loaded.";
  const latest = summary.latestAt ? ` Latest trace: ${summary.latestAt}.` : "";
  return `Tenant Harness evidence: ${summary.total.toLocaleString("en-US")} trace(s), ${summary.completed.toLocaleString("en-US")} completed, ${summary.waitingForApproval.toLocaleString("en-US")} approval-gated, ${summary.blocked.toLocaleString("en-US")} blocked, ${summary.failed.toLocaleString("en-US")} failed, ${summary.policyBlocked.toLocaleString("en-US")} policy-blocked, ${summary.approvalGated.toLocaleString("en-US")} policy approval gate(s), ${summary.promptQualityUnsafe.toLocaleString("en-US")} unsafe prompt contract(s), average prompt quality ${summary.promptQualityAverage.toLocaleString("en-US")}/100.${latest}`;
}

function harnessTraceRefreshAction(summary?: HarnessTraceSummary) {
  const freshness = harnessTraceFreshness(summary);
  if ((summary?.total ?? 0) === 0) {
    return "Run at least one governed Skill through the Harness before launch promotion.";
  }
  if ((summary?.failed ?? 0) > 0 || (summary?.promptQualityUnsafe ?? 0) > 0) {
    return `${freshness.reason} Resolve unsafe prompt quality or failed trace evidence, then rerun one governed Skill through the Harness before launch promotion.`;
  }
  return freshness.fresh
    ? freshness.reason
    : `${freshness.reason} Rerun one governed Skill through the Harness before launch promotion.`;
}

export function getProductionReadiness(options: ProductionReadinessOptions = {}) {
  const auth = authReadiness();
  const database = getDatabaseReadiness();
  const secretVault = getSecretVaultReadiness();
  const runtimeSecretNames = options.secretEvidence?.tenantVaultNamesApplied === false
    ? []
    : options.configuredSecretNames ?? [];
  const providers = getProviderReadiness(process.env, runtimeSecretNames);
  const tenantProvisioning = options.tenantProvisioning ?? tenantProvisioningReadinessFromEnv(process.env);
  const apiProtection = apiProtectionReadinessFromEnv();
  const connectorReadiness = getEnterpriseConnectorReadiness(process.env, runtimeSecretNames);
  const backupBase = backupReadinessFromEnv();
  const backupDrillEvidence = backupDrillOperationsSummary(options.backupDrillOperations);
  const backup = backupDrillEvidence
    ? {
        ...backupBase,
        reason: `${backupBase.reason} ${backupDrillEvidence}`,
        evidence: [...backupBase.evidence, backupDrillEvidence],
      }
    : backupBase;
  const migrations = migrationReadinessFromEnv();
  const traceStore = traceStoreReadinessFromEnv();
  const evalRunner = evalRunnerReadinessFromEnv();
  const auditIntegrity = options.auditIntegrity ?? auditIntegrityReadinessFromEnv();
  const evalCadence = options.evalCadence ?? evalCadenceConfigFromEnv(process.env);
  const observability = options.observability ?? observabilityConfigFromEnv(process.env);
  const privacyLifecycle = options.privacyLifecycle ?? privacyLifecycleConfigFromEnv(process.env);
  const privacyOperations = options.privacyOperations;
  const connectorEventSummary = options.connectorEventSummary;
  const harnessTraceSummary = options.harnessTraceSummary;
  const contextReadiness = options.contextReadiness ?? deriveContextReadinessSummary({ stats: options.contextIndexStats });
  const workflowJobSummary = options.workflowJobSummary;
  const configuredExternalProviders = providers.filter((provider) => provider.id !== "local" && provider.configured);
  const connectorMode = connectorReadiness.brokerMode;
  const connectorBrokerAuthMissing =
    connectorReadiness.brokerUrlConfigured && !connectorReadiness.brokerAuthenticated;
  const workflowMode = process.env.TEMPORAL_ADDRESS
    ? "temporal-ready"
    : configuredRuntimeHttpUrl(process.env, "WORKFLOW_ENGINE_URL")
      ? "external-engine-ready"
      : "local-job-ledger";
  const externalProvidersRequired =
    productionStrict() && !productionOverrideEnabled("ALLOW_LOCAL_MODEL_RUNTIME_IN_PRODUCTION");
  const connectorBrokerRequired =
    productionStrict() && !productionOverrideEnabled("ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION");
  const connectorEvidenceRequired =
    productionStrict() && !productionOverrideEnabled("ALLOW_UNVERIFIED_CONNECTOR_EVIDENCE_IN_PRODUCTION");
  const harnessTraceEvidenceRequired =
    productionStrict() && !productionOverrideEnabled("ALLOW_UNVERIFIED_HARNESS_TRACE_IN_PRODUCTION");
  const workflowEngineRequired =
    productionStrict() && !productionOverrideEnabled("ALLOW_LOCAL_WORKFLOW_ENGINE_IN_PRODUCTION");
  const provisioningConfigured = Boolean(process.env.PROVISIONING_API_TOKEN || process.env.SCIM_BEARER_TOKEN);
  const provisioningRequired =
    productionStrict() && !productionOverrideEnabled("ALLOW_MANUAL_USER_PROVISIONING_IN_PRODUCTION");
  const tenantMonthlyBudgetUsd = positiveNumber(options.aiSettings?.monthlyBudgetUsd);
  const envModelBudgetConfigured =
    hasValue("TENANT_MONTHLY_BUDGET_USD") ||
    hasValue("MODEL_BUDGET_USD") ||
    productionOverrideEnabled("MODEL_BUDGET_ENFORCEMENT_ENABLED");
  const modelBudgetConfigured =
    envModelBudgetConfigured ||
    Boolean(tenantMonthlyBudgetUsd);
  const indexedContextSourceCount = contextReadiness.indexedSources;
  const indexedContextDocumentCount = contextReadiness.indexedDocuments;
  const tenantContextIndexConfigured = indexedContextDocumentCount > 0;
  const envContextIngestionConfigured =
    Boolean(configuredRuntimeHttpOrPostgresUrl(process.env, "VECTOR_STORE_URL")) ||
    Boolean(configuredRuntimeHttpUrl(process.env, "CONTEXT_INDEX_JOB_URL")) ||
    Boolean(configuredRuntimeHttpUrl(process.env, "CONTEXT_SYNC_WORKER_URL")) ||
    productionOverrideEnabled("CONTEXT_SYNC_ENABLED") ||
    productionOverrideEnabled("ALLOW_MANUAL_CONTEXT_INDEXING_IN_PRODUCTION");
  const contextIngestionConfigured =
    envContextIngestionConfigured ||
    tenantContextIndexConfigured;
  const contextSourcesNeedAttention =
    contextReadiness.staleSources > 0 ||
    contextReadiness.attentionSources > 0 ||
    contextReadiness.unindexedEnabledSources > 0 ||
    contextReadiness.failedDocuments > 0 ||
    contextReadiness.quarantinedDocuments > 0;
  const manualOnlyContextIndex =
    tenantContextIndexConfigured &&
    !envContextIngestionConfigured &&
    contextReadiness.automatedDocuments === 0;
  const contextIngestionReady = contextIngestionConfigured && !contextSourcesNeedAttention && !manualOnlyContextIndex;
  const connectorEvidenceReady =
    (connectorEventSummary?.executed ?? 0) > 0 &&
    (connectorEventSummary?.blocked ?? 0) === 0 &&
    (connectorEventSummary?.missingEnvelopeCount ?? 0) === 0 &&
    connectorEvidenceFreshness(connectorEventSummary).fresh;
  const harnessTraceEvidenceReady =
    (harnessTraceSummary?.total ?? 0) > 0 &&
    (harnessTraceSummary?.failed ?? 0) === 0 &&
    (harnessTraceSummary?.promptQualityUnsafe ?? 0) === 0 &&
    harnessTraceFreshness(harnessTraceSummary).fresh;
  const evalScheduleBlocked = (options.evalSchedulePlan?.blockedCount ?? 0) > 0;
  const continuousEvalsReady = evalRunner.configured && evalCadence.configured && !evalScheduleBlocked;
  const failedWorkflowJobs = workflowJobSummary?.failed ?? 0;
  const staleWorkflowJobs = workflowJobSummary?.staleActive ?? 0;
  const workflowJobsHealthy = failedWorkflowJobs === 0 && staleWorkflowJobs === 0;
  const workflowJobEvidence = `${workflowJobSummaryText(workflowJobSummary)}${
    staleWorkflowJobs > 0 ? ` ${workflowReconciliationSummaryText(options.workflowReconciliationPlan)}` : ""
  }`;
  const blockedPrivacyRequests = privacyOperations?.blockedCount ?? 0;
  const privacyLifecycleReady = privacyLifecycle.configured && blockedPrivacyRequests === 0;
  const workflowJobNextAction =
    failedWorkflowJobs > 0
      ? "Investigate failed workflow jobs before launch promotion."
      : staleWorkflowJobs > 0
        ? "Investigate stale active workflow jobs before launch promotion."
        : "";
  const authEnforcementIssue = auth.issues.find(
    (issue) => issue.includes("AUTH_REQUIRED") || issue.includes("LOCAL_LOGIN_ENABLED"),
  );
  const checks: ReadinessCheck[] = [
    check(
      "auth-required",
      "Authentication enforcement",
      authEnforcementIssue ? "fail" : auth.authRequired ? "pass" : "warn",
      authEnforcementIssue ?? (auth.authRequired ? "AUTH_REQUIRED is enabled." : "Local development auth mode is active."),
    ),
    check(
      "auth-secret",
      "Session signing secret",
      auth.issues.some((issue) => issue.includes("AUTH_SECRET")) ? "fail" : "pass",
      auth.issues.find((issue) => issue.includes("AUTH_SECRET")) ?? "A session signing secret is available.",
    ),
    check(
      "sso",
      "OIDC SSO",
      auth.oidcConfigured ? "pass" : auth.authRequired ? "fail" : "warn",
      auth.oidcConfigured ? "OIDC issuer/client credentials are configured." : "OIDC is not configured.",
    ),
    check(
      "user-provisioning",
      "User provisioning lifecycle",
      provisioningConfigured ? "pass" : provisioningRequired ? "fail" : "warn",
      provisioningConfigured
        ? "SCIM-compatible provisioning token is configured for tenant user lifecycle sync."
        : provisioningRequired
          ? "No provisioning token is configured. Set PROVISIONING_API_TOKEN or SCIM_BEARER_TOKEN, or explicitly set ALLOW_MANUAL_USER_PROVISIONING_IN_PRODUCTION=true for a manual private-beta roster."
          : "Provisioning token is not configured. Admin-managed users are available for private beta only.",
    ),
    check(
      "tenant-provisioning",
      "Self-serve tenant onboarding",
      tenantProvisioning.configured ? "pass" : process.env.NODE_ENV === "production" && tenantProvisioning.requested ? "fail" : "warn",
      tenantProvisioning.reason,
    ),
    check(
      "database",
      "Durable persistence",
      database.durable ? "pass" : database.configured ? "warn" : process.env.NODE_ENV === "production" ? "fail" : "warn",
      database.reason,
    ),
    check(
      "api-protection",
      "API origin, rate limit, and payload guard",
      apiProtection.configured
        ? process.env.NODE_ENV === "production" && !apiProtection.salted
          ? "warn"
          : "pass"
        : "fail",
      apiProtection.reason,
    ),
    check(
      "providers",
      "External model providers",
      configuredExternalProviders.length > 0 ? "pass" : externalProvidersRequired ? "fail" : "warn",
      configuredExternalProviders.length > 0
        ? `${configuredExternalProviders.length} external provider(s) are configured.`
        : externalProvidersRequired
          ? "No external model provider is configured. Set at least one provider key, or explicitly set ALLOW_LOCAL_MODEL_RUNTIME_IN_PRODUCTION=true for a non-customer local-runtime launch."
          : "Only deterministic local runtime is configured.",
    ),
    check(
      "model-cost-controls",
      "Model cost and latency guardrails",
      modelBudgetConfigured ? "pass" : "warn",
      modelBudgetConfigured
        ? tenantMonthlyBudgetUsd && !envModelBudgetConfigured
          ? `Tenant model budget controls are configured in workspace settings at ${formatUsd(tenantMonthlyBudgetUsd)} per month.`
          : "Tenant model budget controls are configured."
        : "Set TENANT_MONTHLY_BUDGET_USD or MODEL_BUDGET_ENFORCEMENT_ENABLED so production tenants cannot silently overspend.",
    ),
    check(
      "secret-vault",
      "Tenant secret vault",
      secretVault.configured ? (secretVault.mode === "development-fallback" ? "warn" : "pass") : "fail",
      secretVault.reason,
    ),
    ...(options.secretEvidence
      ? [
          check(
            "tenant-secret-evidence",
            "Tenant secret evidence",
            !options.secretEvidence.readable
              ? productionStrict()
                ? "fail"
                : "warn"
              : options.secretEvidence.unsupportedSecretNames.length > 0
                ? "fail"
              : !options.secretEvidence.usableForRuntime && options.secretEvidence.configuredSecretCount > 0
                ? "fail"
                : "pass",
            options.secretEvidence.warning ??
              (options.secretEvidence.tenantVaultNamesApplied
                ? `${options.secretEvidence.decryptableSecretCount.toLocaleString("en-US")}/${options.secretEvidence.configuredSecretCount.toLocaleString("en-US")} tenant vault secret value(s) are verified for runtime readiness checks.`
                : options.secretEvidence.configuredSecretCount > 0
                  ? `${options.secretEvidence.configuredSecretCount.toLocaleString("en-US")} tenant vault secret name(s) exist, but ${options.secretEvidence.undecryptableSecretCount.toLocaleString("en-US")} value(s) are not verified for runtime readiness.`
                  : "No tenant vault secret names are configured; readiness uses environment secrets and explicit setup state."),
          ),
        ]
      : []),
    check(
      "connectors",
      "Connector broker",
      connectorReadiness.productionReady ? "pass" : connectorBrokerRequired ? "fail" : "warn",
      connectorBrokerAuthMissing
        ? `Connector broker URL is configured in ${connectorMode} mode, but broker authentication is missing. Store ${connectorReadiness.brokerMissingSecretNames.join(" or ")} before enabling external execution.`
        : connectorMode === "policy-only" && !connectorReadiness.productionReady
          ? connectorBrokerRequired
            ? "Policy-only connector mode is active. Configure MCP_BROKER_URL or CONNECTOR_BROKER_URL, plus broker authentication, or explicitly set ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION=true for a non-automation launch."
            : "Policy-only connector mode is active. Configure MCP_BROKER_URL and broker authentication for real execution."
          : `Connector execution mode: ${connectorMode}; ${connectorReadiness.readyCount}/${connectorReadiness.requiredCount} enterprise connector families are ready or broker-managed.`,
    ),
    check(
      "connector-catalog",
      "Enterprise connector catalog",
      connectorReadiness.productionReady ? "pass" : connectorBrokerRequired ? "fail" : "warn",
      connectorReadiness.productionReady
        ? `${connectorReadiness.readyCount} connector families are ready or broker-managed.`
        : connectorBrokerRequired
          ? "Configure at least two native connector families or an external MCP/connector broker before production automation."
          : "Connector catalog is incomplete. This is acceptable only for an explicitly scoped non-automation/private-beta launch.",
    ),
    check(
      "connector-execution-evidence",
      "Connector execution evidence",
      connectorEvidenceReady ? "pass" : connectorEvidenceRequired ? "fail" : "warn",
      connectorEvidenceReady
        ? connectorEventSummaryText(connectorEventSummary)
        : `${connectorEventSummaryText(connectorEventSummary)} ${connectorEvidenceRefreshAction(connectorEventSummary)}${
            connectorEvidenceRequired
              ? " Set ALLOW_UNVERIFIED_CONNECTOR_EVIDENCE_IN_PRODUCTION=true only for an explicitly scoped private-beta launch."
              : ""
          }`,
    ),
    check(
      "context-ingestion",
      "Context ingestion pipeline",
      contextIngestionReady ? "pass" : "warn",
      contextIngestionConfigured
        ? contextSourcesNeedAttention
          ? `${contextReadinessSummaryText(contextReadiness)} Refresh stale or unindexed sources and resolve failed or quarantined records before launch promotion.`
          : manualOnlyContextIndex
            ? `Tenant context index contains ${indexedContextDocumentCount.toLocaleString("en-US")} indexed document(s) across ${indexedContextSourceCount.toLocaleString("en-US")} approved source(s), but all ingestion evidence is manual. Configure a sync worker, connector sync, vector store, or explicitly approve manual indexing for this launch. ${contextReadinessSummaryText(contextReadiness)}`
            : tenantContextIndexConfigured && !envContextIngestionConfigured
              ? `Tenant context index contains ${indexedContextDocumentCount.toLocaleString("en-US")} indexed document(s) across ${indexedContextSourceCount.toLocaleString("en-US")} approved source(s) with automated ingestion evidence. ${contextReadinessSummaryText(contextReadiness)}`
              : `A context sync worker, vector store, or explicitly approved manual indexing path is configured. ${contextReadinessSummaryText(contextReadiness)}`
        : `Configure VECTOR_STORE_URL, CONTEXT_INDEX_JOB_URL, or CONTEXT_SYNC_ENABLED before relying on customer knowledge at scale. ${contextReadinessSummaryText(contextReadiness)}`,
    ),
    check(
      "workflow-engine",
      "Durable workflow engine",
      workflowMode === "local-job-ledger"
        ? workflowEngineRequired
          ? "fail"
          : "warn"
        : workflowJobsHealthy
          ? "pass"
          : "warn",
      workflowMode === "local-job-ledger"
        ? workflowEngineRequired
          ? `Local workflow job ledger is active. Configure TEMPORAL_ADDRESS or WORKFLOW_ENGINE_URL, or explicitly set ALLOW_LOCAL_WORKFLOW_ENGINE_IN_PRODUCTION=true for a non-durable launch. ${workflowJobEvidence}`
          : `Local workflow job ledger is active. Configure Temporal or WORKFLOW_ENGINE_URL for production workers. ${workflowJobEvidence}`
        : workflowJobsHealthy
          ? `Workflow engine mode: ${workflowMode}. ${workflowJobEvidence}`
          : `Workflow engine mode: ${workflowMode}. ${workflowJobEvidence} ${workflowJobNextAction}`,
    ),
    check(
      "database-ops",
      "Backups and restore drill",
      backup.configured ? "pass" : process.env.NODE_ENV === "production" ? "fail" : "warn",
      backup.reason,
    ),
    check(
      "database-migrations",
      "Schema migration gate",
      migrations.configured ? "pass" : process.env.NODE_ENV === "production" ? "fail" : "warn",
      migrations.reason,
    ),
    check(
      "trace-store",
      "Harness trace store",
      traceStore.configured
        ? traceStore.mode === "emergency-file-trace-store"
          ? "warn"
          : "pass"
        : process.env.NODE_ENV === "production"
          ? "fail"
          : "warn",
      traceStore.reason,
    ),
    check(
      "harness-trace-evidence",
      "Harness trace evidence quality",
      harnessTraceEvidenceReady ? "pass" : harnessTraceEvidenceRequired ? "fail" : "warn",
      harnessTraceEvidenceReady
        ? harnessTraceSummaryText(harnessTraceSummary)
        : `${harnessTraceSummaryText(harnessTraceSummary)} ${harnessTraceRefreshAction(harnessTraceSummary)}${
            harnessTraceEvidenceRequired
              ? " Set ALLOW_UNVERIFIED_HARNESS_TRACE_IN_PRODUCTION=true only for an explicitly scoped private-beta launch."
              : ""
          }`,
    ),
    check(
      "eval-runner",
      "Evaluation runner and artifact store",
      evalRunner.configured ? "pass" : process.env.NODE_ENV === "production" ? "fail" : "warn",
      evalRunner.reason,
    ),
    check(
      "continuous-evals",
      "Continuous eval cadence",
      continuousEvalsReady ? "pass" : "warn",
      continuousEvalsReady
        ? `${evalCadence.reason} ${evalScheduleSummary(options.evalSchedulePlan)}`
        : evalScheduleBlocked
          ? `${evalCadence.reason} ${evalScheduleSummary(options.evalSchedulePlan)} Resolve blocked eval suites before launch promotion.`
          : `${evalCadence.reason} ${evalScheduleSummary(options.evalSchedulePlan)}`,
    ),
    check(
      "audit-integrity",
      "Tamper-evident audit chain",
      auditIntegrity.configured
        ? auditIntegrity.mode === "emergency-file-hash-chain"
          ? "warn"
          : "pass"
        : process.env.NODE_ENV === "production"
          ? "fail"
          : "warn",
      auditIntegrity.reason,
    ),
    check(
      "observability",
      "Observability and incident response",
      observability.configured ? "pass" : "warn",
      observability.configured
        ? `${observability.reason} Active sink(s): ${observability.sinks.join(", ") || "none"}.`
        : observability.reason,
    ),
    check(
      "privacy-lifecycle",
      "Privacy, retention, and data subject workflow",
      privacyLifecycleReady ? "pass" : "warn",
      privacyLifecycle.configured
        ? blockedPrivacyRequests > 0
          ? `${privacyLifecycle.reason} Retention window: ${privacyLifecycle.retentionDays.toLocaleString("en-US")} day(s). ${privacyOperationsSummary(privacyOperations)} Resolve blocked privacy requests before launch promotion.`
          : `${privacyLifecycle.reason} Retention window: ${privacyLifecycle.retentionDays.toLocaleString("en-US")} day(s). ${privacyOperationsSummary(privacyOperations)}`
        : `${privacyLifecycle.reason} ${privacyOperationsSummary(privacyOperations)}`,
    ),
  ];

  const status: "blocked" | "degraded" | "ready" = checks.some((item) => item.status === "fail")
    ? "blocked"
    : checks.some((item) => item.status === "warn")
      ? "degraded"
      : "ready";
  const blockers = checks.filter((item) => item.status === "fail");
  const warnings = checks.filter((item) => item.status === "warn");
  const manualActions = buildLaunchManualActions([...blockers, ...warnings]);
  const customerLaunchContract = deriveCustomerLaunchContract({
    auth,
    database,
    apiProtection,
    providers,
    secretVault,
    secretEvidence: options.secretEvidence,
    provisioningConfigured,
    modelBudgetConfigured,
    connectorEventSummary,
    contextIngestionConfigured,
    contextReadiness,
    connectors: connectorReadiness,
    workflowMode,
    operations: {
      backup,
      migrations,
      traceStore,
      evalRunner,
      auditIntegrity,
    },
    evalCadence,
    evalSchedulePlan: options.evalSchedulePlan,
    harnessTraceSummary,
    observability,
    privacyLifecycle,
    privacyOperations,
    workflowJobSummary,
  });

  return {
    status,
    checks,
    blockers,
    warnings,
    manualActions,
    manualActionsMarkdown: launchManualActionsMarkdown(manualActions),
    customerLaunchContract,
    auth,
    database,
    apiProtection,
    providers,
    secretVault,
    secretEvidence: options.secretEvidence,
    userProvisioning: {
      configured: provisioningConfigured,
      mode: provisioningConfigured ? "machine-token" : "manual-admin",
      reason: provisioningConfigured
        ? "Provisioning API token is configured."
        : "Provisioning falls back to manual Admin roster management.",
    },
    tenantProvisioning,
    connectors: {
      configured: connectorReadiness.productionReady,
      mode: connectorMode,
      catalog: connectorReadiness,
      eventSummary: connectorEventSummary,
    },
    contextReadiness,
    workflows: {
      configured: workflowMode !== "local-job-ledger",
      mode: workflowMode,
      jobSummary: workflowJobSummary,
      reconciliationPlan: options.workflowReconciliationPlan,
    },
    workflowReconciliationPlan: options.workflowReconciliationPlan,
    workflowJobSummary,
    backupDrillOperations: options.backupDrillOperations,
    operations: {
      backup,
      migrations,
      traceStore,
      evalRunner,
      auditIntegrity,
    },
    harnessTraceSummary,
    evalCadence,
    evalSchedulePlan: options.evalSchedulePlan,
    observability,
    privacyLifecycle,
    privacyOperations,
  };
}
