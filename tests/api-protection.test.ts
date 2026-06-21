import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientKey,
  evaluateOrigin,
  evaluatePayloadSize,
  isMutationMethod,
  normalizeRequestId,
  routeLimit,
  shouldBypassMutationOriginGuard,
  trustedOrigins,
} from "../src/lib/api-protection.ts";

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

test("evaluateOrigin: allows loopback origin aliases outside production", () => {
  const decision = evaluateOrigin({
    origin: "http://localhost:3007",
    requestOrigin: "http://127.0.0.1:3007",
    method: "POST",
    env: { NODE_ENV: "development" },
  });

  assert.equal(decision.allowed, true);
});

test("evaluateOrigin: keeps loopback aliases strict in production", () => {
  const decision = evaluateOrigin({
    origin: "http://localhost:3007",
    requestOrigin: "http://127.0.0.1:3007",
    method: "POST",
    env: { NODE_ENV: "production" },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "origin_not_trusted");
});

test("isMutationMethod identifies API write methods", () => {
  assert.equal(isMutationMethod("POST"), true);
  assert.equal(isMutationMethod("put"), true);
  assert.equal(isMutationMethod("PATCH"), true);
  assert.equal(isMutationMethod("DELETE"), true);
  assert.equal(isMutationMethod("GET"), false);
});

test("shouldBypassMutationOriginGuard is limited to bearer provisioning calls", () => {
  assert.equal(
    shouldBypassMutationOriginGuard({
      pathname: "/api/provisioning/users",
      authorizationHeader: "Bearer machine-token",
    }),
    true,
  );
  assert.equal(
    shouldBypassMutationOriginGuard({
      pathname: "/api/provisioning/users",
      authorizationHeader: null,
    }),
    false,
  );
  assert.equal(
    shouldBypassMutationOriginGuard({
      pathname: "/api/users",
      authorizationHeader: "Bearer machine-token",
    }),
    false,
  );
});

test("evaluatePayloadSize enforces body limits for every mutation method", () => {
  assert.deepEqual(
    evaluatePayloadSize({
      contentLength: "51",
      method: "POST",
      env: { API_MAX_BODY_BYTES: "50" },
    }),
    {
      allowed: false,
      reason: "payload_too_large",
      contentLength: 51,
      maxBodyBytes: 50,
    },
  );

  assert.equal(
    evaluatePayloadSize({
      contentLength: "51",
      method: "GET",
      env: { API_MAX_BODY_BYTES: "50" },
    }).allowed,
    true,
  );
});

test("evaluatePayloadSize rejects invalid Content-Length on mutations", () => {
  const decision = evaluatePayloadSize({
    contentLength: "not-a-number",
    method: "DELETE",
    env: { API_MAX_BODY_BYTES: "50" },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "invalid_content_length");
  assert.equal(decision.maxBodyBytes, 50);
});

test("evaluatePayloadSize requires Content-Length for production mutations", () => {
  const production = evaluatePayloadSize({
    contentLength: null,
    method: "POST",
    env: { NODE_ENV: "production", API_MAX_BODY_BYTES: "50" },
  });

  assert.equal(production.allowed, false);
  assert.equal(production.reason, "missing_content_length");
  assert.equal(production.maxBodyBytes, 50);

  const development = evaluatePayloadSize({
    contentLength: null,
    method: "POST",
    env: { NODE_ENV: "development", API_MAX_BODY_BYTES: "50" },
  });

  assert.equal(development.allowed, true);
});

test("evaluatePayloadSize rejects streaming mutation bodies before route handling", () => {
  const decision = evaluatePayloadSize({
    contentLength: null,
    transferEncoding: "chunked",
    method: "POST",
    env: { NODE_ENV: "development", API_MAX_BODY_BYTES: "50" },
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "streaming_body_not_allowed");
  assert.equal(decision.maxBodyBytes, 50);
});

test("routeLimit: sensitive routes get tighter limits", () => {
  const env = { API_RATE_LIMIT_MAX: "180" };
  assert.equal(routeLimit("/api/auth/login", "POST", env).maxRequests, 20);
  assert.equal(routeLimit("/api/tenants", "POST", env).maxRequests, 20);
  assert.equal(routeLimit("/api/users", "DELETE", env).maxRequests, 20);
  assert.equal(routeLimit("/api/provisioning/users", "POST", env).maxRequests, 20);
  assert.equal(routeLimit("/api/orchestrator/chat", "POST", env).maxRequests, 90);
  assert.equal(routeLimit("/api/workspace", "PUT", env).maxRequests, 240);
  assert.equal(routeLimit("/api/workspace/commands", "POST", env).maxRequests, 80);
  assert.equal(routeLimit("/api/providers", "GET", env).maxRequests, 180);
});

test("routeLimit: env overrides lane-specific defaults", () => {
  const env = {
    API_RATE_LIMIT_WINDOW_MS: "120000",
    API_AI_RATE_LIMIT_MAX: "12",
    API_WORKSPACE_RATE_LIMIT_MAX: "48",
    API_WRITE_RATE_LIMIT_MAX: "24",
    API_SENSITIVE_RATE_LIMIT_MAX: "6",
  };

  assert.equal(routeLimit("/api/harness/run", "POST", env).maxRequests, 12);
  assert.equal(routeLimit("/api/workspace", "PUT", env).maxRequests, 48);
  assert.equal(routeLimit("/api/audit", "POST", env).maxRequests, 24);
  assert.equal(routeLimit("/api/provider-secrets", "PUT", env).maxRequests, 6);
  assert.equal(routeLimit("/api/provider-secrets", "DELETE", env).maxRequests, 6);
  assert.equal(routeLimit("/api/harness/run", "POST", env).windowMs, 120000);
});

test("clientKey: ignores caller-controlled tenant hints on ordinary API routes", () => {
  const key = clientKey(
    headers({
      "x-forwarded-for": "203.0.113.5, 10.0.0.1",
      "x-eaieos-tenant": "acme",
    }),
    "/api/workspace",
    { API_RATE_LIMIT_KEY_SALT: "salt" },
  );
  const rotatedTenantKey = clientKey(
    headers({
      "x-forwarded-for": "203.0.113.5, 10.0.0.1",
      "x-eaieos-tenant": "different-tenant",
    }),
    "/api/workspace",
    { API_RATE_LIMIT_KEY_SALT: "salt" },
  );

  assert.equal(key, "203.0.113.5:public:/api/workspace:salt");
  assert.equal(rotatedTenantKey, key);
});

test("clientKey: tenant partitions are limited to machine provisioning routes", () => {
  const tenantA = clientKey(
    headers({
      "x-real-ip": "203.0.113.5",
      "x-eaieos-tenant": "acme",
    }),
    "/api/provisioning/users",
  );
  const tenantB = clientKey(
    headers({
      "x-real-ip": "203.0.113.5",
      "x-eaieos-tenant": "globex",
    }),
    "/api/provisioning/users",
  );

  assert.equal(tenantA, "203.0.113.5:acme:/api/provisioning/users");
  assert.equal(tenantB, "203.0.113.5:globex:/api/provisioning/users");
  assert.notEqual(tenantA, tenantB);
});

test("clientKey: bounds and normalizes untrusted header material", () => {
  const key = clientKey(
    headers({
      "x-forwarded-for": `${"203.0.113.5\nspoof".repeat(30)}, 10.0.0.1`,
      "x-eaieos-tenant": "../tenant\nwith spaces",
    }),
    "/api/provisioning/users",
  );

  assert.equal(key.includes("\n"), false);
  assert.equal(key.includes(" "), false);
  assert.match(key, /^203\.0\.113\.5_spoof203\.0\.113\.5_spoof/);
  assert.ok(key.length < 300);
});

test("normalizeRequestId returns a header-safe bounded request id", () => {
  const normalized = normalizeRequestId(`  req-123\nSet-Cookie: yes ${"x".repeat(200)}  `);

  assert.equal(normalized.includes("\n"), false);
  assert.equal(normalized.includes(" "), false);
  assert.match(normalized, /^req-123_Set-Cookie:_yes_/);
  assert.equal(normalized.length, 120);
  assert.equal(normalizeRequestId("   "), "");
  assert.equal(normalizeRequestId(null), "");
});

test("trustedOrigins: always includes current request origin", () => {
  const origins = trustedOrigins("https://app.example.com", {
    API_TRUSTED_ORIGINS: "https://customer.example.com",
  });

  assert.equal(origins.has("https://app.example.com"), true);
  assert.equal(origins.has("https://customer.example.com"), true);
});

test("trustedOrigins: includes local loopback aliases outside production only", () => {
  const developmentOrigins = trustedOrigins("http://127.0.0.1:3007", { NODE_ENV: "development" });
  assert.equal(developmentOrigins.has("http://localhost:3007"), true);
  assert.equal(developmentOrigins.has("http://[::1]:3007"), true);

  const productionOrigins = trustedOrigins("http://127.0.0.1:3007", { NODE_ENV: "production" });
  assert.equal(productionOrigins.has("http://localhost:3007"), false);
  assert.equal(productionOrigins.has("http://[::1]:3007"), false);
});
