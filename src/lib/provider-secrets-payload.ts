import type { AIProviderSettings } from "@/lib/model-router";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function providerSecretsPayload(settings: AIProviderSettings) {
  const payload: Record<string, string> = {};
  const openaiKey = clean(settings.openaiKey);
  const openaiBaseUrl = clean(settings.openaiBaseUrl);
  const anthropicKey = clean(settings.anthropicKey);
  const anthropicBaseUrl = clean(settings.anthropicBaseUrl);
  const googleKey = clean(settings.googleKey);
  const googleBaseUrl = clean(settings.googleBaseUrl);
  const azureKey = clean(settings.azureKey);
  const azureEndpoint = clean(settings.azureEndpoint);
  const kimiKey = clean(settings.kimiKey);
  const glmKey = clean(settings.glmKey);
  const deepseekKey = clean(settings.deepseekKey);
  const openrouterKey = clean(settings.openrouterKey);

  if (openaiKey) {
    payload.OPENAI_API_KEY = openaiKey;
    if (openaiBaseUrl) payload.OPENAI_BASE_URL = openaiBaseUrl;
  }
  if (anthropicKey) {
    payload.ANTHROPIC_API_KEY = anthropicKey;
    if (anthropicBaseUrl) payload.ANTHROPIC_BASE_URL = anthropicBaseUrl;
  }
  if (googleKey) {
    payload.GOOGLE_API_KEY = googleKey;
    if (googleBaseUrl) payload.GOOGLE_AI_BASE_URL = googleBaseUrl;
  }
  if (azureKey) payload.AZURE_OPENAI_API_KEY = azureKey;
  if (azureKey && azureEndpoint) payload.AZURE_OPENAI_ENDPOINT = azureEndpoint;
  if (kimiKey) {
    payload.KIMI_API_KEY = kimiKey;
    const baseUrl = clean(settings.kimiBaseUrl);
    if (baseUrl) payload.KIMI_BASE_URL = baseUrl;
  }
  if (glmKey) {
    payload.GLM_API_KEY = glmKey;
    const baseUrl = clean(settings.glmBaseUrl);
    if (baseUrl) payload.GLM_BASE_URL = baseUrl;
  }
  if (deepseekKey) {
    payload.DEEPSEEK_API_KEY = deepseekKey;
    const baseUrl = clean(settings.deepseekBaseUrl);
    if (baseUrl) payload.DEEPSEEK_BASE_URL = baseUrl;
  }
  if (openrouterKey) {
    payload.OPENROUTER_API_KEY = openrouterKey;
    const baseUrl = clean(settings.openrouterBaseUrl);
    if (baseUrl) payload.OPENROUTER_BASE_URL = baseUrl;
  }

  return payload;
}
