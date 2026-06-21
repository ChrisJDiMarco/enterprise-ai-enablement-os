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
      KIMI_BASE_URL: "https://tenant-kimi.example/v1",
    },
    {},
  );

  assert.equal(settings.kimiKey, "tenant-kimi-key");
  assert.equal(settings.kimiBaseUrl, "https://tenant-kimi.example/v1");
  assert.equal(settings.workflowModel, "kimi/kimi-k2.6");
});

test("mergeRuntimeAISettings: ignores client-submitted provider endpoints", () => {
  const settings = mergeRuntimeAISettings(
    {
      openaiBaseUrl: "https://attacker.example/openai",
      anthropicBaseUrl: "https://attacker.example/anthropic",
      googleBaseUrl: "https://attacker.example/google",
      kimiBaseUrl: "https://attacker.example/kimi",
      glmBaseUrl: "https://attacker.example/glm",
      deepseekBaseUrl: "https://attacker.example/deepseek",
      openrouterBaseUrl: "https://attacker.example/openrouter",
      defaultModel: "openai/gpt-5.5",
    },
    {
      OPENAI_API_KEY: "server-openai-key",
      ANTHROPIC_API_KEY: "server-anthropic-key",
      GOOGLE_API_KEY: "server-google-key",
      KIMI_API_KEY: "server-kimi-key",
      GLM_API_KEY: "server-glm-key",
      DEEPSEEK_API_KEY: "server-deepseek-key",
      OPENROUTER_API_KEY: "server-openrouter-key",
    },
    {},
  );
  const serialized = JSON.stringify(settings);

  assert.equal(settings.openaiBaseUrl, defaultAISettings.openaiBaseUrl);
  assert.equal(settings.anthropicBaseUrl, defaultAISettings.anthropicBaseUrl);
  assert.equal(settings.googleBaseUrl, defaultAISettings.googleBaseUrl);
  assert.equal(settings.kimiBaseUrl, defaultAISettings.kimiBaseUrl);
  assert.equal(settings.glmBaseUrl, defaultAISettings.glmBaseUrl);
  assert.equal(settings.deepseekBaseUrl, defaultAISettings.deepseekBaseUrl);
  assert.equal(settings.openrouterBaseUrl, defaultAISettings.openrouterBaseUrl);
  assert.equal(settings.defaultModel, "openai/gpt-5.5");
  assert.equal(serialized.includes("attacker.example"), false);
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

test("mergeRuntimeAISettings: ignores malformed runtime provider endpoints", () => {
  const settings = mergeRuntimeAISettings(
    {},
    {
      OPENAI_API_KEY: "server-openai-key",
      OPENAI_BASE_URL: "https://user:pass@gateway.example.com/openai",
      GOOGLE_API_KEY: "server-google-key",
      GOOGLE_AI_BASE_URL: "https://gateway.example.com/google?api_key=secret",
      GEMINI_BASE_URL: "https://gateway.example.com/gemini",
      AZURE_OPENAI_API_KEY: "azure-key",
      AZURE_OPENAI_ENDPOINT: "http://tenant.openai.azure.com",
    },
    {},
  );

  assert.equal(settings.openaiBaseUrl, defaultAISettings.openaiBaseUrl);
  assert.equal(settings.googleBaseUrl, "https://gateway.example.com/gemini");
  assert.equal(settings.azureEndpoint, "");
});

test("mergeRuntimeAISettings: skips malformed provider keys and uses valid aliases", () => {
  const settings = mergeRuntimeAISettings(
    {},
    {
      KIMI_API_KEY: "",
      MOONSHOT_API_KEY: "moonshot-key",
      GLM_API_KEY: "   ",
      ZAI_API_KEY: "zai-key",
    },
    {},
  );

  assert.equal(settings.kimiKey, "moonshot-key");
  assert.equal(settings.glmKey, "zai-key");
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
