import type { Skill, Tool } from "./enterprise-ai-data.ts";
import { publicExternalServiceStatus, publicExternalServiceUnavailable } from "./api-errors.ts";
import { executeNativeConnector } from "./connector-adapters.ts";
import { buildConnectorExecutionEnvelope, type ConnectorExecutionEnvelope } from "./connector-execution-envelope.ts";
import { evaluateConnectorPayloadSafety } from "./connector-payload-safety.ts";
import { evaluateToolPolicy, type PolicyDecision } from "./policy-engine.ts";
import { readTenantSecretValues } from "./tenant-secret-vault.ts";

export type ConnectorExecutionRequest = {
  organizationId: string;
  skill: Skill;
  toolId: string;
  payload: Record<string, unknown>;
  actor?: string;
  approved?: boolean;
  approvalId?: string;
  idempotencyKey?: string;
};

export type ConnectorExecutionResult = {
  id: string;
  status: "executed" | "requires_approval" | "blocked";
  toolId: string;
  decision: PolicyDecision;
  output: Record<string, unknown>;
  brokerMode: "external" | "native" | "policy-only";
  envelope: ConnectorExecutionEnvelope;
};

function connectorExecutionId() {
  return `connector-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function executeConnectorRequest(params: {
  request: ConnectorExecutionRequest;
  tools: Tool[];
}): Promise<ConnectorExecutionResult> {
  const executionId = connectorExecutionId();
  const createdAt = new Date().toISOString();
  const tool = params.tools.find((item) => item.id === params.request.toolId);
  const decision = evaluateToolPolicy({
    skill: params.request.skill,
    tool,
    toolId: params.request.toolId,
  });
  const envelopeForDecision = (policyDecision: PolicyDecision) => buildConnectorExecutionEnvelope({
    organizationId: params.request.organizationId,
    actor: params.request.actor,
    skill: params.request.skill,
    toolId: params.request.toolId,
    payload: params.request.payload,
    approved: params.request.approved,
    approvalId: params.request.approvalId,
    idempotencyKey: params.request.idempotencyKey,
    policy: policyDecision,
    executionId,
    createdAt,
  });

  if (decision.status === "blocked") {
    return {
      id: executionId,
      status: "blocked",
      toolId: params.request.toolId,
      decision,
      output: { message: decision.reason },
      brokerMode: "policy-only",
      envelope: envelopeForDecision(decision),
    };
  }

  if (decision.status === "requires_approval" && !params.request.approved) {
    return {
      id: executionId,
      status: "requires_approval",
      toolId: params.request.toolId,
      decision,
      output: { message: "Approval required before connector execution." },
      brokerMode: "policy-only",
      envelope: envelopeForDecision(decision),
    };
  }

  if (tool) {
    const payloadSafety = evaluateConnectorPayloadSafety({
      skillRiskLevel: params.request.skill.riskLevel,
      tool,
      toolId: params.request.toolId,
      payload: params.request.payload,
    });

    if (payloadSafety.status === "blocked") {
      return {
        id: executionId,
        status: "blocked",
        toolId: params.request.toolId,
        decision: payloadSafety,
        output: {
          message: payloadSafety.reason,
          safety: {
            findings: payloadSafety.findings,
            payloadSizeBytes: payloadSafety.payloadSizeBytes,
          },
        },
        brokerMode: "policy-only",
        envelope: envelopeForDecision(payloadSafety),
      };
    }
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
          "X-EAIEOS-Idempotency-Key": envelopeForDecision(decision).idempotencyKey,
          ...(process.env.CONNECTOR_BROKER_TOKEN ? { Authorization: `Bearer ${process.env.CONNECTOR_BROKER_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          schema: "enterprise-ai-enablement-os.connector-execution-request.v1",
          ...params.request,
          policyDecision: decision,
          executionEnvelope: envelopeForDecision(decision),
        }),
        signal: controller.signal,
      });
      const output = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const brokerStatus = publicExternalServiceStatus({
        serviceLabel: "External connector broker",
        response,
        responseBody: output,
      });
      const responseDecision: PolicyDecision = response.ok
        ? { ...decision, status: "approved" }
        : { ...decision, status: "blocked", reason: brokerStatus.error ?? "External broker rejected execution." };
      return {
        id: executionId,
        status: response.ok ? "executed" : "blocked",
        toolId: params.request.toolId,
        decision: responseDecision,
        output: response.ok
          ? output
          : {
              message: brokerStatus.error,
              brokerStatus,
            },
        brokerMode: "external",
        envelope: envelopeForDecision(responseDecision),
      };
    } catch {
      const brokerStatus = publicExternalServiceUnavailable("External connector broker");
      const blockedDecision: PolicyDecision = {
        ...decision,
        status: "blocked",
        reason: brokerStatus.error ?? "External connector broker is unavailable.",
      };
      return {
        id: executionId,
        status: "blocked",
        toolId: params.request.toolId,
        decision: blockedDecision,
        output: {
          message: brokerStatus.error,
          brokerStatus,
        },
        brokerMode: "external",
        envelope: envelopeForDecision(blockedDecision),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  const nativeSecrets = await readTenantSecretValues(params.request.organizationId).catch(() => ({}));
  const nativeResult = await executeNativeConnector({
    request: params.request,
    secrets: { ...process.env, ...nativeSecrets },
  }).catch((): Awaited<ReturnType<typeof executeNativeConnector>> => ({
    handled: true,
    status: "blocked" as const,
    output: { message: "Native connector execution failed. No tool action was completed." },
  }));

  if (nativeResult.handled) {
    const nativeDecision: PolicyDecision = nativeResult.status === "executed"
      ? { ...decision, status: "approved" }
      : { ...decision, status: "blocked", reason: String(nativeResult.output.message ?? "Native connector execution failed.") };
    return {
      id: executionId,
      status: nativeResult.status,
      toolId: params.request.toolId,
      decision: nativeDecision,
      output: {
        connectorId: nativeResult.connectorId,
        ...nativeResult.output,
      },
      brokerMode: "native",
      envelope: envelopeForDecision(nativeDecision),
    };
  }

  const policyOnlyDecision: PolicyDecision = {
    ...decision,
    status: "approved",
    reason: `${decision.reason} [policy-only simulation: the policy decision is real, but no external action was executed]`,
  };
  return {
    id: executionId,
    status: "executed",
    toolId: params.request.toolId,
    decision: policyOnlyDecision,
    output: {
      message:
        "SIMULATED: policy evaluation succeeded but no external action was executed (policy-only mode). Configure MCP_BROKER_URL for real execution.",
      simulated: true,
      executionMode: "policy-only",
      payloadDigest: envelopeForDecision(policyOnlyDecision).payloadDigest,
    },
    brokerMode: "policy-only",
    envelope: envelopeForDecision(policyOnlyDecision),
  };
}
