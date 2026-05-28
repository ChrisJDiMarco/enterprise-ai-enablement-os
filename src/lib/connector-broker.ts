import type { Skill, Tool } from "@/lib/enterprise-ai-data";
import { evaluateToolPolicy, PolicyDecision } from "@/lib/policy-engine";

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
  brokerMode: "external" | "policy-only";
};

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
      id: `connector-${Date.now()}`,
      status: "blocked",
      toolId: params.request.toolId,
      decision,
      output: { message: decision.reason },
      brokerMode: "policy-only",
    };
  }

  if (decision.status === "requires_approval" && !params.request.approved) {
    return {
      id: `connector-${Date.now()}`,
      status: "requires_approval",
      toolId: params.request.toolId,
      decision,
      output: { message: "Approval required before connector execution." },
      brokerMode: "policy-only",
    };
  }

  const externalBrokerUrl = process.env.MCP_BROKER_URL || process.env.CONNECTOR_BROKER_URL;
  if (externalBrokerUrl) {
    const response = await fetch(`${externalBrokerUrl.replace(/\/$/, "")}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CONNECTOR_BROKER_TOKEN ? { Authorization: `Bearer ${process.env.CONNECTOR_BROKER_TOKEN}` } : {}),
      },
      body: JSON.stringify(params.request),
    });
    const output = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      id: `connector-${Date.now()}`,
      status: response.ok ? "executed" : "blocked",
      toolId: params.request.toolId,
      decision: response.ok ? { ...decision, status: "approved" } : { ...decision, status: "blocked", reason: "External broker rejected execution." },
      output,
      brokerMode: "external",
    };
  }

  return {
    id: `connector-${Date.now()}`,
    status: "executed",
    toolId: params.request.toolId,
    decision: { ...decision, status: "approved" },
    output: {
      message: "Connector execution recorded in policy-only mode. Configure MCP_BROKER_URL for real execution.",
      payloadEcho: params.request.payload,
    },
    brokerMode: "policy-only",
  };
}
