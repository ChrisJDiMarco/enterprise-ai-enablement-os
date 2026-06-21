import assert from "node:assert/strict";
import test from "node:test";

import {
  authConfigurationIssues,
  authReadiness,
  publicAuthReadiness,
  productionLocalLoginTokenConfigured,
} from "../src/lib/auth-readiness.ts";
import {
  localLoginRequestToken,
  productionLocalLoginGuard,
  productionLocalLoginTokenMatches,
} from "../src/lib/local-login.ts";
import { getProductionReadiness } from "../src/lib/production-readiness.ts";
import { localLoginInputSchema } from "../src/lib/api-validation.ts";

test("localLoginInputSchema accepts a well-formed identity and a valid role", () => {
  const parsed = localLoginInputSchema.safeParse({
    id: "u-1",
    organizationId: "acme-corp",
    name: "Dana Lee",
    email: "dana@acme.test",
    role: "governance_reviewer",
    department: "Compliance",
  });
  assert.equal(parsed.success, true);
});

test("localLoginInputSchema rejects an unbounded name and a malformed email before session minting", () => {
  const longName = localLoginInputSchema.safeParse({ name: "x".repeat(5000) });
  assert.equal(longName.success, false);

  const badEmail = localLoginInputSchema.safeParse({ email: "not-an-email" });
  assert.equal(badEmail.success, false);
});

test("localLoginInputSchema rejects an injection-shaped organizationId and an unknown role", () => {
  const badOrg = localLoginInputSchema.safeParse({ organizationId: "../../etc/passwd" });
  assert.equal(badOrg.success, false);

  const badRole = localLoginInputSchema.safeParse({ role: "superadmin" });
  assert.equal(badRole.success, false);
});

test("localLoginInputSchema tolerates emergency-token fields alongside identity (not strict)", () => {
  const parsed = localLoginInputSchema.safeParse({ name: "Ops", localLoginToken: "secret-token" });
  assert.equal(parsed.success, true);
});

function headers(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

async function withEnv<T>(overrides: Record<string, string | undefined>, callback: () => T | Promise<T>) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("auth readiness blocks production local login when the emergency token is missing", () => {
  const env = {
    NODE_ENV: "production",
    AUTH_REQUIRED: "true",
    LOCAL_LOGIN_ENABLED: "true",
    AUTH_SECRET: "session-secret",
  };

  const issues = authConfigurationIssues(env);
  const readiness = authReadiness(env);

  assert.equal(productionLocalLoginTokenConfigured(env), false);
  assert.equal(readiness.mode, "signed-cookie-required");
  assert.ok(issues.issues.some((issue) => issue.includes("LOCAL_LOGIN_TOKEN")));
});

test("auth readiness marks configured production local login as emergency mode", () => {
  const readiness = authReadiness({
    NODE_ENV: "production",
    AUTH_REQUIRED: "true",
    LOCAL_LOGIN_ENABLED: "true",
    AUTH_SECRET: "session-secret",
    LOCAL_LOGIN_TOKEN: "emergency-token",
  });

  assert.equal(readiness.mode, "emergency-local-login");
  assert.equal(readiness.issues.length, 0);
  assert.ok(readiness.warnings.some((warning) => warning.includes("LOCAL_LOGIN_ENABLED")));
});

test("production readiness fails the auth gate when emergency local login is unguarded", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      AUTH_REQUIRED: "true",
      LOCAL_LOGIN_ENABLED: "true",
      AUTH_SECRET: "session-secret",
      NEXTAUTH_SECRET: undefined,
      LOCAL_LOGIN_TOKEN: undefined,
      EMERGENCY_LOCAL_LOGIN_TOKEN: undefined,
      EMERGENCY_ACCESS_TOKEN: undefined,
      OIDC_ISSUER: undefined,
      OIDC_CLIENT_ID: undefined,
      OIDC_CLIENT_SECRET: undefined,
    },
    () => {
      const readiness = getProductionReadiness();
      const check = readiness.checks.find((item) => item.id === "auth-required");

      assert.equal(check?.status, "fail");
      assert.match(check?.detail ?? "", /LOCAL_LOGIN_TOKEN/);
      assert.equal(readiness.blockers.some((item) => item.id === "auth-required"), true);
    },
  );
});

test("production local login guard requires the configured token only in production emergency mode", () => {
  const env = {
    NODE_ENV: "production",
    LOCAL_LOGIN_ENABLED: "true",
    LOCAL_LOGIN_TOKEN: "known-token",
  };

  assert.deepEqual(productionLocalLoginGuard({ env: { NODE_ENV: "development" } }), { ok: true });
  assert.equal(productionLocalLoginGuard({ env }).ok, false);
  assert.equal(productionLocalLoginGuard({ env, providedToken: "wrong-token" }).ok, false);
  assert.deepEqual(productionLocalLoginGuard({ env, providedToken: "known-token" }), { ok: true });
  assert.equal(productionLocalLoginTokenMatches({ env, providedToken: "known-token" }), true);
});

test("public auth readiness redacts raw operator diagnostics", () => {
  const readiness = publicAuthReadiness({
    NODE_ENV: "production",
    AUTH_REQUIRED: "true",
    LOCAL_LOGIN_ENABLED: "true",
    AUTH_SECRET: "session-secret",
    LOCAL_LOGIN_TOKEN: "emergency-token",
  });

  assert.equal(readiness.mode, "emergency-local-login");
  assert.equal(readiness.issueCount, 0);
  assert.equal(readiness.warningCount, 1);
  assert.equal("issues" in readiness, false);
  assert.equal("warnings" in readiness, false);
  assert.equal(JSON.stringify(readiness).includes("LOCAL_LOGIN_ENABLED"), false);
});

test("localLoginRequestToken accepts header, bearer, and body tokens", () => {
  assert.equal(
    localLoginRequestToken({
      headers: headers({ "x-eaieos-local-login-token": "header-token" }),
      body: { localLoginToken: "body-token" },
    }),
    "header-token",
  );
  assert.equal(
    localLoginRequestToken({
      headers: headers({ authorization: "Bearer bearer-token" }),
    }),
    "bearer-token",
  );
  assert.equal(
    localLoginRequestToken({
      headers: headers({}),
      body: { emergencyAccessToken: "body-emergency-token" },
    }),
    "body-emergency-token",
  );
});
