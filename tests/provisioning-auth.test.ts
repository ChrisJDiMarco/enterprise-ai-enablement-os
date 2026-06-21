import assert from "node:assert/strict";
import test from "node:test";

import { createHash } from "node:crypto";

import {
  bearerToken,
  machineProvisioningTenant,
  provisioningConfigured,
  provisioningToken,
  provisioningTokenRegistry,
  resolveMachineProvisioningTenant,
  sessionProvisioningTenant,
  tokenEntryMatches,
  tokenMatches,
} from "../src/lib/provisioning-auth.ts";

test("bearerToken parses only bearer authorization headers", () => {
  assert.equal(bearerToken("Bearer provision-token"), "provision-token");
  assert.equal(bearerToken("bearer provision-token"), "provision-token");
  assert.equal(bearerToken("Basic provision-token"), "");
  assert.equal(bearerToken(null), "");
});

test("provisioningToken prefers explicit provisioning token over SCIM fallback", () => {
  assert.equal(
    provisioningToken({
      PROVISIONING_API_TOKEN: "primary-token",
      SCIM_BEARER_TOKEN: "scim-token",
    }),
    "primary-token",
  );
  assert.equal(provisioningToken({ SCIM_BEARER_TOKEN: "scim-token" }), "scim-token");
});

test("tokenMatches compares provisioning tokens without accepting different lengths", () => {
  assert.equal(tokenMatches("abc", "abc"), true);
  assert.equal(tokenMatches("abc", "abcd"), false);
  assert.equal(tokenMatches("abc", "abd"), false);
});

test("machineProvisioningTenant requires an explicit and consistent tenant", () => {
  assert.deepEqual(machineProvisioningTenant({ bodyOrganizationId: "tenant-a" }), {
    ok: true,
    organizationId: "tenant-a",
  });
  assert.deepEqual(machineProvisioningTenant({ headerOrganizationId: "tenant-a" }), {
    ok: true,
    organizationId: "tenant-a",
  });
  assert.deepEqual(
    machineProvisioningTenant({
      bodyOrganizationId: "tenant-a",
      headerOrganizationId: "tenant-a",
    }),
    { ok: true, organizationId: "tenant-a" },
  );

  const missing = machineProvisioningTenant({});
  assert.equal(missing.ok, false);
  assert.equal(missing.ok ? "" : missing.code, "TENANT_REQUIRED");

  const mismatch = machineProvisioningTenant({
    bodyOrganizationId: "tenant-a",
    headerOrganizationId: "tenant-b",
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.ok ? "" : mismatch.code, "TENANT_MISMATCH");
});

test("machineProvisioningTenant rejects unsafe tenant identifiers", () => {
  const traversal = machineProvisioningTenant({ bodyOrganizationId: "../../etc/passwd" });
  assert.equal(traversal.ok, false);
  assert.equal(traversal.ok ? "" : traversal.code, "TENANT_INVALID");

  const email = machineProvisioningTenant({ headerOrganizationId: "owner@example.com" });
  assert.equal(email.ok, false);
  assert.equal(email.ok ? "" : email.code, "TENANT_INVALID");
});

test("sessionProvisioningTenant prevents admin-session tenant confusion", () => {
  assert.deepEqual(
    sessionProvisioningTenant({
      sessionOrganizationId: "tenant-a",
      bodyOrganizationId: "tenant-a",
    }),
    { ok: true, organizationId: "tenant-a" },
  );
  assert.deepEqual(sessionProvisioningTenant({ sessionOrganizationId: "tenant-a" }), {
    ok: true,
    organizationId: "tenant-a",
  });

  const mismatch = sessionProvisioningTenant({
    sessionOrganizationId: "tenant-a",
    bodyOrganizationId: "tenant-b",
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.ok ? "" : mismatch.code, "TENANT_MISMATCH");
});

test("sessionProvisioningTenant rejects unsafe body tenant hints", () => {
  const invalid = sessionProvisioningTenant({
    sessionOrganizationId: "tenant-a",
    bodyOrganizationId: "tenant/a",
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.ok ? "" : invalid.code, "TENANT_INVALID");
});

test("provisioningTokenRegistry parses per-tenant pairs and binds the legacy token", () => {
  const entries = provisioningTokenRegistry({
    PROVISIONING_TOKENS: "acme:tok_acme\n globex:sha256:deadbeef , bad-pair, :empty-org",
    PROVISIONING_API_TOKEN: "legacy-token",
    PROVISIONING_TOKEN_ORG: "initech",
  });
  assert.deepEqual(entries, [
    { organizationId: "acme", token: "tok_acme" },
    { organizationId: "globex", token: "sha256:deadbeef" },
    { organizationId: "initech", token: "legacy-token" },
  ]);
});

test("legacy provisioning token falls back to DEFAULT_ORGANIZATION_ID then 'default'", () => {
  assert.deepEqual(provisioningTokenRegistry({ PROVISIONING_API_TOKEN: "t", DEFAULT_ORGANIZATION_ID: "acme" }), [
    { organizationId: "acme", token: "t" },
  ]);
  assert.deepEqual(provisioningTokenRegistry({ SCIM_BEARER_TOKEN: "t" }), [{ organizationId: "default", token: "t" }]);
  assert.equal(provisioningConfigured({}), false);
});

test("tokenEntryMatches supports raw and sha256-hashed registry entries", () => {
  assert.equal(tokenEntryMatches("secret", "secret"), true);
  assert.equal(tokenEntryMatches("secret", "nope"), false);
  const hashed = `sha256:${createHash("sha256").update("secret").digest("hex")}`;
  assert.equal(tokenEntryMatches("secret", hashed), true);
  assert.equal(tokenEntryMatches("wrong", hashed), false);
});

test("resolveMachineProvisioningTenant blocks cross-tenant use of a tenant-bound token", () => {
  const env = { PROVISIONING_TOKENS: "acme:tok_acme, globex:tok_globex" };

  // Token bound to acme, no tenant requested -> resolves to acme.
  assert.deepEqual(resolveMachineProvisioningTenant({ token: "tok_acme", env }), {
    ok: true,
    organizationId: "acme",
  });

  // The acme token cannot provision into globex (the original cross-tenant hole).
  const crossTenant = resolveMachineProvisioningTenant({ token: "tok_acme", env, bodyOrganizationId: "globex" });
  assert.equal(crossTenant.ok, false);
  assert.equal(crossTenant.ok ? "" : crossTenant.status, 403);
  assert.equal(crossTenant.ok ? "" : crossTenant.code, "TENANT_MISMATCH");

  // A bad token is rejected even when it names a real tenant.
  const badToken = resolveMachineProvisioningTenant({ token: "guess", env, bodyOrganizationId: "acme" });
  assert.equal(badToken.ok, false);
  assert.equal(badToken.ok ? "" : badToken.code, "PROVISIONING_TOKEN_INVALID");

  // No registry configured -> 503.
  const unconfigured = resolveMachineProvisioningTenant({ token: "tok_acme", env: {} });
  assert.equal(unconfigured.ok, false);
  assert.equal(unconfigured.ok ? "" : unconfigured.code, "PROVISIONING_TOKEN_MISSING");
});

test("resolveMachineProvisioningTenant requires explicit tenant when a token is bound to many", () => {
  const env = { PROVISIONING_TOKENS: "acme:shared, globex:shared" };
  const ambiguous = resolveMachineProvisioningTenant({ token: "shared", env });
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.ok ? "" : ambiguous.code, "TENANT_REQUIRED");

  assert.deepEqual(resolveMachineProvisioningTenant({ token: "shared", env, headerOrganizationId: "globex" }), {
    ok: true,
    organizationId: "globex",
  });
});
