import { test } from "node:test";
import assert from "node:assert/strict";

import {
  tenantSecretLifecycleEventLevel,
  tenantSecretLifecycleEventName,
  tenantSecretLifecycleMetadata,
} from "../src/lib/tenant-secret-observability.ts";
import type { TenantSecretEvidence } from "../src/lib/tenant-secret-evidence.ts";
import { buildTenantSecretReadinessImpact } from "../src/lib/tenant-secret-readiness.ts";

function evidence(overrides: Partial<TenantSecretEvidence> = {}): TenantSecretEvidence {
  return {
    schema: "enterprise-ai-enablement-os.tenant-secret-evidence.v1",
    readable: true,
    usableForRuntime: true,
    tenantVaultNamesApplied: true,
    configuredSecretCount: 4,
    decryptableSecretCount: 4,
    undecryptableSecretCount: 0,
    invalidSecretCount: 0,
    invalidSecretNames: [],
    unsupportedSecretNames: [],
    vault: {
      configured: true,
      encrypted: true,
      mode: "tenant-encrypted",
      reason: "Tenant vault is encrypted.",
    },
    ...overrides,
  };
}

test("tenant secret lifecycle observability emits impact counts without secret names", () => {
  const connectionImpact = buildTenantSecretReadinessImpact({
    configuredSecretNames: ["OPENAI_API_KEY", "JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
    runtimeSecretNames: ["OPENAI_API_KEY", "JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
    changedNames: ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
    env: {},
  });
  const metadata = tenantSecretLifecycleMetadata({
    operation: "updated",
    scope: "connector",
    requestedCount: 3,
    changedCount: 3,
    connectionImpact,
    evidence: evidence(),
  });
  const serialized = JSON.stringify(metadata);

  assert.equal(tenantSecretLifecycleEventName("connector", "updated"), "connector_secrets.updated");
  assert.equal(metadata.operation, "updated");
  assert.equal(metadata.scope, "connector");
  assert.equal(metadata.requestedCount, 3);
  assert.equal(metadata.changedConnectorCount, 3);
  assert.equal(metadata.configuredSecretCount, 4);
  assert.equal(metadata.decryptableSecretCount, 4);
  assert.equal(metadata.invalidSecretCount, 0);
  assert.equal(typeof metadata.connectorReadyCount, "number");
  assert.equal((metadata.connectorReadyCount as number) >= 1, true);
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes("JIRA_API_TOKEN"), false);
  assert.equal(serialized.includes("sk-"), false);
});

test("tenant secret lifecycle observability warns when stored secrets are not runtime usable", () => {
  const unusableEvidence = evidence({
    usableForRuntime: false,
    tenantVaultNamesApplied: false,
    decryptableSecretCount: 1,
    undecryptableSecretCount: 2,
    vault: {
      configured: true,
      encrypted: true,
      mode: "tenant-encrypted",
      reason: "Tenant vault is encrypted.",
    },
  });

  assert.equal(tenantSecretLifecycleEventLevel(unusableEvidence), "warn");
  assert.equal(tenantSecretLifecycleEventLevel(evidence({ configuredSecretCount: 0, usableForRuntime: false })), "info");
});
