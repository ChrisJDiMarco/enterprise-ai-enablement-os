import assert from "node:assert/strict";
import test from "node:test";

import {
  bearerToken,
  machineProvisioningTenant,
  provisioningToken,
  sessionProvisioningTenant,
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
