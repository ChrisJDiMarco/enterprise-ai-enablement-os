import { defaultAISettings } from "./model-router.ts";

export type RuntimeProviderId =
  | "local"
  | "openai"
  | "anthropic"
  | "google"
  | "azure_openai"
  | "kimi"
  | "glm"
  | "deepseek"
  | "openrouter";

export type ProviderRegistryEntry = {
  id: RuntimeProviderId;
  label: string;
  protocol: "local" | "openai-compatible" | "native" | "azure-openai";
  baseUrl?: string;
  keyEnvNames: string[];
  endpointEnvNames?: string[];
  baseUrlEnvNames?: string[];
  recommendedFor: string[];
};

export type ProviderReadiness = {
  id: RuntimeProviderId;
  label: string;
  protocol: ProviderRegistryEntry["protocol"];
  configured: boolean;
  baseUrl?: string;
  missing: string[];
  recommendedFor: string[];
};

type RuntimeEnv = Record<string, string | undefined>;

export const providerRegistry: ProviderRegistryEntry[] = [
  {
    id: "local",
    label: "Local Runtime",
    protocol: "local",
    keyEnvNames: [],
    recommendedFor: ["offline development", "deterministic tests", "governance demos without external calls"],
  },
  {
    id: "openai",
    label: "OpenAI",
    protocol: "native",
    baseUrl: defaultAISettings.openaiBaseUrl,
    keyEnvNames: ["OPENAI_API_KEY"],
    baseUrlEnvNames: ["OPENAI_BASE_URL"],
    recommendedFor: ["frontier reasoning", "agent tools", "structured outputs", "multimodal workflows"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    protocol: "native",
    baseUrl: defaultAISettings.anthropicBaseUrl,
    keyEnvNames: ["ANTHROPIC_API_KEY"],
    baseUrlEnvNames: ["ANTHROPIC_BASE_URL"],
    recommendedFor: ["long-context review", "policy analysis", "governance reasoning"],
  },
  {
    id: "google",
    label: "Gemini / Google",
    protocol: "native",
    baseUrl: defaultAISettings.googleBaseUrl,
    keyEnvNames: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
    baseUrlEnvNames: ["GOOGLE_AI_BASE_URL", "GEMINI_BASE_URL"],
    recommendedFor: ["low-cost summaries", "large context", "brief generation"],
  },
  {
    id: "azure_openai",
    label: "Azure OpenAI",
    protocol: "azure-openai",
    keyEnvNames: ["AZURE_OPENAI_API_KEY"],
    endpointEnvNames: ["AZURE_OPENAI_ENDPOINT"],
    recommendedFor: ["enterprise procurement", "regional controls", "Microsoft ecosystem tenants"],
  },
  {
    id: "kimi",
    label: "Kimi / Moonshot",
    protocol: "openai-compatible",
    baseUrl: defaultAISettings.kimiBaseUrl,
    keyEnvNames: ["KIMI_API_KEY", "MOONSHOT_API_KEY"],
    baseUrlEnvNames: ["KIMI_BASE_URL", "MOONSHOT_BASE_URL"],
    recommendedFor: ["agentic workflow planning", "large context planning", "cost-aware tool orchestration"],
  },
  {
    id: "glm",
    label: "GLM / Z.AI",
    protocol: "openai-compatible",
    baseUrl: defaultAISettings.glmBaseUrl,
    keyEnvNames: ["GLM_API_KEY", "ZAI_API_KEY"],
    baseUrlEnvNames: ["GLM_BASE_URL", "ZAI_BASE_URL"],
    recommendedFor: ["governance review", "risk synthesis", "enterprise policy reasoning"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    protocol: "openai-compatible",
    baseUrl: defaultAISettings.deepseekBaseUrl,
    keyEnvNames: ["DEEPSEEK_API_KEY"],
    baseUrlEnvNames: ["DEEPSEEK_BASE_URL"],
    recommendedFor: ["cheap classification", "scoring", "red-team regression", "bulk analysis"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    protocol: "openai-compatible",
    baseUrl: defaultAISettings.openrouterBaseUrl,
    keyEnvNames: ["OPENROUTER_API_KEY"],
    baseUrlEnvNames: ["OPENROUTER_BASE_URL"],
    recommendedFor: ["fallback routing", "vendor comparison", "model availability failover"],
  },
];

function hasAnySource(env: RuntimeEnv, names: string[], secretNames: Set<string>) {
  return names.length === 0 || names.some((name) => Boolean(env[name]) || secretNames.has(name));
}

function firstEnvValue(env: RuntimeEnv, names: string[]) {
  return names.map((name) => env[name]).find(Boolean);
}

function missingLabel(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return names.join(" or ");
}

export function getProviderReadiness(env: RuntimeEnv = process.env, configuredSecretNames: string[] = []): ProviderReadiness[] {
  const secretNames = new Set(configuredSecretNames);
  return providerRegistry.map((provider) => {
    const hasKey = hasAnySource(env, provider.keyEnvNames, secretNames);
    const hasEndpoint = hasAnySource(env, provider.endpointEnvNames ?? [], secretNames);
    const baseUrl = firstEnvValue(env, provider.baseUrlEnvNames ?? []) ?? firstEnvValue(env, provider.endpointEnvNames ?? []) ?? provider.baseUrl;
    const missing = [
      hasKey ? "" : missingLabel(provider.keyEnvNames),
      hasEndpoint ? "" : missingLabel(provider.endpointEnvNames ?? []),
    ].filter(Boolean);

    return {
      id: provider.id,
      label: provider.label,
      protocol: provider.protocol,
      configured: provider.id === "local" || (hasKey && hasEndpoint),
      baseUrl,
      missing,
      recommendedFor: provider.recommendedFor,
    };
  });
}
