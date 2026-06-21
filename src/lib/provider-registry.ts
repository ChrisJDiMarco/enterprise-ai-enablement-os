import { defaultAISettings } from "./model-router.ts";
import { tenantSecretRuntimeValueIsUsable } from "./tenant-secret-format.ts";

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
const secretNamePattern = /^[A-Z0-9_]{2,120}$/;
const redacted = "[redacted]";
const sensitiveEndpointParamPattern =
  /(?:token|secret|password|credential|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|key)/i;
const sensitiveEndpointValuePatterns = [
  /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/i,
  /\b(?:sk|xox[baprs]|ghp|github_pat|glpat|ya29|eyJ)[A-Za-z0-9._-]{12,}\b/i,
  /\b(?:postgres|postgresql|mysql|redis|mongodb):\/\/[^\s,;]+/i,
  /https:\/\/hooks\.slack\.com\/services\/[^\s,;]+/i,
  /[?&](?:token|secret|password|credential|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|key)=([^&#\s]+)/i,
];

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

function canonicalSecretName(value: string) {
  const normalized = value.trim().toUpperCase();
  return secretNamePattern.test(normalized) ? normalized : "";
}

function canonicalSecretNameSet(values: string[]) {
  return new Set(values.map(canonicalSecretName).filter(Boolean));
}

function envHasUsableValue(env: RuntimeEnv, name: string) {
  return tenantSecretRuntimeValueIsUsable(name, env[name]);
}

function hasAnySource(env: RuntimeEnv, names: string[], secretNames: Set<string>) {
  return names.length === 0 || names.some((name) => envHasUsableValue(env, name) || secretNames.has(name));
}

function firstUsableEnvValue(env: RuntimeEnv, names: string[]) {
  return names.map((name) => ({ name, value: env[name] })).find((entry) => entry.value && envHasUsableValue(env, entry.name))?.value;
}

function missingLabel(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return names.join(" or ");
}

function sanitizeEndpointDisplay(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (sensitiveEndpointValuePatterns.some((pattern) => pattern.test(trimmed))) return redacted;

  try {
    const url = new URL(trimmed);
    url.username = "";
    url.password = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (sensitiveEndpointParamPattern.test(key)) url.searchParams.set(key, redacted);
    }
    url.hash = "";
    return url.toString();
  } catch {
    return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
  }
}

export function getProviderReadiness(env: RuntimeEnv = process.env, configuredSecretNames: string[] = []): ProviderReadiness[] {
  const secretNames = canonicalSecretNameSet(configuredSecretNames);
  return providerRegistry.map((provider) => {
    const hasKey = hasAnySource(env, provider.keyEnvNames, secretNames);
    const hasEndpoint = hasAnySource(env, provider.endpointEnvNames ?? [], secretNames);
    const baseUrl = sanitizeEndpointDisplay(
      firstUsableEnvValue(env, provider.baseUrlEnvNames ?? []) ??
        firstUsableEnvValue(env, provider.endpointEnvNames ?? []) ??
        provider.baseUrl,
    );
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
