export type ObservabilityLevel = "info" | "warn" | "error";

export type OperationalEvent = {
  schema: "enterprise-ai-enablement-os.operational-event.v1";
  id: string;
  organizationId: string;
  name: string;
  level: ObservabilityLevel;
  route?: string;
  actor?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ObservabilityConfig = {
  configured: boolean;
  mode: "external-log-drain" | "external-telemetry-declared" | "local-console" | "missing";
  reason: string;
  sinks: string[];
};

type RuntimeEnv = Record<string, string | undefined>;

export function observabilityConfigFromEnv(env: RuntimeEnv = process.env): ObservabilityConfig {
  const sinks = [
    env.LOG_DRAIN_URL ? "log-drain" : "",
    env.OTEL_EXPORTER_OTLP_ENDPOINT ? "otel" : "",
    env.SENTRY_DSN ? "sentry" : "",
  ].filter(Boolean);

  if (env.LOG_DRAIN_URL) {
    return {
      configured: true,
      mode: "external-log-drain",
      reason: "LOG_DRAIN_URL is configured for operational event forwarding.",
      sinks,
    };
  }

  if (env.OTEL_EXPORTER_OTLP_ENDPOINT || env.SENTRY_DSN) {
    return {
      configured: true,
      mode: "external-telemetry-declared",
      reason: "External telemetry configuration is declared. Runtime event forwarding can be bridged by the hosting platform.",
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
    reason: "Configure LOG_DRAIN_URL, OTEL_EXPORTER_OTLP_ENDPOINT, or SENTRY_DSN before broad customer launch.",
    sinks: [],
  };
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
    organizationId: params.organizationId,
    name: params.name,
    level: params.level ?? "info",
    route: params.route,
    actor: params.actor,
    metadata: params.metadata ?? {},
    createdAt: new Date().toISOString(),
  };
  const env = params.env ?? process.env;

  if (env.LOG_DRAIN_URL) {
    const delivered = await postLogDrain(env.LOG_DRAIN_URL, event, env.LOG_DRAIN_TOKEN);
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
      error: response.ok ? undefined : `${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      delivered: false,
      sink: "log-drain",
      error: error instanceof Error ? error.message : "Unknown log drain error.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
