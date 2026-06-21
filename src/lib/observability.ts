import { tenantSecretRuntimeValueIsUsable, tenantSecretValueIssue } from "./tenant-secret-format.ts";
import { outboundUrlIssue } from "./url-safety.ts";

export type ObservabilityLevel = "info" | "warn" | "error";

export type OperationalMetadataValue =
  | string
  | number
  | boolean
  | null
  | OperationalMetadataValue[]
  | { [key: string]: OperationalMetadataValue };

export type OperationalEvent = {
  schema: "enterprise-ai-enablement-os.operational-event.v1";
  id: string;
  organizationId: string;
  name: string;
  level: ObservabilityLevel;
  route?: string;
  actor?: string;
  metadata: Record<string, OperationalMetadataValue>;
  createdAt: string;
};

export type ObservabilityConfig = {
  configured: boolean;
  mode: "external-log-drain" | "external-telemetry-declared" | "local-console" | "missing";
  reason: string;
  sinks: string[];
};

type RuntimeEnv = Record<string, string | undefined>;

const redactedValue = "[redacted]";
const omittedValue = "[omitted]";
const maxMetadataDepth = 4;
const maxMetadataKeys = 32;
const maxMetadataArrayItems = 20;
const maxMetadataStringLength = 240;

const sensitiveMetadataKeyPattern =
  /(?:token|secret|password|credential|authorization|api[_-]?key|private[_-]?key|session|cookie|dsn|email|prompt|message|body|payload|raw|response|content|transcript)/i;
const secretBearingUrlPattern =
  /https?:\/\/(?:hooks\.slack\.com\/services\/\S+|[^\s,;]*(?:token|secret|webhook|api[_-]?key|password|credential)[^\s,;]*)/i;
const sensitiveMetadataStringPatterns = [
  secretBearingUrlPattern,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b\d{3}-\d{2}-\d{4}\b/i,
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/i,
  /\b(?:\d[ -]*?){13,19}\b/i,
  /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|id[_ -]?token|bearer[_ -]?token|token|authorization|client[_ -]?secret|secret|password|credential|private[_ -]?key)\s*[:=]\s*[^\s,;&]+/i,
  /\b(?:bearer|authorization|api[_ -]?key|secret|password|credential|private key|session token)\b/i,
  /\b(?:sk|xox[baprs]|ghp|github_pat|glpat|ya29|eyJ)[A-Za-z0-9._-]{12,}\b/i,
  /\b(?:postgres|postgresql|mysql|redis|mongodb):\/\/[^\s]+/i,
  /\b(?=[A-Za-z0-9+/]{32,}={0,2}\b)(?=[A-Za-z0-9+/]*[A-Z])(?=[A-Za-z0-9+/]*[a-z])(?=[A-Za-z0-9+/]*\d)[A-Za-z0-9+/]{32,}={0,2}\b/,
];

function configuredLogDrainUrl(env: RuntimeEnv) {
  const value = env.LOG_DRAIN_URL?.trim();
  return value && tenantSecretRuntimeValueIsUsable("LOG_DRAIN_URL", value) ? value : "";
}

function configuredOtelEndpoint(env: RuntimeEnv) {
  const value = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  return value && tenantSecretRuntimeValueIsUsable("OTEL_EXPORTER_OTLP_ENDPOINT", value) ? value : "";
}

function sentryDsnIssue(env: RuntimeEnv) {
  const value = env.SENTRY_DSN?.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "SENTRY_DSN must be a valid HTTP(S) DSN.";
    }
    if (!url.host || !url.pathname.replace(/\//g, "")) {
      return "SENTRY_DSN must include a host and project path.";
    }
    if (url.password) {
      return "SENTRY_DSN must not embed passwords.";
    }
    if (url.hash) {
      return "SENTRY_DSN must not include URL fragments.";
    }
    return "";
  } catch {
    return "SENTRY_DSN must be a valid HTTP(S) DSN.";
  }
}

function configuredSentryDsn(env: RuntimeEnv) {
  return env.SENTRY_DSN?.trim() && !sentryDsnIssue(env) ? env.SENTRY_DSN.trim() : "";
}

function logDrainUrlIssue(env: RuntimeEnv) {
  const value = env.LOG_DRAIN_URL?.trim();
  return value ? tenantSecretValueIssue("LOG_DRAIN_URL", value) : "";
}

function otelEndpointIssue(env: RuntimeEnv) {
  const value = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  return value ? tenantSecretValueIssue("OTEL_EXPORTER_OTLP_ENDPOINT", value) : "";
}

function invalidTelemetryReasons(env: RuntimeEnv) {
  return [
    logDrainUrlIssue(env) ? `LOG_DRAIN_URL is ignored because ${logDrainUrlIssue(env)}` : "",
    otelEndpointIssue(env) ? `OTEL_EXPORTER_OTLP_ENDPOINT is ignored because ${otelEndpointIssue(env)}` : "",
    sentryDsnIssue(env) ? `SENTRY_DSN is ignored because ${sentryDsnIssue(env)}` : "",
  ].filter(Boolean);
}

export function observabilityConfigFromEnv(env: RuntimeEnv = process.env): ObservabilityConfig {
  const logDrainUrl = configuredLogDrainUrl(env);
  const otelEndpoint = configuredOtelEndpoint(env);
  const sentryDsn = configuredSentryDsn(env);
  const invalidReasons = invalidTelemetryReasons(env);
  const sinks = [
    logDrainUrl ? "log-drain" : "",
    otelEndpoint ? "otel" : "",
    sentryDsn ? "sentry" : "",
  ].filter(Boolean);

  if (logDrainUrl) {
    return {
      configured: true,
      mode: "external-log-drain",
      reason: "LOG_DRAIN_URL is configured for operational event forwarding.",
      sinks,
    };
  }

  if (otelEndpoint || sentryDsn) {
    return {
      configured: true,
      mode: "external-telemetry-declared",
      reason: invalidReasons.length
        ? `External telemetry configuration is declared. ${invalidReasons.join(" ")}`
        : "External telemetry configuration is declared. Runtime event forwarding can be bridged by the hosting platform.",
      sinks,
    };
  }

  if (env.NODE_ENV !== "production" || env.ALLOW_LOCAL_OBSERVABILITY_IN_PRODUCTION === "true") {
    return {
      configured: true,
      mode: "local-console",
      reason: "Operational events are available through local console output.",
      sinks: ["console"],
    };
  }

  return {
    configured: false,
    mode: "missing",
    reason: invalidReasons.length
      ? `Telemetry configuration is invalid: ${invalidReasons.join(" ")}`
      : "Configure LOG_DRAIN_URL, OTEL_EXPORTER_OTLP_ENDPOINT, or SENTRY_DSN before broad customer launch.",
    sinks: [],
  };
}

export function sanitizeOperationalMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, OperationalMetadataValue> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const seen = new WeakSet<object>();
  return sanitizeMetadataObject(metadata, 0, seen);
}

export function sanitizeOperationalText(value: string | undefined, fallback: string, maxLength = 240) {
  const trimmed = (value || fallback).trim();
  const sanitized = sanitizeMetadataString(trimmed);
  return (typeof sanitized === "string" ? sanitized : fallback).slice(0, maxLength) || fallback;
}

export async function recordOperationalEvent(params: {
  organizationId: string;
  name: string;
  level?: ObservabilityLevel;
  route?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
  env?: RuntimeEnv;
}): Promise<{ event: OperationalEvent; delivered: boolean; sink: string; error?: string }> {
  const event: OperationalEvent = {
    schema: "enterprise-ai-enablement-os.operational-event.v1",
    id: `op-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    organizationId: sanitizeOperationalText(params.organizationId, "unknown-organization", 180),
    name: sanitizeOperationalText(params.name, "operational.event", 160),
    level: params.level ?? "info",
    route: params.route ? sanitizeOperationalText(params.route, "unknown-route", 240) : undefined,
    actor: params.actor ? sanitizeOperationalText(params.actor, "Unknown actor", 180) : undefined,
    metadata: sanitizeOperationalMetadata(params.metadata),
    createdAt: new Date().toISOString(),
  };
  const env = params.env ?? process.env;

  const invalidLogDrainIssue = logDrainUrlIssue(env);
  const logDrainUrl = configuredLogDrainUrl(env);
  if (env.LOG_DRAIN_URL?.trim()) {
    if (invalidLogDrainIssue || !logDrainUrl) {
      return {
        event,
        delivered: false,
        sink: "log-drain",
        error: `LOG_DRAIN_URL is invalid: ${invalidLogDrainIssue || "LOG_DRAIN_URL must be a valid HTTP(S) URL."}`,
      };
    }
    const ssrfIssue = outboundUrlIssue(logDrainUrl);
    if (ssrfIssue) {
      return {
        event,
        delivered: false,
        sink: "log-drain",
        error: `LOG_DRAIN_URL is not permitted: ${ssrfIssue}`,
      };
    }
    const delivered = await postLogDrain(logDrainUrl, event, env.LOG_DRAIN_TOKEN);
    return { event, ...delivered };
  }

  if (env.NODE_ENV !== "test") {
    const logger = event.level === "error" ? console.error : event.level === "warn" ? console.warn : console.info;
    logger(JSON.stringify(event));
  }
  return { event, delivered: true, sink: "console" };
}

async function postLogDrain(
  url: string,
  event: OperationalEvent,
  token?: string,
): Promise<{ delivered: boolean; sink: string; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(event),
    });
    return {
      delivered: response.ok,
      sink: "log-drain",
      error: response.ok ? undefined : `Log drain delivery failed with status ${response.status}.`,
    };
  } catch {
    return {
      delivered: false,
      sink: "log-drain",
      error: "Log drain is unavailable or returned an error.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeMetadataObject(
  value: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>,
): Record<string, OperationalMetadataValue> {
  if (seen.has(value)) return { circular: omittedValue };
  seen.add(value);

  const entries = Object.entries(value);
  const sanitized: Record<string, OperationalMetadataValue> = {};

  for (const [key, rawValue] of entries.slice(0, maxMetadataKeys)) {
    sanitized[key] = metadataKeyLooksSensitive(key)
      ? redactedValue
      : sanitizeMetadataValue(rawValue, depth + 1, seen);
  }

  if (entries.length > maxMetadataKeys) {
    sanitized._truncatedKeys = entries.length - maxMetadataKeys;
  }

  seen.delete(value);
  return sanitized;
}

function sanitizeMetadataValue(value: unknown, depth: number, seen: WeakSet<object>): OperationalMetadataValue {
  if (value === null) return null;

  if (typeof value === "string") {
    return sanitizeMetadataString(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : omittedValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return omittedValue;
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : omittedValue;
  }

  if (Array.isArray(value)) {
    if (depth > maxMetadataDepth) return omittedValue;
    const sanitized = value
      .slice(0, maxMetadataArrayItems)
      .map((item) => sanitizeMetadataValue(item, depth + 1, seen));
    if (value.length > maxMetadataArrayItems) sanitized.push(`...${value.length - maxMetadataArrayItems} more`);
    return sanitized;
  }

  if (typeof value === "object") {
    if (depth > maxMetadataDepth) return omittedValue;
    return sanitizeMetadataObject(value as Record<string, unknown>, depth, seen);
  }

  return omittedValue;
}

function metadataKeyLooksSensitive(key: string) {
  return sensitiveMetadataKeyPattern.test(key);
}

function sanitizeMetadataString(value: string) {
  const trimmed = value.trim();
  if (sensitiveMetadataStringPatterns.some((pattern) => pattern.test(trimmed))) return redactedValue;
  if (trimmed.length > maxMetadataStringLength) {
    return `${trimmed.slice(0, maxMetadataStringLength)}...`;
  }
  return trimmed;
}
