import type { AIProviderSettings, ModelRouteDecision, ModelTaskLane } from "./model-router.ts";
import { selectModelForTask } from "./model-router.ts";

export type GenerateInput = {
  settings: AIProviderSettings;
  lane: ModelTaskLane;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

export type GenerateOutput = {
  route: ModelRouteDecision;
  text: string;
  finishReason: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  /**
   * True whenever the deterministic local runtime produced the text instead of a
   * live provider. This is the case both when no provider is configured AND when a
   * configured provider call failed — use `providerError` to tell those apart.
   */
  localFallback: boolean;
  /**
   * True only when a provider WAS configured and the call failed (auth, rate limit,
   * timeout, 5xx, or an empty response). Distinguishes an honest "no key" simulation
   * from a degraded error state that an operator must act on. Never set for the
   * intentional no-provider local mode.
   */
  providerError: boolean;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function openAIModelDisallowsTemperature(model: string) {
  const normalized = model.toLowerCase();
  return /^o\d/.test(normalized) || normalized.startsWith("gpt-5");
}

class ProviderHttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly providerErrorType?: string;
  readonly providerErrorParam?: string;
  readonly unsupportedTemperature: boolean;

  constructor(params: {
    status: number;
    statusText: string;
    providerErrorType?: string;
    providerErrorParam?: string;
    unsupportedTemperature?: boolean;
  }) {
    super(`Provider returned HTTP ${params.status}.`);
    this.name = "ProviderHttpError";
    this.status = params.status;
    this.statusText = params.statusText;
    this.providerErrorType = params.providerErrorType;
    this.providerErrorParam = params.providerErrorParam;
    this.unsupportedTemperature = params.unsupportedTemperature ?? false;
  }
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : "";
}

function providerErrorShape(payload: unknown) {
  const error = payload && typeof payload === "object" && "error" in payload
    ? (payload as { error?: unknown }).error
    : undefined;
  const errorRecord = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const message = stringField(errorRecord.message);
  const param = stringField(errorRecord.param);
  const type = stringField(errorRecord.type);
  const code = stringField(errorRecord.code);
  const normalizedMessage = message.toLowerCase();

  return {
    type: type || code || undefined,
    param: param || undefined,
    unsupportedTemperature:
      (param.toLowerCase() === "temperature" || normalizedMessage.includes("temperature")) &&
      (normalizedMessage.includes("unsupported") || normalizedMessage.includes("not supported")),
  };
}

function isUnsupportedTemperatureError(error: unknown) {
  if (error instanceof ProviderHttpError) return error.unsupportedTemperature;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("temperature") && (message.includes("unsupported") || message.includes("not supported"));
}

function providerFailureLogDetail(error: unknown) {
  if (error instanceof ProviderHttpError) {
    return {
      errorName: error.name,
      status: error.status,
      statusText: error.statusText,
      providerErrorType: error.providerErrorType,
      providerErrorParam: error.providerErrorParam,
      unsupportedTemperature: error.unsupportedTemperature,
    };
  }

  if (error instanceof Error) {
    return {
      errorName: error.name,
    };
  }

  return {
    errorName: typeof error,
  };
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function localGenerate(
  input: GenerateInput,
  route: ModelRouteDecision,
  latencyMs: number,
  opts: { providerError?: boolean } = {},
): GenerateOutput {
  const providerError = opts.providerError ?? false;
  const elapsedMs = Math.max(latencyMs, 35);
  const skillLabel =
    input.system.match(/governed enterprise Skill "([^"]+)"/)?.[1] ??
    input.system.match(/You are the ([^.]+)\./)?.[1] ??
    "configured Skill";
  const contractId = input.system.match(/Contract ID:\s*([^\n]+)/)?.[1]?.trim();
  const text = [
    providerError
      ? `[SIMULATED OUTPUT] The configured model provider call failed for ${skillLabel}, so the deterministic local runtime produced this placeholder. This is a degraded error state, not a successful model run.`
      : `[SIMULATED OUTPUT] No model was called for ${skillLabel} — no server-side provider is configured for this route.`,
    contractId
      ? `Prompt contract ${contractId} was assembled and would govern a live run.`
      : "A governed prompt contract was assembled and would govern a live run.",
    "This placeholder exercises the governance path only; it contains no model reasoning and must not be treated as evidence of output quality.",
    providerError
      ? "Check provider credentials, quota, and connectivity; the detailed provider error is in the server logs."
      : "Attach provider secrets in the server environment to enable live model calls.",
  ].join(" ");

  return {
    route,
    text,
    finishReason: providerError ? "provider_error" : "local_fallback",
    inputTokens: estimateTokens(`${input.system}\n${input.user}`),
    outputTokens: estimateTokens(text),
    latencyMs: elapsedMs,
    localFallback: true,
    providerError,
  };
}

/**
 * Builds a local route annotated with a SAFE, public reason. The raw upstream
 * provider error is never embedded here — it would leak org/billing/endpoint
 * details to any client that renders `route.reason`. Detail goes to server logs.
 */
function providerErrorRoute(requested: ModelRouteDecision, publicReason: string): ModelRouteDecision {
  return {
    provider: "local",
    model: "local-enterprise-reasoner",
    modelRef: "local/local-enterprise-reasoner",
    fallbackUsed: true,
    reason: `Requested ${requested.provider}/${requested.model} was unavailable. ${publicReason} Deterministic local runtime is active.`,
  };
}

type ProviderResult = { text: string; finishReason: string; inputTokens: number; outputTokens: number };

async function postJson<T>(url: string, init: RequestInit, timeoutMs = 45000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const shape = providerErrorShape(payload);
      throw new ProviderHttpError({
        status: response.status,
        statusText: response.statusText,
        providerErrorType: shape.type,
        providerErrorParam: shape.param,
        unsupportedTemperature: shape.unsupportedTemperature,
      });
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAICompatible(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
}): Promise<{ text: string; finishReason: string; inputTokens: number; outputTokens: number }> {
  const basePayload = {
      model: params.model,
      messages: params.messages,
      max_tokens: params.maxTokens,
  };
  const request = (includeTemperature: boolean) =>
    postJson<{
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    }>(`${params.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...basePayload,
        ...(includeTemperature ? { temperature: params.temperature } : {}),
      }),
  });
  const includeTemperature = !openAIModelDisallowsTemperature(params.model);
  let payload: {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    payload = await request(includeTemperature);
  } catch (error) {
    if (!includeTemperature || !isUnsupportedTemperatureError(error)) throw error;
    payload = await request(false);
  }

  return {
    text: payload.choices?.[0]?.message?.content ?? "",
    finishReason: payload.choices?.[0]?.finish_reason ?? "stop",
    inputTokens: payload.usage?.prompt_tokens ?? estimateTokens(params.messages.map((message) => message.content).join("\n")),
    outputTokens: payload.usage?.completion_tokens ?? estimateTokens(payload.choices?.[0]?.message?.content ?? ""),
  };
}

async function callOpenAIResponses(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
}): Promise<{ text: string; finishReason: string; inputTokens: number; outputTokens: number }> {
  const basePayload = {
      model: params.model,
      instructions: params.system,
      input: params.user,
      max_output_tokens: params.maxTokens,
  };
  const request = (includeTemperature: boolean) =>
    postJson<{
      output_text?: string;
      status?: string;
      incomplete_details?: { reason?: string };
      usage?: { input_tokens?: number; output_tokens?: number };
      output?: {
        content?: { type?: string; text?: string }[];
      }[];
    }>(`${params.baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...basePayload,
        ...(includeTemperature ? { temperature: params.temperature } : {}),
      }),
    });
  const includeTemperature = !openAIModelDisallowsTemperature(params.model);
  let payload: {
    output_text?: string;
    status?: string;
    incomplete_details?: { reason?: string };
    usage?: { input_tokens?: number; output_tokens?: number };
    output?: {
      content?: { type?: string; text?: string }[];
    }[];
  };
  try {
    payload = await request(includeTemperature);
  } catch (error) {
    if (!includeTemperature || !isUnsupportedTemperatureError(error)) throw error;
    payload = await request(false);
  }

  const text =
    payload.output_text ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("") ??
    "";

  return {
    text,
    finishReason: payload.incomplete_details?.reason ?? payload.status ?? "completed",
    inputTokens: payload.usage?.input_tokens ?? estimateTokens(`${params.system}\n${params.user}`),
    outputTokens: payload.usage?.output_tokens ?? estimateTokens(text),
  };
}

async function callAnthropic(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
}): Promise<{ text: string; finishReason: string; inputTokens: number; outputTokens: number }> {
  const payload = await postJson<{
    content?: { type?: string; text?: string }[];
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  }>(`${params.baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    }),
  });

  const text = payload.content?.find((item) => item.type === "text")?.text ?? "";

  return {
    text,
    finishReason: payload.stop_reason ?? "stop",
    inputTokens: payload.usage?.input_tokens ?? estimateTokens(`${params.system}\n${params.user}`),
    outputTokens: payload.usage?.output_tokens ?? estimateTokens(text),
  };
}

async function callGemini(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
}): Promise<{ text: string; finishReason: string; inputTokens: number; outputTokens: number }> {
  const payload = await postJson<{
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  }>(
    `${params.baseUrl.replace(/\/$/, "")}/v1beta/models/${params.model}:generateContent?key=${encodeURIComponent(params.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.system }] },
        contents: [{ role: "user", parts: [{ text: params.user }] }],
        generationConfig: {
          temperature: params.temperature,
          maxOutputTokens: params.maxTokens,
        },
      }),
    },
  );

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

  return {
    text,
    finishReason: payload.candidates?.[0]?.finishReason ?? "stop",
    inputTokens: payload.usageMetadata?.promptTokenCount ?? estimateTokens(`${params.system}\n${params.user}`),
    outputTokens: payload.usageMetadata?.candidatesTokenCount ?? estimateTokens(text),
  };
}

async function callAzureOpenAI(params: {
  endpoint: string;
  apiKey: string;
  deployment: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
}): Promise<{ text: string; finishReason: string; inputTokens: number; outputTokens: number }> {
  const endpoint = params.endpoint.replace(/\/$/, "");
  const payload = await postJson<{
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  }>(`${endpoint}/openai/deployments/${params.deployment}/chat/completions?api-version=2024-10-21`, {
    method: "POST",
    headers: {
      "api-key": params.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    }),
  });

  return {
    text: payload.choices?.[0]?.message?.content ?? "",
    finishReason: payload.choices?.[0]?.finish_reason ?? "stop",
    inputTokens: payload.usage?.prompt_tokens ?? estimateTokens(params.messages.map((message) => message.content).join("\n")),
    outputTokens: payload.usage?.completion_tokens ?? estimateTokens(payload.choices?.[0]?.message?.content ?? ""),
  };
}

async function dispatchProvider(
  route: ModelRouteDecision,
  input: GenerateInput,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<ProviderResult | null> {
  switch (route.provider) {
    case "openai":
      return callOpenAIResponses({
        baseUrl: input.settings.openaiBaseUrl,
        apiKey: input.settings.openaiKey,
        model: route.model,
        system: input.system,
        user: input.user,
        temperature,
        maxTokens,
      });
    case "anthropic":
      return callAnthropic({
        baseUrl: input.settings.anthropicBaseUrl,
        apiKey: input.settings.anthropicKey,
        model: route.model,
        system: input.system,
        user: input.user,
        temperature,
        maxTokens,
      });
    case "google":
      return callGemini({
        baseUrl: input.settings.googleBaseUrl,
        apiKey: input.settings.googleKey,
        model: route.model,
        system: input.system,
        user: input.user,
        temperature,
        maxTokens,
      });
    case "azure_openai":
      return callAzureOpenAI({
        endpoint: input.settings.azureEndpoint,
        apiKey: input.settings.azureKey,
        deployment: route.model,
        messages,
        temperature,
        maxTokens,
      });
    case "kimi":
      return callOpenAICompatible({
        baseUrl: input.settings.kimiBaseUrl,
        apiKey: input.settings.kimiKey,
        model: route.model,
        messages,
        temperature,
        maxTokens,
      });
    case "glm":
      return callOpenAICompatible({
        baseUrl: input.settings.glmBaseUrl,
        apiKey: input.settings.glmKey,
        model: route.model,
        messages,
        temperature,
        maxTokens,
      });
    case "deepseek":
      return callOpenAICompatible({
        baseUrl: input.settings.deepseekBaseUrl,
        apiKey: input.settings.deepseekKey,
        model: route.model,
        messages,
        temperature,
        maxTokens,
      });
    case "openrouter":
      return callOpenAICompatible({
        baseUrl: input.settings.openrouterBaseUrl,
        apiKey: input.settings.openrouterKey,
        model: route.model,
        messages,
        temperature,
        maxTokens,
      });
    default:
      return null;
  }
}

export async function generateWithModelProvider(input: GenerateInput): Promise<GenerateOutput> {
  const started = Date.now();
  const route = selectModelForTask(input.settings, input.lane);
  const temperature = input.temperature ?? 0.2;
  const maxTokens = input.maxTokens ?? 1200;
  const messages: ChatMessage[] = [
    { role: "system", content: input.system },
    { role: "user", content: input.user },
  ];

  // Intentional no-provider mode: honest local simulation, not an error.
  if (route.provider === "local") {
    return localGenerate(input, route, Date.now() - started);
  }

  try {
    const result = await dispatchProvider(route, input, messages, temperature, maxTokens);

    // Unknown/unsupported provider — treat as no-provider, not as a failure.
    if (result === null) {
      return localGenerate(input, route, Date.now() - started);
    }

    // A 200 with empty/blocked content must not be presented as a successful live
    // run — surface it as a provider error so callers don't render emptiness as truth.
    if (!result.text.trim()) {
      console.error("[model-provider] provider returned an empty response", {
        provider: route.provider,
        lane: input.lane,
        model: route.model,
        finishReason: result.finishReason,
      });
      return localGenerate(
        input,
        providerErrorRoute(route, "The provider returned an empty response."),
        Date.now() - started,
        { providerError: true },
      );
    }

    return { route, ...result, latencyMs: Date.now() - started, localFallback: false, providerError: false };
  } catch (error) {
    // Log only structured diagnostics; raw provider messages can include tenant,
    // billing, endpoint, or credential-adjacent details.
    console.error("[model-provider] provider call failed", {
      provider: route.provider,
      lane: input.lane,
      model: route.model,
      ...providerFailureLogDetail(error),
    });
    return localGenerate(
      input,
      providerErrorRoute(route, "The model provider call failed."),
      Date.now() - started,
      { providerError: true },
    );
  }
}
