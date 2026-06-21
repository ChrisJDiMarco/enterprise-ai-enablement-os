import { applyProviderRoutingDefaults, defaultAISettings } from "./model-router.ts";
import type { AIProviderSettings } from "./model-router.ts";
import { tenantSecretRuntimeValueIsUsable } from "./tenant-secret-format.ts";

type RuntimeEnv = Record<string, string | undefined>;
type RuntimeSecrets = Record<string, string | undefined>;

function firstRuntimeValue(secrets: RuntimeSecrets, env: RuntimeEnv, names: string[]) {
  return names
    .map((name) => ({ name, value: secrets[name] || env[name] }))
    .find((entry) => entry.value && tenantSecretRuntimeValueIsUsable(entry.name, entry.value))
    ?.value ?? "";
}

export const providerSecretNames = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_AI_BASE_URL",
  "GEMINI_BASE_URL",
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_KEY",
  "KIMI_API_KEY",
  "MOONSHOT_API_KEY",
  "KIMI_BASE_URL",
  "MOONSHOT_BASE_URL",
  "GLM_API_KEY",
  "ZAI_API_KEY",
  "GLM_BASE_URL",
  "ZAI_BASE_URL",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
] as const;

export function mergeRuntimeAISettings(
  routingSettings: Partial<AIProviderSettings> = {},
  secrets: RuntimeSecrets = {},
  env: RuntimeEnv = process.env,
): AIProviderSettings {
  return applyProviderRoutingDefaults({
    ...defaultAISettings,
    ...routingSettings,
    openaiKey: firstRuntimeValue(secrets, env, ["OPENAI_API_KEY"]),
    openaiBaseUrl:
      firstRuntimeValue(secrets, env, ["OPENAI_BASE_URL"]) ||
      defaultAISettings.openaiBaseUrl,
    anthropicKey: firstRuntimeValue(secrets, env, ["ANTHROPIC_API_KEY"]),
    anthropicBaseUrl:
      firstRuntimeValue(secrets, env, ["ANTHROPIC_BASE_URL"]) ||
      defaultAISettings.anthropicBaseUrl,
    googleKey: firstRuntimeValue(secrets, env, ["GOOGLE_API_KEY", "GEMINI_API_KEY"]),
    googleBaseUrl:
      firstRuntimeValue(secrets, env, ["GOOGLE_AI_BASE_URL", "GEMINI_BASE_URL"]) ||
      defaultAISettings.googleBaseUrl,
    azureEndpoint: firstRuntimeValue(secrets, env, ["AZURE_OPENAI_ENDPOINT"]),
    azureKey: firstRuntimeValue(secrets, env, ["AZURE_OPENAI_API_KEY"]),
    kimiKey: firstRuntimeValue(secrets, env, ["KIMI_API_KEY", "MOONSHOT_API_KEY"]),
    kimiBaseUrl:
      firstRuntimeValue(secrets, env, ["KIMI_BASE_URL", "MOONSHOT_BASE_URL"]) ||
      defaultAISettings.kimiBaseUrl,
    glmKey: firstRuntimeValue(secrets, env, ["GLM_API_KEY", "ZAI_API_KEY"]),
    glmBaseUrl:
      firstRuntimeValue(secrets, env, ["GLM_BASE_URL", "ZAI_BASE_URL"]) ||
      defaultAISettings.glmBaseUrl,
    deepseekKey: firstRuntimeValue(secrets, env, ["DEEPSEEK_API_KEY"]),
    deepseekBaseUrl:
      firstRuntimeValue(secrets, env, ["DEEPSEEK_BASE_URL"]) ||
      defaultAISettings.deepseekBaseUrl,
    openrouterKey: firstRuntimeValue(secrets, env, ["OPENROUTER_API_KEY"]),
    openrouterBaseUrl:
      firstRuntimeValue(secrets, env, ["OPENROUTER_BASE_URL"]) ||
      defaultAISettings.openrouterBaseUrl,
  });
}

export function buildServerAISettings(
  routingSettings: Partial<AIProviderSettings> = {},
  env: RuntimeEnv = process.env,
): AIProviderSettings {
  return mergeRuntimeAISettings(routingSettings, {}, env);
}

export async function buildServerAISettingsForOrganization(
  organizationId: string,
  routingSettings: Partial<AIProviderSettings> = {},
  env: RuntimeEnv = process.env,
): Promise<AIProviderSettings> {
  let secrets: RuntimeSecrets = {};
  try {
    const { readTenantSecretValues } = await import("./tenant-secret-vault.ts");
    secrets = await readTenantSecretValues(organizationId, [...providerSecretNames]);
  } catch {
    secrets = {};
  }

  return mergeRuntimeAISettings(routingSettings, secrets, env);
}
