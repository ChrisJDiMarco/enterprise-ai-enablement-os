import type { OperationalMetadataValue } from "./observability.ts";
import type { TenantSecretEvidence } from "./tenant-secret-evidence.ts";
import type { SecretCategory, TenantSecretReadinessImpact } from "./tenant-secret-readiness.ts";

export type TenantSecretLifecycleOperation = "updated" | "deleted";

export function tenantSecretLifecycleEventName(
  scope: SecretCategory,
  operation: TenantSecretLifecycleOperation,
) {
  return `${scope}_secrets.${operation}`;
}

export function tenantSecretLifecycleEventLevel(evidence: TenantSecretEvidence) {
  return evidence.usableForRuntime || evidence.configuredSecretCount === 0 ? "info" : "warn";
}

export function tenantSecretLifecycleMetadata(params: {
  operation: TenantSecretLifecycleOperation;
  scope: SecretCategory;
  requestedCount: number;
  changedCount: number;
  connectionImpact: TenantSecretReadinessImpact;
  evidence: TenantSecretEvidence;
}): Record<string, OperationalMetadataValue> {
  const { connectionImpact, evidence } = params;

  return {
    operation: params.operation,
    scope: params.scope,
    requestedCount: params.requestedCount,
    changedCount: params.changedCount,
    changedProviderCount: connectionImpact.changedSummary.provider,
    changedConnectorCount: connectionImpact.changedSummary.connector,
    changedTenantCount: connectionImpact.changedSummary.tenant,
    configuredSecretCount: evidence.configuredSecretCount,
    decryptableSecretCount: evidence.decryptableSecretCount,
    undecryptableSecretCount: evidence.undecryptableSecretCount,
    invalidSecretCount: evidence.invalidSecretCount,
    unsupportedSecretCount: evidence.unsupportedSecretNames.length,
    tenantVaultNamesApplied: evidence.tenantVaultNamesApplied,
    usableForRuntime: evidence.usableForRuntime,
    vaultConfigured: evidence.vault.configured,
    vaultEncrypted: evidence.vault.encrypted,
    vaultMode: evidence.vault.mode,
    providerReadyExternalCount: connectionImpact.providers.readyExternalCount,
    providerTotalExternalCount: connectionImpact.providers.totalExternalCount,
    connectorBrokerConfigured: connectionImpact.connectors.brokerConfigured,
    connectorBrokerAuthenticated: connectionImpact.connectors.brokerAuthenticated,
    connectorBrokerMode: connectionImpact.connectors.brokerMode,
    connectorReadyCount: connectionImpact.connectors.readyCount,
    connectorPartialCount: connectionImpact.connectors.partialCount,
    connectorMissingCount: connectionImpact.connectors.missingCount,
    connectorRequiredCount: connectionImpact.connectors.requiredCount,
    connectorProductionReady: connectionImpact.connectors.productionReady,
  };
}
