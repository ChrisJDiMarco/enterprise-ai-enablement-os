import { outboundUrlIssue } from "./url-safety.ts";

/**
 * Live broker reachability — distinct from the env-presence "configured" status.
 * Connector readiness previously reported "broker-managed" purely because a URL
 * env var was set, so operators saw green then hit "broker unavailable" only at
 * skill-run time. This actually probes the broker.
 */
export type BrokerHealth = {
  mode: "mcp-broker" | "connector-broker" | "policy-only";
  urlConfigured: boolean;
  reachable: boolean | null; // null = nothing to probe (policy-only)
  status?: number;
  detail: string;
  checkedAt: string;
};

export async function probeConnectorBrokerHealth(
  env: Record<string, string | undefined> = process.env,
  now: Date = new Date(),
): Promise<BrokerHealth> {
  const checkedAt = now.toISOString();
  const mcpUrl = env.MCP_BROKER_URL?.trim();
  const connectorUrl = env.CONNECTOR_BROKER_URL?.trim();
  const url = mcpUrl || connectorUrl || "";
  const mode: BrokerHealth["mode"] = mcpUrl ? "mcp-broker" : connectorUrl ? "connector-broker" : "policy-only";

  if (!url) {
    return {
      mode,
      urlConfigured: false,
      reachable: null,
      detail: "No broker URL configured — connector execution is policy-only (no real tool calls are made).",
      checkedAt,
    };
  }
  if (outboundUrlIssue(url)) {
    return {
      mode,
      urlConfigured: true,
      reachable: false,
      detail: "Broker URL failed the outbound safety check (SSRF guard) and was not probed.",
      checkedAt,
    };
  }

  const token = env.MCP_BROKER_TOKEN?.trim() || env.CONNECTOR_BROKER_TOKEN?.trim();
  const timeoutMs = Number(env.CONNECTOR_BROKER_TIMEOUT_MS) > 0 ? Math.min(Number(env.CONNECTOR_BROKER_TIMEOUT_MS), 10_000) : 5_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    // Any HTTP response (even 401/404) proves the broker host is reachable; only a
    // network failure / timeout means it's down.
    return {
      mode,
      urlConfigured: true,
      reachable: true,
      status: response.status,
      detail: `Broker reachable (HTTP ${response.status}).`,
      checkedAt,
    };
  } catch {
    return {
      mode,
      urlConfigured: true,
      reachable: false,
      detail: "Broker URL is unreachable (timeout or network error); tool calls will fail at run time.",
      checkedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}
