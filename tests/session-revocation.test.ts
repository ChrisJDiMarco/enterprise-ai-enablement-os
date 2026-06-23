import { test } from "node:test";
import assert from "node:assert/strict";

import {
  __resetSessionRevocationStateForTests,
  isSessionRevoked,
  revokeUserSessions,
  SessionRevocationUnavailableError,
} from "../src/lib/session-revocation.ts";

// A pool whose every operation rejects, simulating an unreachable revocation store.
const failingPool = {
  connect: async () => {
    throw new Error("db down");
  },
  query: async () => {
    throw new Error("db down");
  },
} as unknown as Parameters<typeof isSessionRevoked>[3];

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

test("fails closed when the store is unavailable and the cache is cold", async () => {
  __resetSessionRevocationStateForTests();
  await assert.rejects(
    () => isSessionRevoked("org-cold", "user-1", Date.now(), failingPool),
    (error: unknown) => error instanceof SessionRevocationUnavailableError,
  );
});

test("does not lock out a tenant whose revocations are already cached", async () => {
  delete process.env.DATABASE_URL;
  __resetSessionRevocationStateForTests();
  await revokeUserSessions("org-warm", "user-1", new Date(2_000_000));
  // Populate the per-org read cache via the no-DB path.
  assert.equal(await isSessionRevoked("org-warm", "user-1", 1_000_000), true);
  // With the cache warm, a failing store is not consulted — no lockout, no throw.
  assert.equal(await isSessionRevoked("org-warm", "user-1", 1_000_000, failingPool), true);
  assert.equal(await isSessionRevoked("org-warm", "user-2", 1_000_000, failingPool), false);
});

test("revocation ignores empty identifiers", async () => {
  delete process.env.DATABASE_URL;
  __resetSessionRevocationStateForTests();
  await revokeUserSessions("org-a", "", new Date());
  assert.equal(await isSessionRevoked("org-a", "", Date.now()), false);
});
