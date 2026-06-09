import assert from "node:assert/strict";
import test from "node:test";

import { parseOidcStateCookie, sessionUserFromOidcClaims } from "../src/lib/oidc-session.ts";

const state = "abcdefghijklmnopqrstuvwxyzABCDEF";
const nonce = "ZYXWVUTSRQPONMLKJIHGFEDCBA987654";
const codeVerifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO01";

test("parseOidcStateCookie requires state, nonce, and PKCE verifier", () => {
  assert.deepEqual(parseOidcStateCookie(`${state}.${nonce}.${codeVerifier}`), { state, nonce, codeVerifier });
  assert.equal(parseOidcStateCookie(`${state}.${nonce}`), null);
  assert.equal(parseOidcStateCookie(`${state}.`), null);
  assert.equal(parseOidcStateCookie(`.${nonce}`), null);
  assert.equal(parseOidcStateCookie(`${state}.${nonce}.short`), null);
  assert.equal(parseOidcStateCookie(`${state}.${nonce}.${codeVerifier}.extra`), null);
  assert.equal(parseOidcStateCookie("not valid"), null);
  assert.equal(parseOidcStateCookie(undefined), null);
});

test("sessionUserFromOidcClaims requires stable OIDC subject and email", () => {
  assert.throws(() => sessionUserFromOidcClaims({ claims: { email: "ada@example.com" } }), /sub/);
  assert.throws(() => sessionUserFromOidcClaims({ claims: { sub: "user-1" } }), /email/);
  assert.throws(() => sessionUserFromOidcClaims({ claims: { sub: "user-1", email: "not-email" } }), /valid email/);
});

test("sessionUserFromOidcClaims maps enterprise claims into a session user", () => {
  const user = sessionUserFromOidcClaims({
    claims: {
      sub: "oidc-user-1",
      email: "Ada@Example.COM",
      name: "Ada Lovelace",
      eaieos_org_id: "tenant-a",
      roles: ["viewer", "admin"],
      department: "Data",
    },
  });

  assert.deepEqual(user, {
    id: "oidc-user-1",
    organizationId: "tenant-a",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "viewer",
    department: "Data",
  });
});

test("sessionUserFromOidcClaims uses DEFAULT_ORGANIZATION_ID when org claim is absent", () => {
  const user = sessionUserFromOidcClaims({
    claims: {
      sub: "oidc-user-2",
      email: "user@example.com",
      role: "builder",
    },
    env: {
      DEFAULT_ORGANIZATION_ID: "fallback-tenant",
    },
  });

  assert.equal(user.organizationId, "fallback-tenant");
  assert.equal(user.role, "builder");
});
