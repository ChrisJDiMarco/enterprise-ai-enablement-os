import { test } from "node:test";
import assert from "node:assert/strict";
import { clientKey, evaluateOrigin, routeLimit, trustedOrigins } from "../src/lib/api-protection.ts";

function headers(values: Record<string, string | undefined>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

test("evaluateOrigin: blocks missing production mutation origin", () => {
  const decision = evaluateOrigin({
    origin: null,
    requestOrigin: "https://app.example.com",
    method: "POST",
    env: { NODE_ENV: "production" },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "missing_origin");
});

test("evaluateOrigin: allows configured trusted origin", () => {
  const decision = evaluateOrigin({
    origin: "https://customer.example.com",
    requestOrigin: "https://app.example.com",
    method: "PUT",
    env: { NODE_ENV: "production", API_TRUSTED_ORIGINS: "https://customer.example.com" },
  });

  assert.equal(decision.allowed, true);
});

test("evaluateOrigin: rejects untrusted origin", () => {
  const decision = evaluateOrigin({
    origin: "https://evil.example.com",
    requestOrigin: "https://app.example.com",
    method: "PATCH",
    env: { NODE_ENV: "production", API_TRUSTED_ORIGINS: "https://customer.example.com" },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "origin_not_trusted");
});

test("routeLimit: sensitive routes get tighter limits", () => {
  const env = { API_RATE_LIMIT_MAX: "180" };
  assert.equal(routeLimit("/api/auth/login", "POST", env).maxRequests, 20);
  assert.equal(routeLimit("/api/tenants", "POST", env).maxRequests, 20);
  assert.equal(routeLimit("/api/users", "DELETE", env).maxRequests, 20);
  assert.equal(routeLimit("/api/provisioning/users", "POST", env).maxRequests, 20);
  assert.equal(routeLimit("/api/orchestrator/chat", "POST", env).maxRequests, 90);
  assert.equal(routeLimit("/api/workspace", "PUT", env).maxRequests, 80);
  assert.equal(routeLimit("/api/providers", "GET", env).maxRequests, 180);
});

test("routeLimit: env overrides lane-specific defaults", () => {
  const env = {
    API_RATE_LIMIT_WINDOW_MS: "120000",
    API_AI_RATE_LIMIT_MAX: "12",
    API_WRITE_RATE_LIMIT_MAX: "24",
    API_SENSITIVE_RATE_LIMIT_MAX: "6",
  };

  assert.equal(routeLimit("/api/harness/run", "POST", env).maxRequests, 12);
  assert.equal(routeLimit("/api/audit", "POST", env).maxRequests, 24);
  assert.equal(routeLimit("/api/provider-secrets", "PUT", env).maxRequests, 6);
  assert.equal(routeLimit("/api/harness/run", "POST", env).windowMs, 120000);
});

test("clientKey: includes forwarded IP, tenant hint, route, and optional salt", () => {
  const key = clientKey(
    headers({
      "x-forwarded-for": "203.0.113.5, 10.0.0.1",
      "x-eaieos-tenant": "acme",
    }),
    "/api/workspace",
    { API_RATE_LIMIT_KEY_SALT: "salt" },
  );

  assert.equal(key, "203.0.113.5:acme:/api/workspace:salt");
});

test("trustedOrigins: always includes current request origin", () => {
  const origins = trustedOrigins("https://app.example.com", {
    API_TRUSTED_ORIGINS: "https://customer.example.com",
  });

  assert.equal(origins.has("https://app.example.com"), true);
  assert.equal(origins.has("https://customer.example.com"), true);
});
