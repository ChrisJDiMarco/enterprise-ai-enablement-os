import assert from "node:assert/strict";
import test from "node:test";

import { allowedRoles, canRoleAccess, type UserRole } from "../src/lib/rbac.ts";

test("viewer access is available to every authenticated role", () => {
  for (const role of allowedRoles) {
    assert.equal(canRoleAccess(role, "viewer"), true, `${role} should be able to view`);
  }
});

test("specialized reviewers do not inherit builder or admin write powers", () => {
  const reviewerRoles: UserRole[] = [
    "governance_reviewer",
    "security_reviewer",
    "legal_reviewer",
    "privacy_reviewer",
  ];

  for (const role of reviewerRoles) {
    assert.equal(canRoleAccess(role, "builder"), false, `${role} should not build`);
    assert.equal(canRoleAccess(role, "admin"), false, `${role} should not administer`);
  }
});

test("reviewer lanes stay scoped to their own specialty", () => {
  assert.equal(canRoleAccess("privacy_reviewer", "privacy_reviewer"), true);
  assert.equal(canRoleAccess("privacy_reviewer", "security_reviewer"), false);
  assert.equal(canRoleAccess("security_reviewer", "privacy_reviewer"), false);
  assert.equal(canRoleAccess("legal_reviewer", "governance_reviewer"), false);
});

test("operators can build while admins and enablement directors retain full escalation", () => {
  assert.equal(canRoleAccess("builder", "builder"), true);
  assert.equal(canRoleAccess("ai_product_owner", "builder"), true);
  assert.equal(canRoleAccess("ai_product_owner", "admin"), false);
  assert.equal(canRoleAccess("ai_enablement_director", "builder"), true);
  assert.equal(canRoleAccess("ai_enablement_director", "privacy_reviewer"), true);
  assert.equal(canRoleAccess("admin", "admin"), true);
  assert.equal(canRoleAccess("admin", "privacy_reviewer"), true);
});
