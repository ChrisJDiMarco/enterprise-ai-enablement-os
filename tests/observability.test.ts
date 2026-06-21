import test from "node:test";
import assert from "node:assert/strict";

import {
  observabilityConfigFromEnv,
  recordOperationalEvent,
  sanitizeOperationalMetadata,
  sanitizeOperationalText,
} from "../src/lib/observability.ts";

const providerKeyFixture = (value: string) => ["sk", value].join("-");

test("sanitizeOperationalMetadata redacts sensitive keys, values, and unsafe shapes", () => {
  const circular: Record<string, unknown> = { id: "cycle" };
  circular.self = circular;

  const sanitized = sanitizeOperationalMetadata({
    safeCount: 3,
    safeLabel: "workflow-scheduled",
    apiKey: providerKeyFixture("prod-secret-value-that-should-not-leak"),
    userEmail: "person@example.com",
    databaseUrl: "postgres://user:password@db.internal/app",
    phone: "212-555-0101",
    ssn: "123-45-6789",
    card: "4111 1111 1111 1111",
    webhook: "https://hooks.slack.com/services/T000/B000/SECRET_TOKEN_123456789",
    nested: {
      prompt: "Summarize this confidential customer transcript.",
      model: "gpt-5",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    },
    longString: "x".repeat(300),
    sample: Array.from({ length: 25 }, (_, index) => index),
    circular,
  });

  assert.equal(sanitized.safeCount, 3);
  assert.equal(sanitized.safeLabel, "workflow-scheduled");
  assert.equal(sanitized.apiKey, "[redacted]");
  assert.equal(sanitized.userEmail, "[redacted]");
  assert.equal(sanitized.databaseUrl, "[redacted]");
  assert.equal(sanitized.phone, "[redacted]");
  assert.equal(sanitized.ssn, "[redacted]");
  assert.equal(sanitized.card, "[redacted]");
  assert.equal(sanitized.webhook, "[redacted]");
  assert.deepEqual(sanitized.nested, {
    prompt: "[redacted]",
    model: "gpt-5",
    createdAt: "2026-06-01T00:00:00.000Z",
  });
  assert.equal(typeof sanitized.longString, "string");
  assert.equal((sanitized.longString as string).length, 243);
  assert.equal(Array.isArray(sanitized.sample), true);
  assert.equal((sanitized.sample as unknown[]).length, 21);
  assert.equal((sanitized.sample as unknown[]).at(-1), "...5 more");
  assert.deepEqual(sanitized.circular, {
    id: "cycle",
    self: { circular: "[omitted]" },
  });
});

test("sanitizeOperationalText redacts unsafe event names, routes, and actors", () => {
  assert.equal(sanitizeOperationalText("operator@example.com", "Unknown actor"), "[redacted]");
  assert.equal(sanitizeOperationalText("/api/run?token=SECRET_TOKEN_123456789", "unknown-route"), "[redacted]");
  assert.equal(sanitizeOperationalText("workflow.completed", "operational.event"), "workflow.completed");
});

test("recordOperationalEvent sends only sanitized metadata to log drains", async () => {
  const originalFetch = globalThis.fetch;
  const received: Array<{ body: unknown; authorization?: string }> = [];

  globalThis.fetch = (async (_url, init) => {
    received.push({
      body: JSON.parse(String(init?.body)),
      authorization: init?.headers && typeof init.headers === "object" && !Array.isArray(init.headers)
        ? (init.headers as Record<string, string>).Authorization
        : undefined,
    });
    return new Response(null, { status: 202 });
  }) as typeof fetch;

  try {
    const delivery = await recordOperationalEvent({
      organizationId: "tenant-person@example.com",
      name: "observability.test person@example.com",
      level: "warn",
      route: "/api/test?token=SECRET_TOKEN_123456789",
      actor: "operator@example.com",
      metadata: {
        status: "queued",
        accessToken: "secret-token",
        userEmail: "operator@example.com",
        phone: "212-555-0101",
        rawResponseBody: { error: "postgres://user:password@db.internal failed" },
      },
      env: {
        LOG_DRAIN_URL: "https://logs.example.com/events",
        LOG_DRAIN_TOKEN: "drain-token",
        NODE_ENV: "production",
      },
    });

    assert.equal(delivery.delivered, true);
    assert.equal(delivery.sink, "log-drain");
    assert.equal(received.length, 1);
    assert.equal(received[0]?.authorization, "Bearer drain-token");
    const serializedBody = JSON.stringify(received[0]?.body);
    assert.equal(serializedBody.includes("secret-token"), false);
    assert.equal(serializedBody.includes("operator@example.com"), false);
    assert.equal(serializedBody.includes("person@example.com"), false);
    assert.equal(serializedBody.includes("SECRET_TOKEN"), false);
    assert.equal(serializedBody.includes("212-555-0101"), false);
    assert.equal(serializedBody.includes("postgres://"), false);
    assert.equal(delivery.event.organizationId, "[redacted]");
    assert.equal(delivery.event.name, "[redacted]");
    assert.equal(delivery.event.route, "[redacted]");
    assert.equal(delivery.event.actor, "[redacted]");
    assert.deepEqual(delivery.event.metadata, {
      status: "queued",
      accessToken: "[redacted]",
      userEmail: "[redacted]",
      phone: "[redacted]",
      rawResponseBody: "[redacted]",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("observabilityConfigFromEnv ignores malformed production log drains", () => {
  const config = observabilityConfigFromEnv({
    NODE_ENV: "production",
    LOG_DRAIN_URL: "http://logs.example.com/ingest?api_key=secret",
  });

  assert.equal(config.configured, false);
  assert.equal(config.mode, "missing");
  assert.deepEqual(config.sinks, []);
  assert.match(config.reason, /Telemetry configuration is invalid/i);
  assert.match(config.reason, /LOG_DRAIN_URL is ignored/i);
});

test("observabilityConfigFromEnv validates OTEL and Sentry telemetry declarations", () => {
  const invalid = observabilityConfigFromEnv({
    NODE_ENV: "production",
    OTEL_EXPORTER_OTLP_ENDPOINT: "not-a-url",
    SENTRY_DSN: "not-a-dsn",
  });
  const mixed = observabilityConfigFromEnv({
    NODE_ENV: "production",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com/v1/traces",
    SENTRY_DSN: "not-a-dsn",
  });
  const sentry = observabilityConfigFromEnv({
    NODE_ENV: "production",
    SENTRY_DSN: "https://public@sentry.example.com/123",
  });

  assert.equal(invalid.configured, false);
  assert.equal(invalid.mode, "missing");
  assert.deepEqual(invalid.sinks, []);
  assert.match(invalid.reason, /OTEL_EXPORTER_OTLP_ENDPOINT is ignored/i);
  assert.match(invalid.reason, /SENTRY_DSN is ignored/i);

  assert.equal(mixed.configured, true);
  assert.equal(mixed.mode, "external-telemetry-declared");
  assert.deepEqual(mixed.sinks, ["otel"]);
  assert.match(mixed.reason, /SENTRY_DSN is ignored/i);

  assert.equal(sentry.configured, true);
  assert.equal(sentry.mode, "external-telemetry-declared");
  assert.deepEqual(sentry.sinks, ["sentry"]);
});

test("recordOperationalEvent rejects malformed log drains before fetch", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response(null, { status: 202 });
  }) as typeof fetch;

  try {
    const delivery = await recordOperationalEvent({
      organizationId: "tenant-1",
      name: "observability.invalid_log_drain",
      metadata: { status: "queued" },
      env: {
        NODE_ENV: "production",
        LOG_DRAIN_URL: "https://logs.example.com/ingest?token=SECRET_TOKEN_123456789",
        LOG_DRAIN_TOKEN: "drain-token",
      },
    });

    assert.equal(fetchCalled, false);
    assert.equal(delivery.delivered, false);
    assert.equal(delivery.sink, "log-drain");
    assert.match(delivery.error ?? "", /LOG_DRAIN_URL is invalid/i);
    assert.equal(JSON.stringify(delivery).includes("SECRET_TOKEN"), false);
    assert.equal(JSON.stringify(delivery).includes("drain-token"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recordOperationalEvent keeps log drain failures generic", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED token secret-token at /Users/operator/project");
  }) as typeof fetch;

  try {
    const delivery = await recordOperationalEvent({
      organizationId: "tenant-1",
      name: "observability.test.failure",
      metadata: { status: "queued" },
      env: {
        LOG_DRAIN_URL: "https://logs.example.com/events",
        NODE_ENV: "production",
      },
    });

    assert.equal(delivery.delivered, false);
    assert.equal(delivery.sink, "log-drain");
    assert.equal(delivery.error, "Log drain is unavailable or returned an error.");
    assert.equal(JSON.stringify(delivery).includes("secret-token"), false);
    assert.equal(JSON.stringify(delivery).includes("/Users/operator"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
