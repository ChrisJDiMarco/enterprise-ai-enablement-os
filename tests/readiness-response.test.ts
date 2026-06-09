import assert from "node:assert/strict";
import test from "node:test";

import { buildPublicReadinessResponse } from "../src/lib/readiness-response.ts";

test("buildPublicReadinessResponse returns only sign-in safe auth readiness", () => {
  const response = buildPublicReadinessResponse({
    generatedAt: "2026-06-06T17:30:00.000Z",
    env: {
      NODE_ENV: "production",
      AUTH_REQUIRED: "true",
    },
  });

  assert.equal(response.schema, "enterprise-ai-enablement-os.production-readiness.v1");
  assert.equal(response.public, true);
  assert.equal(response.generatedAt, "2026-06-06T17:30:00.000Z");
  assert.equal(response.status, "blocked");
  assert.equal(response.auth.authRequired, true);
  assert.equal(response.auth.oidcConfigured, false);
  assert.equal(response.auth.issueCount, 2);
  assert.equal("issues" in response.auth, false);
  assert.equal("warnings" in response.auth, false);
  assert.equal(response.session, null);
  assert.equal(response.tenantEvidence.loaded, false);
  assert.ok(response.blockers.some((blocker) => blocker.detail.includes("workspace administrator")));

  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("AUTH_SECRET"), false);
  assert.equal(serialized.includes("OIDC_"), false);
  assert.equal(serialized.includes("OIDC is not configured"), false);
  assert.equal(serialized.includes("providers"), false);
  assert.equal(serialized.includes("connectors"), false);
  assert.equal(serialized.includes("manualActions"), false);
  assert.equal(serialized.includes("customerLaunchContract"), false);
  assert.equal(serialized.includes("secretVault"), false);
  assert.equal(serialized.includes("database"), false);
});

test("buildPublicReadinessResponse keeps local login status available to the auth gate", () => {
  const response = buildPublicReadinessResponse({
    env: {
      NODE_ENV: "development",
      AUTH_REQUIRED: "false",
    },
  });

  assert.equal(response.status, "degraded");
  assert.equal(response.auth.localLoginEnabled, true);
  assert.equal(response.auth.mode, "local-admin-dev");
  assert.equal(response.auth.warningCount, 1);
  assert.equal(response.blockers.length, 0);
  assert.ok(response.warnings.some((warning) => warning.detail.includes("non-standard sign-in mode")));
  assert.equal(JSON.stringify(response).includes("local development auth secret"), false);
});
