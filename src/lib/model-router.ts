export type AIProviderSettings = {
  openaiKey: string;
  anthropicKey: string;
  googleKey: string;
  azureEndpoint: string;
  azureKey: string;
  kimiKey: string;
  kimiBaseUrl: string;
  glmKey: string;
  glmBaseUrl: string;
  deepseekKey: string;
  deepseekBaseUrl: string;
  openrouterKey: string;
  openrouterBaseUrl: string;
  defaultProvider: string;
  defaultModel: string;
  cheapModel: string;
  reasoningModel: string;
  classificationModel: string;
  summarizationModel: string;
  governanceModel: string;
  workflowModel: string;
  redTeamModel: string;
  fallbackModel: string;
  monthlyBudgetUsd: number;
  piiRedaction: boolean;
  storePrompts: boolean;
  storeToolPayloads: boolean;
};

export type ModelTaskLane =
  | "bulk"
  | "default"
  | "reasoning"
  | "summarization"
  | "governance"
  | "workflow"
  | "red_team";

export type ModelRouteDecision = {
  provider: string;
  model: string;
  modelRef: string;
  fallbackUsed: boolean;
  reason: string;
};

export const defaultAISettings: AIProviderSettings = {
  openaiKey: "",
  anthropicKey: "",
  googleKey: "",
  azureEndpoint: "",
  azureKey: "",
  kimiKey: "",
  kimiBaseUrl: "https://api.moonshot.ai/v1",
  glmKey: "",
  glmBaseUrl: "https://api.z.ai/api/paas/v4",
  deepseekKey: "",
  deepseekBaseUrl: "https://api.deepseek.com",
  openrouterKey: "",
  openrouterBaseUrl: "https://openrouter.ai/api/v1",
  defaultProvider: "local",
  defaultModel: "local-enterprise-reasoner",
  cheapModel: "local-fast-classifier",
  reasoningModel: "local-governance-reasoner",
  classificationModel: "deepseek/deepseek-v4-flash",
  summarizationModel: "gemini/gemini-2.5-flash",
  governanceModel: "glm/glm-5.1",
  workflowModel: "kimi/kimi-k2.6",
  redTeamModel: "deepseek/deepseek-v4-pro",
  fallbackModel: "openrouter/auto",
  monthlyBudgetUsd: 10000,
  piiRedaction: true,
  storePrompts: true,
  storeToolPayloads: true,
};

const supportedProviders = [
  "local",
  "openai",
  "anthropic",
  "google",
  "gemini",
  "azure_openai",
  "kimi",
  "glm",
  "deepseek",
  "openrouter",
];

export function normalizeAISettings(settings: Partial<AIProviderSettings>): AIProviderSettings {
  const provider = settings.defaultProvider && supportedProviders.includes(settings.defaultProvider) ? settings.defaultProvider : "local";

  return {
    ...defaultAISettings,
    ...settings,
    defaultProvider: provider,
    defaultModel: settings.defaultModel || defaultAISettings.defaultModel,
    cheapModel: settings.cheapModel || defaultAISettings.cheapModel,
    reasoningModel: settings.reasoningModel || defaultAISettings.reasoningModel,
    classificationModel: settings.classificationModel || defaultAISettings.classificationModel,
    summarizationModel: settings.summarizationModel || defaultAISettings.summarizationModel,
    governanceModel: settings.governanceModel || defaultAISettings.governanceModel,
    workflowModel: settings.workflowModel || defaultAISettings.workflowModel,
    redTeamModel: settings.redTeamModel || defaultAISettings.redTeamModel,
    fallbackModel: settings.fallbackModel || defaultAISettings.fallbackModel,
    kimiBaseUrl: settings.kimiBaseUrl || defaultAISettings.kimiBaseUrl,
    glmBaseUrl: settings.glmBaseUrl || defaultAISettings.glmBaseUrl,
    deepseekBaseUrl: settings.deepseekBaseUrl || defaultAISettings.deepseekBaseUrl,
    openrouterBaseUrl: settings.openrouterBaseUrl || defaultAISettings.openrouterBaseUrl,
  };
}

export function providerLabel(provider: string) {
  if (provider === "local") return "Local Runtime";
  if (provider === "azure_openai") return "Azure OpenAI";
  if (provider === "kimi") return "Kimi / Moonshot";
  if (provider === "glm") return "GLM / Z.AI";
  if (provider === "deepseek") return "DeepSeek";
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "google" || provider === "gemini") return "Gemini / Google";
  return provider
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function hasProviderCredentials(settings: AIProviderSettings, provider: string) {
  if (provider === "local") return true;
  if (provider === "openai") return Boolean(settings.openaiKey);
  if (provider === "anthropic") return Boolean(settings.anthropicKey);
  if (provider === "google" || provider === "gemini") return Boolean(settings.googleKey);
  if (provider === "azure_openai") return Boolean(settings.azureKey && settings.azureEndpoint);
  if (provider === "kimi") return Boolean(settings.kimiKey && settings.kimiBaseUrl);
  if (provider === "glm") return Boolean(settings.glmKey && settings.glmBaseUrl);
  if (provider === "deepseek") return Boolean(settings.deepseekKey && settings.deepseekBaseUrl);
  if (provider === "openrouter") return Boolean(settings.openrouterKey && settings.openrouterBaseUrl);
  return false;
}

export function modelProviderFromRef(modelRef: string) {
  const [provider] = modelRef.split("/");
  if (!modelRef.includes("/")) return "local";
  if (provider === "gemini") return "google";
  return provider;
}

export function modelNameFromRef(modelRef: string) {
  return modelRef.includes("/") ? modelRef.split("/").slice(1).join("/") : modelRef;
}

export function selectModelForTask(settings: AIProviderSettings, task: ModelTaskLane): ModelRouteDecision {
  const modelRefByTask: Record<ModelTaskLane, string> = {
    bulk: settings.classificationModel || settings.cheapModel,
    default: settings.defaultModel,
    reasoning: settings.reasoningModel,
    summarization: settings.summarizationModel,
    governance: settings.governanceModel,
    workflow: settings.workflowModel,
    red_team: settings.redTeamModel,
  };
  const requestedModel = modelRefByTask[task] || settings.defaultModel;
  const requestedProvider = modelProviderFromRef(requestedModel);

  if (requestedProvider === "local") {
    const model = modelNameFromRef(requestedModel) || defaultAISettings.defaultModel;
    return {
      provider: "local",
      model,
      modelRef: requestedModel.includes("/") ? requestedModel : `local/${model}`,
      fallbackUsed: false,
      reason: "Deterministic local runtime selected by routing policy.",
    };
  }

  if (requestedProvider !== "local" && hasProviderCredentials(settings, requestedProvider)) {
    return {
      provider: requestedProvider,
      model: modelNameFromRef(requestedModel),
      modelRef: requestedModel,
      fallbackUsed: false,
      reason: `Routed ${task.replace(/_/g, " ")} work to ${providerLabel(requestedProvider)} for cost/capability fit.`,
    };
  }

  const fallbackProvider = modelProviderFromRef(settings.fallbackModel);
  if (fallbackProvider !== "local" && hasProviderCredentials(settings, fallbackProvider)) {
    return {
      provider: fallbackProvider,
      model: modelNameFromRef(settings.fallbackModel),
      modelRef: settings.fallbackModel,
      fallbackUsed: true,
      reason: `Primary ${providerLabel(requestedProvider)} lane is not configured; using fallback ${providerLabel(fallbackProvider)}.`,
    };
  }

  return {
    provider: "local",
    model: defaultAISettings.defaultModel,
    modelRef: `local/${defaultAISettings.defaultModel}`,
    fallbackUsed: requestedProvider !== "local",
    reason: `Primary ${providerLabel(requestedProvider)} lane is not configured; deterministic local runtime is active.`,
  };
}

export function redactAISettingsSecrets(settings: AIProviderSettings): AIProviderSettings {
  return {
    ...settings,
    openaiKey: "",
    anthropicKey: "",
    googleKey: "",
    azureEndpoint: "",
    azureKey: "",
    kimiKey: "",
    glmKey: "",
    deepseekKey: "",
    openrouterKey: "",
  };
}
