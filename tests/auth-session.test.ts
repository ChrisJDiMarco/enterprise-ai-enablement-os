import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccess,
  createSession,
  createSessionToken,
  parseSessionToken,
  type Session,
  type SessionUser,
} from "../src/lib/auth-session.ts";

const user: SessionUser = {
  id: "user-1",
  organizationId: "tenant-1",
  name: "Ada Lovelace",
  email: "Ada@Example.COM",
  role: "builder",
  department: "Data",
};

test("parseSessionToken accepts and normalizes a well-formed signed session", () => {
  const token = createSessionToken(createSession(user));
  const session = parseSessionToken(token);

  assert.equal(session?.user.id, "user-1");
  assert.equal(session?.user.email, "ada@example.com");
  assert.equal(session?.user.role, "builder");
});

test("parseSessionToken rejects valid signatures with extra token segments", () => {
  const token = createSessionToken(createSession(user));

  assert.equal(parseSessionToken(`${token}.extra`), null);
});

test("parseSessionToken rejects malformed signed payloads", () => {
  const baseline = createSession(user);
  const invalidRole = createSessionToken({
    ...baseline,
    user: { ...baseline.user, role: "super_admin" },
  } as unknown as Session);
  const invalidEmail = createSessionToken({
    ...baseline,
    user: { ...baseline.user, email: "not-email" },
  } as unknown as Session);
  const missingUser = createSessionToken({
    issuedAt: baseline.issuedAt,
    expiresAt: baseline.expiresAt,
  } as unknown as Session);
  const excessiveLifetime = createSessionToken({
    ...baseline,
    expiresAt: baseline.issuedAt + 31 * 24 * 60 * 60 * 1000,
  });

  assert.equal(parseSessionToken(invalidRole), null);
  assert.equal(parseSessionToken(invalidEmail), null);
  assert.equal(parseSessionToken(missingUser), null);
  assert.equal(parseSessionToken(excessiveLifetime), null);
});

test("parseSessionToken rejects expired or impossible signed sessions", () => {
  const now = Date.now();
  const expired = createSessionToken({
    user,
    issuedAt: now - 10_000,
    expiresAt: now - 1_000,
  });
  const futureIssued = createSessionToken({
    user,
    issuedAt: now + 10 * 60 * 1000,
    expiresAt: now + 20 * 60 * 1000,
  });
  const backwards = createSessionToken({
    user,
    issuedAt: now,
    expiresAt: now - 1,
  });

  assert.equal(parseSessionToken(expired), null);
  assert.equal(parseSessionToken(futureIssued), null);
  assert.equal(parseSessionToken(backwards), null);
});

test("canAccess fails closed for runtime-invalid roles", () => {
  const session = {
    ...createSession(user),
    user: { ...user, role: "super_admin" },
  } as unknown as Session;

  assert.equal(canAccess(session, "viewer"), false);
});
