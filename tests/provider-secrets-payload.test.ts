import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultAISettings } from "../src/lib/model-router.ts";
import { providerSecretsPayload } from "../src/lib/provider-secrets-payload.ts";

test("providerSecretsPayload: exports only configured non-empty secrets", () => {
  const payload = providerSecretsPayload({
    ...defaultAISettings,
    openaiKey: "  sk-openai  ",
    anthropicKey: "",
    kimiKey: " kimi-secret ",
    azureEndpoint: " ",
  });

  assert.deepEqual(payload, {
    OPENAI_API_KEY: "sk-openai",
    OPENAI_BASE_URL: defaultAISettings.openaiBaseUrl,
    KIMI_API_KEY: "kimi-secret",
    KIMI_BASE_URL: defaultAISettings.kimiBaseUrl,
  });
});

test("providerSecretsPayload: does not persist base URLs unless the provider key is present", () => {
  const payload = providerSecretsPayload({
    ...defaultAISettings,
    kimiBaseUrl: "https://custom.kimi.example/v1",
    glmBaseUrl: "https://custom.glm.example/v1",
  });

  assert.deepEqual(payload, {});
});
