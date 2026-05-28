import { AIProviderSettings, defaultAISettings, normalizeAISettings } from "@/lib/model-router";

type RuntimeEnv = Record<string, string | undefined>;

function firstValue(env: RuntimeEnv, names: string[]) {
  return names.map((name) => env[name]).find(Boolean) ?? "";
}

export function buildServerAISettings(
  routingSettings: Partial<AIProviderSettings> = {},
  env: RuntimeEnv = process.env,
): AIProviderSettings {
  return normalizeAISettings({
    ...defaultAISettings,
    ...routingSettings,
    openaiKey: firstValue(env, ["OPENAI_API_KEY"]),
    anthropicKey: firstValue(env, ["ANTHROPIC_API_KEY"]),
    googleKey: firstValue(env, ["GOOGLE_API_KEY", "GEMINI_API_KEY"]),
    azureEndpoint: firstValue(env, ["AZURE_OPENAI_ENDPOINT"]),
    azureKey: firstValue(env, ["AZURE_OPENAI_API_KEY"]),
    kimiKey: firstValue(env, ["KIMI_API_KEY", "MOONSHOT_API_KEY"]),
    kimiBaseUrl: firstValue(env, ["KIMI_BASE_URL", "MOONSHOT_BASE_URL"]) || defaultAISettings.kimiBaseUrl,
    glmKey: firstValue(env, ["GLM_API_KEY", "ZAI_API_KEY"]),
    glmBaseUrl: firstValue(env, ["GLM_BASE_URL", "ZAI_BASE_URL"]) || defaultAISettings.glmBaseUrl,
    deepseekKey: firstValue(env, ["DEEPSEEK_API_KEY"]),
    deepseekBaseUrl: firstValue(env, ["DEEPSEEK_BASE_URL"]) || defaultAISettings.deepseekBaseUrl,
    openrouterKey: firstValue(env, ["OPENROUTER_API_KEY"]),
    openrouterBaseUrl: firstValue(env, ["OPENROUTER_BASE_URL"]) || defaultAISettings.openrouterBaseUrl,
  });
}
