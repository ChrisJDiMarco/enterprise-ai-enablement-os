import { listTenantSecrets, readTenantSecretValues, type TenantSecretRecord } from "./tenant-secret-vault.ts";
import { unknownTenantSecretNames } from "./tenant-secret-readiness.ts";
import { secretVaultReadinessFromEnv, type RuntimeEnv, type SecretVaultReadiness } from "./runtime-readiness-policy.ts";
import { tenantSecretValueIssue } from "./tenant-secret-format.ts";

export type TenantSecretEvidence = {
  schema: "enterprise-ai-enablement-os.tenant-secret-evidence.v1";
  readable: boolean;
  usableForRuntime: boolean;
  tenantVaultNamesApplied: boolean;
  configuredSecretCount: number;
  decryptableSecretCount: number;
  undecryptableSecretCount: number;
  invalidSecretCount: number;
  invalidSecretNames: string[];
  unsupportedSecretNames: string[];
  vault: SecretVaultReadiness;
  warning?: string;
};

export type TenantSecretEvidenceResult = {
  configuredSecretNames: string[];
  runtimeSecretNames: string[];
  evidence: TenantSecretEvidence;
};

const vaultLookupWarning =
  "Tenant secret names could not be loaded. Review vault and database configuration before trusting provider or connector readiness.";
const vaultDecryptWarning =
  "Tenant secret names were found, but secret values could not be verified for runtime use. Rotate the stored secrets or review the tenant vault key before trusting provider or connector readiness.";
const vaultInvalidValueWarning =
  "Tenant secret values were decrypted, but some values fail runtime format checks. Correct or rotate them before trusting provider or connector readiness.";
const unsupportedSecretWarning =
  "Tenant vault contains unsupported secret names. Rotate or remove them into cataloged provider, connector, or control-plane fields before launch.";
const tenantSecretNamePattern = /^[A-Z0-9_]{2,120}$/;

function joinWarnings(...warnings: (string | undefined)[]) {
  return warnings.filter(Boolean).join(" ");
}

function canonicalTenantSecretNames(records: TenantSecretRecord[]) {
  return Array.from(new Set(
    records
      .map((record) => record.name.trim().toUpperCase())
      .filter((name) => tenantSecretNamePattern.test(name)),
  ));
}

export async function loadTenantSecretEvidence(params: {
  organizationId: string;
  env?: RuntimeEnv;
  deps?: {
    listTenantSecrets?: typeof listTenantSecrets;
    readTenantSecretValues?: typeof readTenantSecretValues;
  };
}): Promise<TenantSecretEvidenceResult> {
  const env = params.env ?? process.env;
  const vault = secretVaultReadinessFromEnv(env);
  const lister = params.deps?.listTenantSecrets ?? listTenantSecrets;
  const reader = params.deps?.readTenantSecretValues ?? readTenantSecretValues;
  let records: TenantSecretRecord[] = [];
  let readable = true;
  let warning: string | undefined = vault.configured ? undefined : vault.reason;

  try {
    records = await lister(params.organizationId);
  } catch {
    readable = false;
    warning = vaultLookupWarning;
  }

  const configuredSecretNames = canonicalTenantSecretNames(records);
  const unsupportedSecretNames = unknownTenantSecretNames(configuredSecretNames);
  const unsupportedSet = new Set(unsupportedSecretNames);
  const runtimeCandidateSecretNames = configuredSecretNames.filter((name) => !unsupportedSet.has(name));
  let decryptableSecretCount = 0;
  let undecryptableSecretCount = 0;
  let decryptableNames = new Set<string>();
  let validRuntimeNames = new Set<string>();
  let invalidSecretNames: string[] = [];
  if (readable && vault.configured && vault.encrypted && configuredSecretNames.length > 0) {
    try {
      const values = await reader(params.organizationId, configuredSecretNames);
      decryptableNames = new Set(
        Object.entries(values)
          .filter(([, value]) => typeof value === "string" && value.trim())
          .map(([name]) => name),
      );
      decryptableSecretCount = configuredSecretNames.filter((name) => decryptableNames.has(name)).length;
      undecryptableSecretCount = Math.max(configuredSecretNames.length - decryptableSecretCount, 0);
      const runtimeCandidateSet = new Set(runtimeCandidateSecretNames);
      validRuntimeNames = new Set(
        Object.entries(values)
          .filter(([name, value]) =>
            runtimeCandidateSet.has(name) &&
            typeof value === "string" &&
            value.trim() &&
            !tenantSecretValueIssue(name, value),
          )
          .map(([name]) => name),
      );
      invalidSecretNames = runtimeCandidateSecretNames.filter((name) =>
        decryptableNames.has(name) && !validRuntimeNames.has(name),
      );
      if (undecryptableSecretCount > 0) warning = joinWarnings(warning, vaultDecryptWarning);
      if (invalidSecretNames.length > 0) warning = joinWarnings(warning, vaultInvalidValueWarning);
    } catch {
      decryptableSecretCount = 0;
      undecryptableSecretCount = configuredSecretNames.length;
      warning = joinWarnings(warning, vaultDecryptWarning);
    }
  } else if (readable && configuredSecretNames.length > 0 && (!vault.configured || !vault.encrypted)) {
    undecryptableSecretCount = configuredSecretNames.length;
  }
  if (unsupportedSecretNames.length > 0) {
    warning = joinWarnings(warning, unsupportedSecretWarning);
  }
  const runtimeCandidatesUsable =
    runtimeCandidateSecretNames.length === 0 ||
    runtimeCandidateSecretNames.every((name) => validRuntimeNames.has(name));
  const valuesUsable =
    configuredSecretNames.length === 0 ||
    runtimeCandidatesUsable;
  const usableForRuntime = readable && vault.configured && vault.encrypted && valuesUsable;
  const runtimeSecretNames = usableForRuntime ? runtimeCandidateSecretNames : [];
  const tenantVaultNamesApplied = runtimeSecretNames.length > 0;

  return {
    configuredSecretNames,
    runtimeSecretNames,
    evidence: {
      schema: "enterprise-ai-enablement-os.tenant-secret-evidence.v1",
      readable,
      usableForRuntime,
      tenantVaultNamesApplied,
      configuredSecretCount: configuredSecretNames.length,
      decryptableSecretCount,
      undecryptableSecretCount,
      invalidSecretCount: invalidSecretNames.length,
      invalidSecretNames,
      unsupportedSecretNames,
      vault,
      ...(warning ? { warning } : {}),
    },
  };
}
