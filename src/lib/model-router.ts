export type AIProviderSettings = {
  openaiKey: string;
  openaiBaseUrl: string;
  anthropicKey: string;
  anthropicBaseUrl: string;
  googleKey: string;
  googleBaseUrl: string;
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
  openaiBaseUrl: "https://api.openai.com/v1",
  anthropicKey: "",
  anthropicBaseUrl: "https://api.anthropic.com",
  googleKey: "",
  googleBaseUrl: "https://generativelanguage.googleapis.com",
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
  defaultProvider: "openai",
  defaultModel: "openai/gpt-5.4-mini",
  cheapModel: "openai/gpt-5.4-mini",
  reasoningModel: "openai/gpt-5.5",
  classificationModel: "openai/gpt-5.4-mini",
  summarizationModel: "openai/gpt-5.4-mini",
  governanceModel: "openai/gpt-5.5",
  workflowModel: "openai/gpt-5.4-mini",
  redTeamModel: "openai/gpt-5.5",
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

function cleanSettingString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOrDefault(value: unknown, fallback: string) {
  return cleanSettingString(value) || fallback;
}

function cleanBudgetUsd(value: unknown) {
  if (value === undefined || value === null || value === "") return defaultAISettings.monthlyBudgetUsd;
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(numeric)) return defaultAISettings.monthlyBudgetUsd;
  return Math.min(Math.max(Math.round(numeric * 100) / 100, 0), 100_000_000);
}

function cleanBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

export function normalizeAISettings(settings: Partial<AIProviderSettings>): AIProviderSettings {
  const requestedProvider = cleanSettingString(settings.defaultProvider);
  const provider = requestedProvider
    ? supportedProviders.includes(requestedProvider)
      ? requestedProvider
      : "local"
    : defaultAISettings.defaultProvider;

  return {
    ...defaultAISettings,
    ...settings,
    openaiKey: cleanSettingString(settings.openaiKey),
    anthropicKey: cleanSettingString(settings.anthropicKey),
    googleKey: cleanSettingString(settings.googleKey),
    azureEndpoint: cleanSettingString(settings.azureEndpoint),
    azureKey: cleanSettingString(settings.azureKey),
    kimiKey: cleanSettingString(settings.kimiKey),
    glmKey: cleanSettingString(settings.glmKey),
    deepseekKey: cleanSettingString(settings.deepseekKey),
    openrouterKey: cleanSettingString(settings.openrouterKey),
    defaultProvider: provider,
    defaultModel: cleanOrDefault(settings.defaultModel, defaultAISettings.defaultModel),
    cheapModel: cleanOrDefault(settings.cheapModel, defaultAISettings.cheapModel),
    reasoningModel: cleanOrDefault(settings.reasoningModel, defaultAISettings.reasoningModel),
    classificationModel: cleanOrDefault(settings.classificationModel, defaultAISettings.classificationModel),
    summarizationModel: cleanOrDefault(settings.summarizationModel, defaultAISettings.summarizationModel),
    governanceModel: cleanOrDefault(settings.governanceModel, defaultAISettings.governanceModel),
    workflowModel: cleanOrDefault(settings.workflowModel, defaultAISettings.workflowModel),
    redTeamModel: cleanOrDefault(settings.redTeamModel, defaultAISettings.redTeamModel),
    fallbackModel: cleanOrDefault(settings.fallbackModel, defaultAISettings.fallbackModel),
    openaiBaseUrl: cleanOrDefault(settings.openaiBaseUrl, defaultAISettings.openaiBaseUrl),
    anthropicBaseUrl: cleanOrDefault(settings.anthropicBaseUrl, defaultAISettings.anthropicBaseUrl),
    googleBaseUrl: cleanOrDefault(settings.googleBaseUrl, defaultAISettings.googleBaseUrl),
    kimiBaseUrl: cleanOrDefault(settings.kimiBaseUrl, defaultAISettings.kimiBaseUrl),
    glmBaseUrl: cleanOrDefault(settings.glmBaseUrl, defaultAISettings.glmBaseUrl),
    deepseekBaseUrl: cleanOrDefault(settings.deepseekBaseUrl, defaultAISettings.deepseekBaseUrl),
    openrouterBaseUrl: cleanOrDefault(settings.openrouterBaseUrl, defaultAISettings.openrouterBaseUrl),
    monthlyBudgetUsd: cleanBudgetUsd(settings.monthlyBudgetUsd),
    piiRedaction: cleanBoolean(settings.piiRedaction, defaultAISettings.piiRedaction),
    storePrompts: cleanBoolean(settings.storePrompts, defaultAISettings.storePrompts),
    storeToolPayloads: cleanBoolean(settings.storeToolPayloads, defaultAISettings.storeToolPayloads),
  };
}

function localOrBlank(value: string | undefined) {
  return !value || value.startsWith("local");
}

function applyPrimaryLaneDefaults(settings: AIProviderSettings, provider: "openai" | "openrouter"): AIProviderSettings {
  if (provider === "openrouter") {
    const fallback = "openrouter/auto";
    return {
      ...settings,
      defaultProvider: "openrouter",
      defaultModel: localOrBlank(settings.defaultModel) || settings.defaultModel === defaultAISettings.defaultModel ? fallback : settings.defaultModel,
      cheapModel: localOrBlank(settings.cheapModel) || settings.cheapModel === defaultAISettings.cheapModel ? fallback : settings.cheapModel,
      reasoningModel: localOrBlank(settings.reasoningModel) || settings.reasoningModel === defaultAISettings.reasoningModel ? fallback : settings.reasoningModel,
      classificationModel: localOrBlank(settings.classificationModel) ? fallback : settings.classificationModel,
      summarizationModel: localOrBlank(settings.summarizationModel) ? fallback : settings.summarizationModel,
      governanceModel: localOrBlank(settings.governanceModel) ? fallback : settings.governanceModel,
      workflowModel: localOrBlank(settings.workflowModel) ? fallback : settings.workflowModel,
      redTeamModel: localOrBlank(settings.redTeamModel) ? fallback : settings.redTeamModel,
      fallbackModel: fallback,
    };
  }

  return {
    ...settings,
    defaultProvider: "openai",
    defaultModel: localOrBlank(settings.defaultModel) ? defaultAISettings.defaultModel : settings.defaultModel,
    cheapModel: localOrBlank(settings.cheapModel) ? defaultAISettings.cheapModel : settings.cheapModel,
    reasoningModel: localOrBlank(settings.reasoningModel) ? defaultAISettings.reasoningModel : settings.reasoningModel,
    classificationModel: localOrBlank(settings.classificationModel) ? defaultAISettings.classificationModel : settings.classificationModel,
    summarizationModel: localOrBlank(settings.summarizationModel) ? defaultAISettings.summarizationModel : settings.summarizationModel,
    governanceModel: localOrBlank(settings.governanceModel) ? defaultAISettings.governanceModel : settings.governanceModel,
    workflowModel: localOrBlank(settings.workflowModel) ? defaultAISettings.workflowModel : settings.workflowModel,
    redTeamModel: localOrBlank(settings.redTeamModel) ? defaultAISettings.redTeamModel : settings.redTeamModel,
    fallbackModel: settings.openrouterKey ? "openrouter/auto" : settings.fallbackModel || defaultAISettings.fallbackModel,
  };
}

export function applyProviderRoutingDefaults(settings: Partial<AIProviderSettings>): AIProviderSettings {
  const normalized = normalizeAISettings(settings);

  if (normalized.openaiKey) {
    return applyPrimaryLaneDefaults(normalized, "openai");
  }

  if (normalized.openrouterKey) {
    return applyPrimaryLaneDefaults(normalized, "openrouter");
  }

  return normalized;
}

export function providerLabel(provider: string) {
  if (provider === "local") return "Local Runtime";
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
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
    openaiBaseUrl: defaultAISettings.openaiBaseUrl,
    anthropicKey: "",
    anthropicBaseUrl: defaultAISettings.anthropicBaseUrl,
    googleKey: "",
    googleBaseUrl: defaultAISettings.googleBaseUrl,
    azureEndpoint: "",
    azureKey: "",
    kimiKey: "",
    kimiBaseUrl: defaultAISettings.kimiBaseUrl,
    glmKey: "",
    glmBaseUrl: defaultAISettings.glmBaseUrl,
    deepseekKey: "",
    deepseekBaseUrl: defaultAISettings.deepseekBaseUrl,
    openrouterKey: "",
    openrouterBaseUrl: defaultAISettings.openrouterBaseUrl,
  };
}
