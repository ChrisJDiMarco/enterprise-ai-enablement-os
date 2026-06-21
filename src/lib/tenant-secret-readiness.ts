import {
  enterpriseConnectorRegistry,
  getEnterpriseConnectorReadiness,
  type EnterpriseConnectorReadiness,
} from "./enterprise-connectors.ts";
import { getProviderReadiness, providerRegistry, type ProviderReadiness } from "./provider-registry.ts";
import { canonicalTenantSecretName } from "./tenant-secret-format.ts";

export { tenantSecretValueIssue } from "./tenant-secret-format.ts";

export type SecretCategory = "provider" | "connector" | "tenant";

export type TenantSecretReadinessImpact = {
  schema: "enterprise-ai-enablement-os.tenant-secret-impact.v1";
  changedNames: string[];
  unsupportedSecretNames: string[];
  categorySummary: Record<SecretCategory, number>;
  changedSummary: Record<SecretCategory, number>;
  providers: {
    readyExternalCount: number;
    totalExternalCount: number;
    newlyReady: ProviderReadiness[];
    affected: ProviderReadiness[];
    incompleteAffected: ProviderReadiness[];
    nextAction: string;
  };
  connectors: {
    brokerConfigured: boolean;
    brokerUrlConfigured: boolean;
    brokerAuthenticated: boolean;
    brokerMissingSecretNames: string[];
    brokerMode: "mcp-broker" | "connector-broker" | "policy-only";
    readyCount: number;
    partialCount: number;
    missingCount: number;
    requiredCount: number;
    productionReady: boolean;
    newlyReady: EnterpriseConnectorReadiness[];
    affected: EnterpriseConnectorReadiness[];
    incompleteAffected: EnterpriseConnectorReadiness[];
    nextAction: string;
  };
  nextAction: string;
};

type RuntimeEnv = Record<string, string | undefined>;

const tenantControlPlaneSecretNames = new Set([
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "OIDC_ISSUER",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "OIDC_REDIRECT_URI",
  "PROVISIONING_API_TOKEN",
  "SCIM_BEARER_TOKEN",
  "LOCAL_LOGIN_TOKEN",
  "EMERGENCY_LOCAL_LOGIN_TOKEN",
  "EMERGENCY_ACCESS_TOKEN",
  "API_RATE_LIMIT_KEY_SALT",
  "MCP_BROKER_URL",
  "MCP_BROKER_TOKEN",
  "CONNECTOR_BROKER_URL",
  "CONNECTOR_BROKER_TOKEN",
  "LOG_DRAIN_URL",
  "LOG_DRAIN_TOKEN",
]);

const connectorPlaneControlSecretNames = new Set([
  "MCP_BROKER_URL",
  "MCP_BROKER_TOKEN",
  "CONNECTOR_BROKER_URL",
  "CONNECTOR_BROKER_TOKEN",
]);

function uniqueSecretNames(secretNames: string[]) {
  return Array.from(new Set(secretNames.map(canonicalTenantSecretName).filter(Boolean)));
}

function providerSecretNamesFor(provider: (typeof providerRegistry)[number]) {
  return [
    ...provider.keyEnvNames,
    ...(provider.endpointEnvNames ?? []),
    ...(provider.baseUrlEnvNames ?? []),
  ];
}

function providerSecretNames() {
  return new Set(providerRegistry.flatMap(providerSecretNamesFor));
}

function connectorSecretNames() {
  return new Set(
    enterpriseConnectorRegistry.flatMap((connector) => [
      ...connector.requiredSecretNames,
      ...(connector.optionalSecretNames ?? []),
    ]),
  );
}

export function knownTenantSecretNames() {
  return new Set([
    ...providerSecretNames(),
    ...connectorSecretNames(),
    ...tenantControlPlaneSecretNames,
  ]);
}

export function isKnownTenantSecretName(name: string) {
  const canonical = canonicalTenantSecretName(name);
  return Boolean(canonical && knownTenantSecretNames().has(canonical));
}

export function unknownTenantSecretNames(secretNames: string[]) {
  return uniqueSecretNames(secretNames).filter((name) => !isKnownTenantSecretName(name));
}

export function categorizeTenantSecretName(name: string): SecretCategory {
  const canonical = canonicalTenantSecretName(name);
  if (connectorSecretNames().has(canonical)) return "connector";
  if (providerSecretNames().has(canonical)) return "provider";
  return "tenant";
}

export function summarizeTenantSecretCategories(secretNames: string[]) {
  return uniqueSecretNames(secretNames).reduce<Record<SecretCategory, number>>(
    (summary, name) => {
      summary[categorizeTenantSecretName(name)] += 1;
      return summary;
    },
    { provider: 0, connector: 0, tenant: 0 },
  );
}

export function deriveTenantSecretOperationScope(params: {
  requestedScope?: SecretCategory;
  secretNames: string[];
}): SecretCategory {
  const requestedScope = params.requestedScope ?? "tenant";
  const secretNames = uniqueSecretNames(params.secretNames);
  if (!secretNames.length) return requestedScope;

  const connectorNames = connectorSecretNames();
  const providerNames = providerSecretNames();
  const allProvider = secretNames.every((name) => providerNames.has(name));
  const allConnectorPlane = secretNames.every((name) =>
    connectorNames.has(name) || connectorPlaneControlSecretNames.has(name),
  );

  if (allProvider) return "provider";
  if (allConnectorPlane) return "connector";

  return "tenant";
}

function labelList(items: { label: string }[], fallback: string) {
  if (!items.length) return fallback;
  if (items.length === 1) return items[0].label;
  return `${items.slice(0, 2).map((item) => item.label).join(", ")}${items.length > 2 ? `, +${items.length - 2}` : ""}`;
}

function firstIncompleteProviderAction(providers: ProviderReadiness[]) {
  const provider = providers.find((item) => item.missing.length);
  if (!provider) return "";
  return `Finish ${provider.label} by adding ${provider.missing.join(", ")}.`;
}

function firstIncompleteConnectorAction(connectors: EnterpriseConnectorReadiness[]) {
  const connector = connectors.find((item) => item.missingSecrets.length);
  if (!connector) return "";
  return `Finish ${connector.label} by adding ${connector.missingSecrets.slice(0, 3).join(", ")}.`;
}

function buildProviderNextAction(params: {
  newlyReady: ProviderReadiness[];
  incompleteAffected: ProviderReadiness[];
  readyExternalCount: number;
}) {
  if (params.newlyReady.length) {
    return `${labelList(params.newlyReady, "Model provider")} is ready for routing. Run a model smoke test and assign default or fallback lanes.`;
  }

  const incompleteAction = firstIncompleteProviderAction(params.incompleteAffected);
  if (incompleteAction) return incompleteAction;

  if (!params.readyExternalCount) {
    return "Add at least one approved external model provider key before enabling live AI actions.";
  }

  return `${params.readyExternalCount} external model provider${params.readyExternalCount === 1 ? "" : "s"} ready. Keep routing, cost limits, and fallbacks under review.`;
}

function buildConnectorNextAction(params: {
  newlyReady: EnterpriseConnectorReadiness[];
  incompleteAffected: EnterpriseConnectorReadiness[];
  productionReady: boolean;
  partialCount: number;
  brokerConfigured: boolean;
}) {
  if (params.newlyReady.length) {
    return `${labelList(params.newlyReady, "Connector")} is ready. Run a read smoke test, test the action gate, and capture proof.`;
  }

  const incompleteAction = firstIncompleteConnectorAction(params.incompleteAffected);
  if (incompleteAction) return incompleteAction;

  if (params.productionReady) {
    return "Connector plane is production-ready. Keep scopes, broker routes, and evidence capture under recurring review.";
  }

  if (params.partialCount) {
    return "Finish the partially configured connector before routing production workflows through it.";
  }

  return params.brokerConfigured
    ? "Confirm broker-owned connector secrets and run a broker smoke test with evidence."
    : "Connect an MCP or connector broker, or store native secrets for the first production connector.";
}

export function buildTenantSecretReadinessImpact(params: {
  configuredSecretNames: string[];
  runtimeSecretNames?: string[];
  changedNames?: string[];
  beforeConfiguredSecretNames?: string[];
  beforeRuntimeSecretNames?: string[];
  env?: RuntimeEnv;
}): TenantSecretReadinessImpact {
  const configuredSecretNames = uniqueSecretNames(params.configuredSecretNames);
  const runtimeSecretNames = uniqueSecretNames(params.runtimeSecretNames ?? configuredSecretNames);
  const beforeConfiguredSecretNames = uniqueSecretNames(params.beforeConfiguredSecretNames ?? configuredSecretNames);
  const beforeRuntimeSecretNames = uniqueSecretNames(params.beforeRuntimeSecretNames ?? beforeConfiguredSecretNames);
  const changedNames = uniqueSecretNames(params.changedNames ?? []);
  const unsupportedSecretNames = unknownTenantSecretNames(configuredSecretNames);
  const categorySummary = summarizeTenantSecretCategories(configuredSecretNames);
  const changedSummary = summarizeTenantSecretCategories(changedNames);
  const changed = new Set(changedNames);
  const env = params.env ?? process.env;

  const beforeProviders = new Map(getProviderReadiness(env, beforeRuntimeSecretNames).map((provider) => [provider.id, provider]));
  const afterProviders = getProviderReadiness(env, runtimeSecretNames);
  const externalProviders = afterProviders.filter((provider) => provider.id !== "local");
  const affectedProviders = afterProviders.filter((provider) => {
    const registryEntry = providerRegistry.find((entry) => entry.id === provider.id);
    return Boolean(registryEntry && providerSecretNamesFor(registryEntry).some((name) => changed.has(name)));
  });
  const newlyReadyProviders = affectedProviders.filter(
    (provider) => provider.id !== "local" && provider.configured && !beforeProviders.get(provider.id)?.configured,
  );
  const incompleteAffectedProviders = affectedProviders.filter((provider) => provider.id !== "local" && !provider.configured);
  const readyExternalCount = externalProviders.filter((provider) => provider.configured).length;
  const providerNextAction = buildProviderNextAction({
    newlyReady: newlyReadyProviders,
    incompleteAffected: incompleteAffectedProviders,
    readyExternalCount,
  });

  const beforeConnectors = new Map(
    getEnterpriseConnectorReadiness(env, beforeRuntimeSecretNames).connectors.map((connector) => [connector.id, connector]),
  );
  const connectorSummary = getEnterpriseConnectorReadiness(env, runtimeSecretNames);
  const affectedConnectors = connectorSummary.connectors.filter((connector) =>
    [...connector.requiredSecretNames, ...(connector.optionalSecretNames ?? [])].some((name) => changed.has(name)),
  );
  const newlyReadyConnectors = affectedConnectors.filter((connector) => {
    const before = beforeConnectors.get(connector.id);
    return connector.status === "ready" && before?.status !== "ready";
  });
  const incompleteAffectedConnectors = affectedConnectors.filter((connector) =>
    connector.status === "partial" || connector.status === "missing",
  );
  const connectorNextAction = buildConnectorNextAction({
    newlyReady: newlyReadyConnectors,
    incompleteAffected: incompleteAffectedConnectors,
    productionReady: connectorSummary.productionReady,
    partialCount: connectorSummary.partialCount,
    brokerConfigured: connectorSummary.brokerConfigured,
  });
  const nextAction = unsupportedSecretNames.length
    ? `Review ${unsupportedSecretNames.length.toLocaleString("en-US")} unsupported tenant vault secret name${unsupportedSecretNames.length === 1 ? "" : "s"} and rotate ${unsupportedSecretNames.length === 1 ? "it" : "them"} into a cataloged provider, connector, or control-plane field.`
    : changedSummary.provider
      ? providerNextAction
      : changedSummary.connector
        ? connectorNextAction
        : readyExternalCount
          ? connectorNextAction
          : providerNextAction;

  return {
    schema: "enterprise-ai-enablement-os.tenant-secret-impact.v1",
    changedNames,
    unsupportedSecretNames,
    categorySummary,
    changedSummary,
    providers: {
      readyExternalCount,
      totalExternalCount: externalProviders.length,
      newlyReady: newlyReadyProviders,
      affected: affectedProviders,
      incompleteAffected: incompleteAffectedProviders,
      nextAction: providerNextAction,
    },
    connectors: {
      brokerConfigured: connectorSummary.brokerConfigured,
      brokerUrlConfigured: connectorSummary.brokerUrlConfigured,
      brokerAuthenticated: connectorSummary.brokerAuthenticated,
      brokerMissingSecretNames: connectorSummary.brokerMissingSecretNames,
      brokerMode: connectorSummary.brokerMode,
      readyCount: connectorSummary.readyCount,
      partialCount: connectorSummary.partialCount,
      missingCount: connectorSummary.missingCount,
      requiredCount: connectorSummary.requiredCount,
      productionReady: connectorSummary.productionReady,
      newlyReady: newlyReadyConnectors,
      affected: affectedConnectors,
      incompleteAffected: incompleteAffectedConnectors,
      nextAction: connectorNextAction,
    },
    nextAction,
  };
}
