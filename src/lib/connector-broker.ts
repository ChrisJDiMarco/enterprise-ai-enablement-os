import type { Skill, Tool } from "./enterprise-ai-data.ts";
import { executeNativeConnector } from "./connector-adapters.ts";
import { evaluateToolPolicy, type PolicyDecision } from "./policy-engine.ts";
import { readTenantSecretValues } from "./tenant-secret-vault.ts";

export type ConnectorExecutionRequest = {
  organizationId: string;
  skill: Skill;
  toolId: string;
  payload: Record<string, unknown>;
  approved?: boolean;
};

export type ConnectorExecutionResult = {
  id: string;
  status: "executed" | "requires_approval" | "blocked";
  toolId: string;
  decision: PolicyDecision;
  output: Record<string, unknown>;
  brokerMode: "external" | "native" | "policy-only";
};

function connectorExecutionId() {
  return `connector-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function executeConnectorRequest(params: {
  request: ConnectorExecutionRequest;
  tools: Tool[];
}): Promise<ConnectorExecutionResult> {
  const tool = params.tools.find((item) => item.id === params.request.toolId);
  const decision = evaluateToolPolicy({
    skill: params.request.skill,
    tool,
    toolId: params.request.toolId,
  });

  if (decision.status === "blocked") {
    return {
      id: connectorExecutionId(),
      status: "blocked",
      toolId: params.request.toolId,
      decision,
      output: { message: decision.reason },
      brokerMode: "policy-only",
    };
  }

  if (decision.status === "requires_approval" && !params.request.approved) {
    return {
      id: connectorExecutionId(),
      status: "requires_approval",
      toolId: params.request.toolId,
      decision,
      output: { message: "Approval required before connector execution." },
      brokerMode: "policy-only",
    };
  }

  const externalBrokerUrl = process.env.MCP_BROKER_URL || process.env.CONNECTOR_BROKER_URL;
  if (externalBrokerUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.CONNECTOR_BROKER_TIMEOUT_MS || 30_000));
    try {
      const response = await fetch(`${externalBrokerUrl.replace(/\/$/, "")}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EAIEOS-Connector-Envelope": "enterprise-ai-enablement-os.connector-execution-request.v1",
          ...(process.env.CONNECTOR_BROKER_TOKEN ? { Authorization: `Bearer ${process.env.CONNECTOR_BROKER_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          schema: "enterprise-ai-enablement-os.connector-execution-request.v1",
          ...params.request,
          policyDecision: decision,
        }),
        signal: controller.signal,
      });
      const output = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const rejectionReason =
        typeof output.error === "string"
          ? output.error
          : typeof output.message === "string"
            ? output.message
            : "External broker rejected execution.";
      return {
        id: connectorExecutionId(),
        status: response.ok ? "executed" : "blocked",
        toolId: params.request.toolId,
        decision: response.ok ? { ...decision, status: "approved" } : { ...decision, status: "blocked", reason: rejectionReason },
        output,
        brokerMode: "external",
      };
    } catch (error) {
      return {
        id: connectorExecutionId(),
        status: "blocked",
        toolId: params.request.toolId,
        decision: {
          ...decision,
          status: "blocked",
          reason: `External broker unavailable: ${error instanceof Error ? error.message : "unknown error"}.`,
        },
        output: {
          message: "External connector broker could not be reached. No tool action was executed.",
        },
        brokerMode: "external",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  const nativeSecrets = await readTenantSecretValues(params.request.organizationId).catch(() => ({}));
  const nativeResult = await executeNativeConnector({
    request: params.request,
    secrets: { ...process.env, ...nativeSecrets },
  }).catch((error): Awaited<ReturnType<typeof executeNativeConnector>> => ({
    handled: true,
    status: "blocked" as const,
    output: { message: error instanceof Error ? error.message : "Native connector execution failed." },
  }));

  if (nativeResult.handled) {
    return {
      id: connectorExecutionId(),
      status: nativeResult.status,
      toolId: params.request.toolId,
      decision: nativeResult.status === "executed"
        ? { ...decision, status: "approved" }
        : { ...decision, status: "blocked", reason: String(nativeResult.output.message ?? "Native connector execution failed.") },
      output: {
        connectorId: nativeResult.connectorId,
        ...nativeResult.output,
      },
      brokerMode: "native",
    };
  }

  return {
    id: connectorExecutionId(),
    status: "executed",
    toolId: params.request.toolId,
    decision: { ...decision, status: "approved" },
    output: {
      message: "Connector execution recorded in policy-only mode. Configure MCP_BROKER_URL for real execution.",
      simulated: true,
      executionMode: "policy-only",
      payloadEcho: params.request.payload,
    },
    brokerMode: "policy-only",
  };
}
