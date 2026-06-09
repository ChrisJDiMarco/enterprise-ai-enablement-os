import test from "node:test";
import assert from "node:assert/strict";

import {
  recordOperationalEvent,
  sanitizeOperationalMetadata,
} from "../src/lib/observability.ts";

test("sanitizeOperationalMetadata redacts sensitive keys, values, and unsafe shapes", () => {
  const circular: Record<string, unknown> = { id: "cycle" };
  circular.self = circular;

  const sanitized = sanitizeOperationalMetadata({
    safeCount: 3,
    safeLabel: "workflow-scheduled",
    apiKey: "sk-prod-secret-value-that-should-not-leak",
    userEmail: "person@example.com",
    databaseUrl: "postgres://user:password@db.internal/app",
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
      organizationId: "tenant-1",
      name: "observability.test",
      level: "warn",
      route: "/api/test",
      actor: "Operator",
      metadata: {
        status: "queued",
        accessToken: "secret-token",
        userEmail: "operator@example.com",
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
    assert.equal(JSON.stringify(received[0]?.body).includes("secret-token"), false);
    assert.equal(JSON.stringify(received[0]?.body).includes("operator@example.com"), false);
    assert.equal(JSON.stringify(received[0]?.body).includes("postgres://"), false);
    assert.deepEqual(delivery.event.metadata, {
      status: "queued",
      accessToken: "[redacted]",
      userEmail: "[redacted]",
      rawResponseBody: "[redacted]",
    });
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
