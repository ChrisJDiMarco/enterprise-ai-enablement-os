import { test } from "node:test";
import assert from "node:assert/strict";

import {
  __resetSessionRevocationStateForTests,
  isSessionRevoked,
  revokeUserSessions,
} from "../src/lib/session-revocation.ts";

test("isSessionRevoked is false for users with no revocation", async () => {
  delete process.env.DATABASE_URL;
  __resetSessionRevocationStateForTests();
  assert.equal(await isSessionRevoked("org-a", "user-1", Date.now()), false);
});

test("revoking a user invalidates sessions issued at or before the revoke time", async () => {
  delete process.env.DATABASE_URL;
  __resetSessionRevocationStateForTests();

  const issuedAt = 1_000_000;
  await revokeUserSessions("org-a", "user-1", new Date(2_000_000));

  // Session issued before the revoke instant is now revoked.
  assert.equal(await isSessionRevoked("org-a", "user-1", issuedAt), true);
  // A session issued AFTER the revoke instant (a fresh re-login) is valid again.
  assert.equal(await isSessionRevoked("org-a", "user-1", 3_000_000), false);
  // Other users are unaffected.
  assert.equal(await isSessionRevoked("org-a", "user-2", issuedAt), false);
  // Other tenants are unaffected (tenant isolation).
  assert.equal(await isSessionRevoked("org-b", "user-1", issuedAt), false);
});

test("revocation ignores empty identifiers", async () => {
  delete process.env.DATABASE_URL;
  __resetSessionRevocationStateForTests();
  await revokeUserSessions("org-a", "", new Date());
  assert.equal(await isSessionRevoked("org-a", "", Date.now()), false);
});
