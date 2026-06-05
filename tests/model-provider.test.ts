import { test } from "node:test";
import assert from "node:assert/strict";

import { generateWithModelProvider } from "../src/lib/model-provider.ts";
import { normalizeAISettings } from "../src/lib/model-router.ts";

const originalFetch = globalThis.fetch;

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
    assert.equal(requests.length, 2);
    assert.equal("temperature" in (requests[0] as Record<string, unknown>), true);
    assert.equal("temperature" in (requests[1] as Record<string, unknown>), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
