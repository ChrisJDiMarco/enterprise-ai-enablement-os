import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultAISettings } from "../src/lib/model-router.ts";
import { mergeRuntimeAISettings } from "../src/lib/server-ai-settings.ts";

test("mergeRuntimeAISettings: uses tenant vault secrets for provider routing", () => {
  const settings = mergeRuntimeAISettings(
    {
      workflowModel: "kimi/kimi-k2.6",
      kimiBaseUrl: "https://tenant-kimi.example/v1",
    },
    {
      KIMI_API_KEY: "tenant-kimi-key",
    },
    {},
  );

  assert.equal(settings.kimiKey, "tenant-kimi-key");
  assert.equal(settings.kimiBaseUrl, "https://tenant-kimi.example/v1");
  assert.equal(settings.workflowModel, "kimi/kimi-k2.6");
});

test("mergeRuntimeAISettings: server secrets override any redacted client key fields", () => {
  const settings = mergeRuntimeAISettings(
    {
      openaiKey: "",
      governanceModel: "glm/glm-5.1",
      glmBaseUrl: defaultAISettings.glmBaseUrl,
    },
    {
      OPENAI_API_KEY: "server-openai-key",
      GLM_API_KEY: "server-glm-key",
    },
    {},
  );

  assert.equal(settings.openaiKey, "server-openai-key");
  assert.equal(settings.glmKey, "server-glm-key");
  assert.equal(settings.governanceModel, "glm/glm-5.1");
});

test("mergeRuntimeAISettings: tenant or env base URLs travel with provider credentials", () => {
  const settings = mergeRuntimeAISettings(
    {},
    {
      OPENAI_API_KEY: "server-openai-key",
      OPENAI_BASE_URL: "https://gateway.example.com/openai/v1",
      ANTHROPIC_API_KEY: "server-anthropic-key",
      ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
      GEMINI_API_KEY: "server-gemini-key",
      GEMINI_BASE_URL: "https://gateway.example.com/google",
    },
    {},
  );

  assert.equal(settings.openaiBaseUrl, "https://gateway.example.com/openai/v1");
  assert.equal(settings.anthropicBaseUrl, "https://gateway.example.com/anthropic");
  assert.equal(settings.googleBaseUrl, "https://gateway.example.com/google");
});

test("mergeRuntimeAISettings: azure is not ready unless both endpoint and key resolve server-side", () => {
  const withoutEndpoint = mergeRuntimeAISettings({}, { AZURE_OPENAI_API_KEY: "azure-key" }, {});
  assert.equal(withoutEndpoint.azureKey, "azure-key");
  assert.equal(withoutEndpoint.azureEndpoint, "");

  const withEndpoint = mergeRuntimeAISettings(
    {},
    {
      AZURE_OPENAI_API_KEY: "azure-key",
      AZURE_OPENAI_ENDPOINT: "https://tenant.openai.azure.com",
    },
    {},
  );
  assert.equal(withEndpoint.azureKey, "azure-key");
  assert.equal(withEndpoint.azureEndpoint, "https://tenant.openai.azure.com");
});
