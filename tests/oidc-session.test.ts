import assert from "node:assert/strict";
import test from "node:test";

import { oidcAuthenticationMeetsMfa, parseOidcStateCookie, sessionUserFromOidcClaims } from "../src/lib/oidc-session.ts";

test("oidcAuthenticationMeetsMfa is permissive when MFA is not required", () => {
  assert.equal(oidcAuthenticationMeetsMfa({ sub: "1" }, {}), true);
});

test("oidcAuthenticationMeetsMfa enforces a per-tenant policy even when env MFA is off", () => {
  // env does not require MFA, but the tenant policy does -> additive, only tightens.
  assert.equal(oidcAuthenticationMeetsMfa({ amr: ["pwd"] }, {}, true), false, "single factor fails under tenant policy");
  assert.equal(oidcAuthenticationMeetsMfa({ amr: ["pwd", "otp"] }, {}, true), true, "MFA amr passes under tenant policy");
  assert.equal(oidcAuthenticationMeetsMfa({ sub: "1" }, {}, false), true, "no policy requirement stays permissive");
});

test("oidcAuthenticationMeetsMfa enforces amr/acr when AUTH_REQUIRE_MFA=true", () => {
  const env = { AUTH_REQUIRE_MFA: "true" };
  assert.equal(oidcAuthenticationMeetsMfa({ amr: ["pwd"] }, env), false, "single factor must fail");
  assert.equal(oidcAuthenticationMeetsMfa({ amr: ["pwd", "otp"] }, env), true, "an MFA amr passes");
  assert.equal(oidcAuthenticationMeetsMfa({ amr: "mfa" }, env), true);
  assert.equal(oidcAuthenticationMeetsMfa({ acr: "urn:okta:loa:2fa" }, env), true, "strong acr passes");
  assert.equal(oidcAuthenticationMeetsMfa({}, env), false, "no factors fail");
});

test("oidcAuthenticationMeetsMfa pins an exact required acr when configured", () => {
  const env = { OIDC_REQUIRED_ACR: "https://schemas.example/loa3" };
  assert.equal(oidcAuthenticationMeetsMfa({ acr: "https://schemas.example/loa3" }, env), true);
  assert.equal(oidcAuthenticationMeetsMfa({ acr: "https://schemas.example/loa1", amr: ["pwd"] }, env), false);
});

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

test("sessionUserFromOidcClaims normalizes safe enterprise tenant identifiers", () => {
  const user = sessionUserFromOidcClaims({
    claims: {
      sub: "oidc-user-2",
      email: "user@example.com",
      eaieos_org_id: " tenant_a.prod-1 ",
    },
  });

  assert.equal(user.organizationId, "tenant_a.prod-1");
});

test("sessionUserFromOidcClaims rejects unsafe tenant identifiers", () => {
  assert.throws(
    () =>
      sessionUserFromOidcClaims({
        claims: {
          sub: "oidc-user-3",
          email: "user@example.com",
          eaieos_org_id: "../../etc/passwd",
        },
      }),
    /OIDC organization claim/,
  );

  assert.throws(
    () =>
      sessionUserFromOidcClaims({
        claims: {
          sub: "oidc-user-4",
          email: "user@example.com",
          organization_id: "owner@example.com",
        },
      }),
    /OIDC organization claim/,
  );
});

test("sessionUserFromOidcClaims uses DEFAULT_ORGANIZATION_ID when org claim is absent", () => {
  const user = sessionUserFromOidcClaims({
    claims: {
      sub: "oidc-user-5",
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

test("sessionUserFromOidcClaims rejects unsafe DEFAULT_ORGANIZATION_ID fallback", () => {
  assert.throws(
    () =>
      sessionUserFromOidcClaims({
        claims: {
          sub: "oidc-user-6",
          email: "user@example.com",
        },
        env: {
          DEFAULT_ORGANIZATION_ID: "tenant/../../other",
        },
      }),
    /OIDC organization claim/,
  );
});
