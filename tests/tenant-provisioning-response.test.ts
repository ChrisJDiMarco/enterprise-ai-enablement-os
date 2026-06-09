import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTenantProvisioningDisabledResponse,
  buildTenantProvisioningResponse,
  buildTenantProvisioningStatusResponse,
} from "../src/lib/tenant-provisioning-response.ts";
import { emptyWorkspace } from "../src/lib/workspace-schema.ts";
import type { Session } from "../src/lib/auth.ts";
import type { TenantProvisioningReadiness } from "../src/lib/tenant-provisioning-readiness.ts";

test("buildTenantProvisioningStatusResponse hides internal readiness evidence from public callers", () => {
  const readiness = {
    requested: true,
    enabled: false,
    configured: false,
    mode: "production-self-serve-risk",
    reason:
      "SELF_SERVE_SIGNUP_ENABLED=true, but self-serve onboarding is not safe yet. Missing: DATABASE_URL; TENANT_SECRET_KEY.",
    evidence: ["durable database missing", "tenant secret vault missing"],
    missing: ["DATABASE_URL", "TENANT_SECRET_KEY"],
  } satisfies TenantProvisioningReadiness;

  const response = buildTenantProvisioningStatusResponse(readiness);

  assert.equal(response.schema, "enterprise-ai-enablement-os.tenant-provisioning.v1");
  assert.equal(response.public, true);
  assert.equal(response.enabled, false);
  assert.equal(response.configured, false);
  assert.equal(response.readinessMode, "production-self-serve-risk");
  assert.equal(response.reason, "Self-serve tenant onboarding is currently unavailable.");

  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("DATABASE_URL"), false);
  assert.equal(serialized.includes("TENANT_SECRET_KEY"), false);
  assert.equal(serialized.includes("durable database missing"), false);
  assert.equal(serialized.includes("SELF_SERVE_SIGNUP_ENABLED"), false);
  assert.equal(serialized.includes("missing"), false);
  assert.equal(serialized.includes("evidence"), false);
});

test("buildTenantProvisioningDisabledResponse keeps failed self-serve POST denial public-safe", () => {
  const readiness = {
    requested: true,
    enabled: false,
    configured: false,
    mode: "production-self-serve-risk",
    reason:
      "SELF_SERVE_SIGNUP_ENABLED=true, but self-serve onboarding is not safe yet. Missing: DATABASE_URL; TENANT_SECRET_KEY.",
    evidence: ["durable database missing", "tenant secret vault missing"],
    missing: ["DATABASE_URL", "TENANT_SECRET_KEY"],
  } satisfies TenantProvisioningReadiness;

  const response = buildTenantProvisioningDisabledResponse(readiness);

  assert.equal(response.schema, "enterprise-ai-enablement-os.tenant-provisioning.v1");
  assert.equal(response.public, true);
  assert.equal(response.enabled, false);
  assert.equal(response.code, "TENANT_PROVISIONING_DISABLED");
  assert.equal(response.error, "Self-serve tenant provisioning is disabled.");
  assert.equal(response.reason, "Self-serve tenant onboarding is currently unavailable.");

  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("DATABASE_URL"), false);
  assert.equal(serialized.includes("TENANT_SECRET_KEY"), false);
  assert.equal(serialized.includes("durable database missing"), false);
  assert.equal(serialized.includes("SELF_SERVE_SIGNUP_ENABLED"), false);
  assert.equal(serialized.includes("missing"), false);
  assert.equal(serialized.includes("evidence"), false);
});

test("buildTenantProvisioningResponse returns a minimal public onboarding contract", () => {
  const workspace = emptyWorkspace("tenant-response-test");
  workspace.organization.name = "Tenant Response Test";
  workspace.organization.slug = "tenant-response-test";
  workspace.users = [
    {
      id: "admin-1",
      name: "Tenant Admin",
      email: "admin@example.com",
      title: "Workspace Admin",
      department: "Data",
      role: "admin",
    },
  ];
  workspace.auditLogs = [
    {
      id: "audit-1",
      eventType: "tenant_created",
      message: "Tenant created.",
      actor: "Tenant Admin",
      riskLevel: "low",
      createdAt: "2026-06-06T17:45:00.000Z",
    },
  ];
  workspace.report = "Internal onboarding note.";

  const session = {
    user: {
      id: "admin-1",
      organizationId: workspace.organizationId,
      name: "Tenant Admin",
      email: "admin@example.com",
      role: "admin",
      department: "Data",
    },
    issuedAt: 1_780_000_000_000,
    expiresAt: 1_780_028_800_000,
  } satisfies Session;

  const response = buildTenantProvisioningResponse({ workspace, session });

  assert.equal(response.schema, "enterprise-ai-enablement-os.tenant-provisioning.v1");
  assert.equal(response.tenant.organizationId, "tenant-response-test");
  assert.equal(response.tenant.admin?.email, "admin@example.com");
  assert.equal(response.session.organizationId, "tenant-response-test");
  assert.equal(response.session.userId, "admin-1");
  assert.equal(response.links.workspace, "/api/workspace");

  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("auditLogs"), false);
  assert.equal(serialized.includes("users"), false);
  assert.equal(serialized.includes("tools"), false);
  assert.equal(serialized.includes("contextSources"), false);
  assert.equal(serialized.includes("Internal onboarding note."), false);
});
