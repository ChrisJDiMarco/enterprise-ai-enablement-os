import { test } from "node:test";
import assert from "node:assert/strict";
import { productionStartupIssues } from "../src/lib/startup-validation.ts";

const STRONG_AUTH = "Zx9Z7tq2Vn4pWm8sLk6Rj3Hd1Gf5Yb0Qa2Ue7Ic";
const STRONG_VAULT = "Mk4Pq8Zx2Vn6Wm9sLk3Rj7Hd5Gf1Yb8Qa0Ue4Ic";

const baseProductionEnv = {
  NODE_ENV: "production",
  AUTH_SECRET: STRONG_AUTH,
  TENANT_SECRET_KEY: STRONG_VAULT,
  API_TRUSTED_ORIGINS: "https://app.example.com",
};

test("a fully configured production env has no fatal startup issues", () => {
  assert.deepEqual(productionStartupIssues(baseProductionEnv), []);
});

test("a placeholder AUTH_SECRET is a fatal startup issue", () => {
  const issues = productionStartupIssues({
    ...baseProductionEnv,
    AUTH_SECRET: "change-me-with-a-32-byte-random-secret",
  });
  assert.equal(issues.some((issue) => issue.includes("AUTH_SECRET")), true);
});

test("a missing AUTH_SECRET is a fatal startup issue", () => {
  const issues = productionStartupIssues({ ...baseProductionEnv, AUTH_SECRET: undefined });
  assert.equal(issues.some((issue) => issue.includes("AUTH_SECRET")), true);
});

test("a placeholder TENANT_SECRET_KEY is fatal, but an absent one is not", () => {
  const placeholderIssues = productionStartupIssues({
    ...baseProductionEnv,
    TENANT_SECRET_KEY: "change-me-with-a-32-byte-random-secret",
  });
  assert.equal(placeholderIssues.some((issue) => issue.includes("TENANT_SECRET_KEY")), true);

  const absentIssues = productionStartupIssues({ ...baseProductionEnv, TENANT_SECRET_KEY: undefined });
  assert.equal(absentIssues.some((issue) => issue.includes("TENANT_SECRET_KEY")), false);
});

test("invalid API_TRUSTED_ORIGINS is a fatal startup issue", () => {
  const issues = productionStartupIssues({ ...baseProductionEnv, API_TRUSTED_ORIGINS: "not-a-url" });
  assert.equal(issues.some((issue) => issue.includes("API_TRUSTED_ORIGINS")), true);
});
