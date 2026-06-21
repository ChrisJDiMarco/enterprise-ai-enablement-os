import { test } from "node:test";
import assert from "node:assert/strict";

import { generateWithModelProvider } from "../src/lib/model-provider.ts";
import { normalizeAISettings } from "../src/lib/model-router.ts";

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;

test("generateWithModelProvider omits temperature for OpenAI reasoning models that do not accept it", async () => {
  const requests: unknown[] = [];
  globalThis.fetch = (async (_url, init) => {
    requests.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(
      JSON.stringify({
        output_text: "# AI Brief\n\n## Pilot Scope\nGenerated with provider.",
        status: "completed",
        usage: { input_tokens: 100, output_tokens: 40 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await generateWithModelProvider({
      settings: normalizeAISettings({
        openaiKey: "sk-test",
        reasoningModel: "openai/gpt-5.5",
      }),
      lane: "reasoning",
      system: "Return Markdown only.",
      user: "Create a pilot brief.",
      temperature: 0.25,
      maxTokens: 500,
    });

    assert.equal(result.localFallback, false);
    assert.equal(requests.length, 1);
    assert.equal("temperature" in (requests[0] as Record<string, unknown>), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generateWithModelProvider retries once without temperature when a provider rejects the parameter", async () => {
  const requests: unknown[] = [];
  globalThis.fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    requests.push(body);
    if (requests.length === 1) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Unsupported parameter: 'temperature' is not supported with this model.",
            type: "invalid_request_error",
            param: "temperature",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        output_text: "# AI Brief\n\n## Pilot Scope\nGenerated after retry.",
        status: "completed",
        usage: { input_tokens: 120, output_tokens: 45 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await generateWithModelProvider({
      settings: normalizeAISettings({
        openaiKey: "sk-test",
        reasoningModel: "openai/gpt-4.1",
      }),
      lane: "reasoning",
      system: "Return Markdown only.",
      user: "Create a pilot brief.",
      temperature: 0.25,
      maxTokens: 500,
    });

    assert.equal(result.localFallback, false);
    assert.equal(result.providerError, false);
    assert.equal(requests.length, 2);
    assert.equal("temperature" in (requests[0] as Record<string, unknown>), true);
    assert.equal("temperature" in (requests[1] as Record<string, unknown>), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a configured provider failure surfaces as providerError without leaking the upstream error", async () => {
  const sensitiveDetail = "org_acme_123 over quota at https://internal.billing.example/v1";
  const capturedLogs: string[] = [];
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ error: { message: sensitiveDetail, type: "insufficient_quota" } }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;
  console.error = ((...args: unknown[]) => {
    capturedLogs.push(JSON.stringify(args));
  }) as typeof console.error;

  try {
    const result = await generateWithModelProvider({
      settings: normalizeAISettings({ openaiKey: "sk-test", defaultModel: "openai/gpt-5.4-mini" }),
      lane: "default",
      system: "Return Markdown only.",
      user: "Plan a rollout.",
      maxTokens: 500,
    });

    // Honest degraded state, not a clean "no provider" simulation.
    assert.equal(result.localFallback, true);
    assert.equal(result.providerError, true);
    assert.equal(result.finishReason, "provider_error");
    // The raw upstream error must never reach a client-rendered field.
    assert.equal(result.route.reason.includes(sensitiveDetail), false);
    assert.equal(result.route.reason.includes("billing.example"), false);
    const serializedLogs = capturedLogs.join("\n");
    assert.match(serializedLogs, /ProviderHttpError/);
    assert.match(serializedLogs, /429/);
    assert.match(serializedLogs, /insufficient_quota/);
    assert.equal(serializedLogs.includes(sensitiveDetail), false);
    assert.equal(serializedLogs.includes("org_acme_123"), false);
    assert.equal(serializedLogs.includes("billing.example"), false);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("no configured provider yields an honest local simulation, not a providerError", async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    const result = await generateWithModelProvider({
      settings: normalizeAISettings({}),
      lane: "default",
      system: "Return Markdown only.",
      user: "Plan a rollout.",
    });

    assert.equal(result.localFallback, true);
    assert.equal(result.providerError, false);
    assert.equal(result.finishReason, "local_fallback");
    assert.equal(called, false, "no network call should be made when no provider is configured");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an empty 200 response from a configured provider is treated as a provider error, not a successful run", async () => {
  const capturedLogs: string[] = [];
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ output_text: "", status: "completed", usage: { input_tokens: 10, output_tokens: 0 } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;
  console.error = ((...args: unknown[]) => {
    capturedLogs.push(JSON.stringify(args));
  }) as typeof console.error;

  try {
    const result = await generateWithModelProvider({
      settings: normalizeAISettings({ openaiKey: "sk-test", defaultModel: "openai/gpt-5.4-mini" }),
      lane: "default",
      system: "Return Markdown only.",
      user: "Plan a rollout.",
    });

    assert.equal(result.localFallback, true);
    assert.equal(result.providerError, true);
    assert.match(capturedLogs.join("\n"), /empty response/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
