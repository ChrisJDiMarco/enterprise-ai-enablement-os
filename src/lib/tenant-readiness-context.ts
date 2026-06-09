import { verifyAuditChain } from "./audit-integrity.ts";
import { listConnectorEvents, summarizeConnectorEvents } from "./connector-events.ts";
import { deriveContextReadinessSummary, getContextIndexStats } from "./context-index.ts";
import { deriveBackupDrillOperations } from "./database-ops.ts";
import { getWorkspaceRepository, type WorkspaceRepository } from "./database.ts";
import { deriveEvalSchedulePlan } from "./eval-scheduler.ts";
import type { Session } from "./auth.ts";
import { derivePrivacyLifecycleOperations } from "./privacy-lifecycle.ts";
import type { ProductionReadinessOptions } from "./production-readiness.ts";
import { auditIntegrityReadinessFromVerification } from "./production-ops-readiness.ts";
import { listTenantSecrets } from "./tenant-secret-vault.ts";
import { listHarnessTraces, summarizeHarnessTraces } from "./trace-store.ts";
import {
  deriveWorkflowJobReconciliationPlan,
  listWorkflowJobs,
  summarizeWorkflowJobs,
} from "./workflow-jobs.ts";

type TenantReadinessContextDeps = {
  repository?: WorkspaceRepository;
  listTenantSecrets?: typeof listTenantSecrets;
  getContextIndexStats?: typeof getContextIndexStats;
  listConnectorEvents?: typeof listConnectorEvents;
  listHarnessTraces?: typeof listHarnessTraces;
  listWorkflowJobs?: typeof listWorkflowJobs;
};

export type TenantReadinessContext = {
  organizationId?: string;
  tenantEvidenceLoaded: boolean;
  evidenceErrors: string[];
  options: ProductionReadinessOptions;
};

function defaultOrganizationId() {
  return process.env.DEFAULT_ORGANIZATION_ID || "default";
}

function unavailableAuditIntegrity() {
  return {
    configured: false,
    mode: "unavailable",
    reason: "Audit chain could not be verified because persistence is unavailable.",
    evidence: [],
  };
}

function uncheckedAuditIntegrity() {
  return {
    configured: false,
    mode: "not-checked",
    reason: "Sign in to verify the tenant audit chain.",
    evidence: [],
  };
}

export async function loadTenantReadinessContext(params: {
  session?: Session | null;
  includeFallbackTenant?: boolean;
  fallbackOrganizationId?: string;
  deps?: TenantReadinessContextDeps;
}): Promise<TenantReadinessContext> {
  const organizationId =
    params.session?.user.organizationId ||
    (params.includeFallbackTenant ? params.fallbackOrganizationId || defaultOrganizationId() : undefined);
  const evidenceErrors: string[] = [];

  if (!organizationId) {
    return {
      tenantEvidenceLoaded: false,
      evidenceErrors,
      options: {
        configuredSecretNames: [],
      },
    };
  }

  const options: ProductionReadinessOptions = {
    configuredSecretNames: [],
    auditIntegrity: uncheckedAuditIntegrity(),
  };
  const secretLister = params.deps?.listTenantSecrets ?? listTenantSecrets;
  const connectorEventLister = params.deps?.listConnectorEvents ?? listConnectorEvents;
  const harnessTraceLister = params.deps?.listHarnessTraces ?? listHarnessTraces;
  const workflowJobLister = params.deps?.listWorkflowJobs ?? listWorkflowJobs;
  const contextStatsLoader = params.deps?.getContextIndexStats ?? getContextIndexStats;
  const repository = params.deps?.repository ?? getWorkspaceRepository();

  try {
    options.configuredSecretNames = (await secretLister(organizationId)).map((secret) => secret.name);
  } catch (error) {
    evidenceErrors.push(error instanceof Error ? error.message : "Tenant secret evidence could not be loaded.");
    options.configuredSecretNames = [];
  }

  try {
    const workflowJobs = await workflowJobLister(organizationId);
    options.workflowJobSummary = summarizeWorkflowJobs(workflowJobs);
    options.workflowReconciliationPlan = deriveWorkflowJobReconciliationPlan(workflowJobs);
  } catch (error) {
    evidenceErrors.push(error instanceof Error ? error.message : "Workflow job evidence could not be loaded.");
  }

  try {
    options.connectorEventSummary = summarizeConnectorEvents(await connectorEventLister(organizationId, 500));
  } catch (error) {
    evidenceErrors.push(error instanceof Error ? error.message : "Connector event evidence could not be loaded.");
  }

  try {
    options.harnessTraceSummary = summarizeHarnessTraces(await harnessTraceLister(organizationId, 500));
  } catch (error) {
    evidenceErrors.push(error instanceof Error ? error.message : "Harness trace evidence could not be loaded.");
  }

  try {
    const workspace = await repository.getWorkspace(organizationId);
    options.aiSettings = workspace.aiSettings;
    options.contextIndexStats = await contextStatsLoader(organizationId);
    options.contextReadiness = deriveContextReadinessSummary({
      stats: options.contextIndexStats,
      sources: workspace.contextSources,
    });
    options.evalSchedulePlan = deriveEvalSchedulePlan({
      skills: workspace.skills,
      evalResults: workspace.evalResults,
    });

    const auditLogs = await repository.listAuditLogs(organizationId, 10000);
    options.backupDrillOperations = deriveBackupDrillOperations(auditLogs);
    options.privacyOperations = derivePrivacyLifecycleOperations(auditLogs);
    options.auditIntegrity = auditIntegrityReadinessFromVerification(verifyAuditChain(organizationId, auditLogs));
  } catch (error) {
    evidenceErrors.push(error instanceof Error ? error.message : "Tenant workspace evidence could not be loaded.");
    options.auditIntegrity = unavailableAuditIntegrity();
  }

  return {
    organizationId,
    tenantEvidenceLoaded: true,
    evidenceErrors,
    options,
  };
}
