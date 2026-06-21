import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyProviderRoutingDefaults,
  defaultAISettings,
  normalizeAISettings,
  providerLabel,
  hasProviderCredentials,
  redactAISettingsSecrets,
  selectModelForTask,
} from "../src/lib/model-router.ts";

test("normalizeAISettings: unknown provider falls back to local", () => {
  const settings = normalizeAISettings({ defaultProvider: "fake-provider" });
  assert.equal(settings.defaultProvider, "local");
});

test("normalizeAISettings: keeps a supported provider", () => {
  const settings = normalizeAISettings({ defaultProvider: "anthropic" });
  assert.equal(settings.defaultProvider, "anthropic");
});

test("normalizeAISettings: trims provider fields and fills blank model lanes from defaults", () => {
  const settings = normalizeAISettings({
    defaultProvider: " openai ",
    defaultModel: "",
    governanceModel: "  " as string,
    workflowModel: " anthropic/claude-sonnet ",
    openaiKey: " sk-live ",
    openaiBaseUrl: " https://gateway.example.com/openai ",
  });
  assert.equal(settings.defaultProvider, "openai");
  assert.equal(settings.defaultModel, defaultAISettings.defaultModel);
  assert.equal(settings.governanceModel, defaultAISettings.governanceModel);
  assert.equal(settings.workflowModel, "anthropic/claude-sonnet");
  assert.equal(settings.openaiKey, "sk-live");
  assert.equal(settings.openaiBaseUrl, "https://gateway.example.com/openai");
});

test("normalizeAISettings: normalizes imported budget and boolean controls", () => {
  const settings = normalizeAISettings({
    monthlyBudgetUsd: "2500.257" as unknown as number,
    piiRedaction: "false" as unknown as boolean,
    storePrompts: "0" as unknown as boolean,
    storeToolPayloads: "yes" as unknown as boolean,
  });

  assert.equal(settings.monthlyBudgetUsd, 2500.26);
  assert.equal(settings.piiRedaction, false);
  assert.equal(settings.storePrompts, false);
  assert.equal(settings.storeToolPayloads, true);
});

test("normalizeAISettings: clamps malformed budget controls to safe runtime values", () => {
  assert.equal(normalizeAISettings({ monthlyBudgetUsd: Number.NaN }).monthlyBudgetUsd, defaultAISettings.monthlyBudgetUsd);
  assert.equal(normalizeAISettings({ monthlyBudgetUsd: Number.POSITIVE_INFINITY }).monthlyBudgetUsd, defaultAISettings.monthlyBudgetUsd);
  assert.equal(normalizeAISettings({ monthlyBudgetUsd: -50 }).monthlyBudgetUsd, 0);
  assert.equal(normalizeAISettings({ monthlyBudgetUsd: 999_999_999 }).monthlyBudgetUsd, 100_000_000);
  assert.equal(
    normalizeAISettings({ piiRedaction: "not-a-boolean" as unknown as boolean }).piiRedaction,
    defaultAISettings.piiRedaction,
  );
});

test("providerLabel: known providers map to friendly names", () => {
  assert.equal(providerLabel("local"), "Local Runtime");
  assert.equal(providerLabel("azure_openai"), "Azure OpenAI");
  assert.equal(providerLabel("kimi"), "Kimi / Moonshot");
  assert.equal(providerLabel("glm"), "GLM / Z.AI");
  assert.equal(providerLabel("deepseek"), "DeepSeek");
  assert.equal(providerLabel("openrouter"), "OpenRouter");
  assert.equal(providerLabel("google"), "Gemini / Google");
  assert.equal(providerLabel("gemini"), "Gemini / Google");
});

test("providerLabel: unknown providers are title-cased", () => {
  assert.equal(providerLabel("foo_bar"), "Foo Bar");
});

test("hasProviderCredentials: local is always available", () => {
  assert.equal(hasProviderCredentials(defaultAISettings, "local"), true);
});

test("hasProviderCredentials: single-key providers require their key", () => {
  assert.equal(hasProviderCredentials(defaultAISettings, "openai"), false);
  assert.equal(hasProviderCredentials({ ...defaultAISettings, openaiKey: "sk-x" }, "openai"), true);
  assert.equal(hasProviderCredentials({ ...defaultAISettings, anthropicKey: "sk-y" }, "anthropic"), true);
});

test("hasProviderCredentials: azure requires both key and endpoint", () => {
  assert.equal(hasProviderCredentials({ ...defaultAISettings, azureKey: "k" }, "azure_openai"), false);
  assert.equal(
    hasProviderCredentials({ ...defaultAISettings, azureKey: "k", azureEndpoint: "https://x" }, "azure_openai"),
    true,
  );
});

test("redactAISettingsSecrets: blanks every secret but keeps config", () => {
  const populated = {
    ...defaultAISettings,
    openaiKey: "a",
    openaiBaseUrl: "https://tenant-gateway.example.com/openai",
    anthropicKey: "b",
    anthropicBaseUrl: "https://tenant-gateway.example.com/anthropic",
    googleKey: "c",
    googleBaseUrl: "https://tenant-gateway.example.com/google",
    azureKey: "d",
    azureEndpoint: "https://e",
    kimiKey: "f",
    kimiBaseUrl: "https://tenant-kimi.example.com/v1",
    glmKey: "g",
    glmBaseUrl: "https://tenant-glm.example.com/v1",
    deepseekKey: "h",
    deepseekBaseUrl: "https://tenant-deepseek.example.com/v1",
    openrouterKey: "i",
    openrouterBaseUrl: "https://tenant-openrouter.example.com/v1",
    defaultProvider: "anthropic",
  };
  const redacted = redactAISettingsSecrets(populated);
  for (const key of [
    "openaiKey",
    "anthropicKey",
    "googleKey",
    "azureKey",
    "azureEndpoint",
    "kimiKey",
    "glmKey",
    "deepseekKey",
    "openrouterKey",
  ] as const) {
    assert.equal(redacted[key], "", `${key} should be blanked`);
  }
  assert.equal(redacted.defaultProvider, "anthropic");
  assert.equal(redacted.openaiBaseUrl, defaultAISettings.openaiBaseUrl);
  assert.equal(redacted.anthropicBaseUrl, defaultAISettings.anthropicBaseUrl);
  assert.equal(redacted.googleBaseUrl, defaultAISettings.googleBaseUrl);
  assert.equal(redacted.kimiBaseUrl, defaultAISettings.kimiBaseUrl);
  assert.equal(redacted.glmBaseUrl, defaultAISettings.glmBaseUrl);
  assert.equal(redacted.deepseekBaseUrl, defaultAISettings.deepseekBaseUrl);
  assert.equal(redacted.openrouterBaseUrl, defaultAISettings.openrouterBaseUrl);
  assert.equal(JSON.stringify(redacted).includes("tenant-gateway"), false);
});

test("selectModelForTask: defaults to the deterministic local runtime", () => {
  const decision = selectModelForTask(defaultAISettings, "default");
  assert.equal(decision.provider, "local");
  assert.equal(decision.fallbackUsed, true);
});

test("applyProviderRoutingDefaults: OpenAI key promotes OpenAI primary with OpenRouter fallback", () => {
  const settings = applyProviderRoutingDefaults({
    openaiKey: "sk-openai",
    openrouterKey: "sk-router",
    defaultModel: "local-enterprise-reasoner",
    cheapModel: "local-fast-classifier",
  });

  assert.equal(settings.defaultProvider, "openai");
  assert.equal(settings.defaultModel, defaultAISettings.defaultModel);
  assert.equal(settings.cheapModel, defaultAISettings.cheapModel);
  assert.equal(settings.fallbackModel, "openrouter/auto");
});

test("applyProviderRoutingDefaults: OpenRouter key can be the primary default when OpenAI is absent", () => {
  const settings = applyProviderRoutingDefaults({
    openrouterKey: "sk-router",
    defaultModel: defaultAISettings.defaultModel,
    cheapModel: defaultAISettings.cheapModel,
    reasoningModel: defaultAISettings.reasoningModel,
  });

  assert.equal(settings.defaultProvider, "openrouter");
  assert.equal(settings.defaultModel, "openrouter/auto");
  assert.equal(settings.cheapModel, "openrouter/auto");
  assert.equal(settings.reasoningModel, "openrouter/auto");
});

test("selectModelForTask: routes to a configured external provider", () => {
  const settings = normalizeAISettings({
    governanceModel: "anthropic/claude-opus",
    anthropicKey: "sk-x",
  });
  const decision = selectModelForTask(settings, "governance");
  assert.equal(decision.provider, "anthropic");
  assert.equal(decision.model, "claude-opus");
  assert.equal(decision.fallbackUsed, false);
});

test("selectModelForTask: falls back to local when the lane provider is unconfigured", () => {
  const settings = normalizeAISettings({
    governanceModel: "anthropic/claude-opus",
    fallbackModel: "local/local-enterprise-reasoner",
  });
  const decision = selectModelForTask(settings, "governance");
  assert.equal(decision.provider, "local");
  assert.equal(decision.fallbackUsed, true);
});
