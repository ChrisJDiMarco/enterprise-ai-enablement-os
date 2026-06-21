import type { Skill, Tool } from "./enterprise-ai-data.ts";
import { publicExternalServiceStatus, publicExternalServiceUnavailable } from "./api-errors.ts";
import { executeNativeConnector } from "./connector-adapters.ts";
import {
  buildConnectorExecutionEnvelope,
  redactConnectorPayload,
  type ConnectorExecutionEnvelope,
} from "./connector-execution-envelope.ts";
import { evaluateConnectorPayloadSafety } from "./connector-payload-safety.ts";
import { evaluateToolPolicy, type PolicyDecision } from "./policy-engine.ts";
import { readTenantSecretValues } from "./tenant-secret-vault.ts";
import { tenantSecretRuntimeValueIsUsable, tenantSecretValueIssue } from "./tenant-secret-format.ts";
import { assertSafeOutboundUrlSync, SsrfError } from "./url-safety.ts";

/**
 * Policy-only (rehearsal) connector execution returns a SIMULATED result instead
 * of performing a real action. That is acceptable in development, but in
 * production it must fail closed rather than fabricate success — unless an
 * operator explicitly accepts rehearsal-only mode.
 */
function policyOnlyConnectorsAllowed(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV !== "production" || env.ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION === "true";
}

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
  status: "executed" | "requires_approval" | "blocked" | "simulated";
  toolId: string;
  decision: PolicyDecision;
  output: Record<string, unknown>;
  brokerMode: "external" | "native" | "policy-only";
  envelope: ConnectorExecutionEnvelope;
};

function connectorExecutionId() {
  return `connector-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeConnectorOutput(output: Record<string, unknown>) {
  return redactConnectorPayload(output);
}

const brokerRuntimeSecretNames = [
  "MCP_BROKER_URL",
  "MCP_BROKER_TOKEN",
  "CONNECTOR_BROKER_URL",
  "CONNECTOR_BROKER_TOKEN",
] as const;

function runtimeValue(
  env: NodeJS.ProcessEnv,
  tenantSecrets: Record<string, string>,
  names: readonly string[],
) {
  for (const name of names) {
    const tenantValue = tenantSecrets[name]?.trim();
    if (tenantValue && tenantSecretRuntimeValueIsUsable(name, tenantValue)) return tenantValue;
    const envValue = env[name]?.trim();
    if (envValue && tenantSecretRuntimeValueIsUsable(name, envValue)) return envValue;
  }
  return "";
}

function firstInvalidRuntimeValue(
  env: NodeJS.ProcessEnv,
  tenantSecrets: Record<string, string>,
  names: readonly string[],
) {
  for (const name of names) {
    const tenantValue = tenantSecrets[name]?.trim();
    const tenantIssue = tenantValue ? tenantSecretValueIssue(name, tenantValue) : "";
    if (tenantIssue) return { name, issue: tenantIssue };
    if (tenantValue) continue;
    const envValue = env[name]?.trim();
    const envIssue = envValue ? tenantSecretValueIssue(name, envValue) : "";
    if (envIssue) return { name, issue: envIssue };
  }
  return null;
}

function brokerTimeoutMs(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number(env.CONNECTOR_BROKER_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed >= 1_000 && parsed <= 120_000 ? parsed : 30_000;
}

function brokerExecuteUrl(url: string) {
  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/\/$/, "");
  parsed.pathname = pathname.endsWith("/execute") ? pathname : `${pathname}/execute`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function externalBrokerConfig(
  env: NodeJS.ProcessEnv = process.env,
  tenantSecrets: Record<string, string> = {},
) {
  const invalidMcpBroker = firstInvalidRuntimeValue(env, tenantSecrets, ["MCP_BROKER_URL"]);
  if (invalidMcpBroker) {
    return {
      url: "",
      token: "",
      missingTokenLabel: "MCP_BROKER_TOKEN or CONNECTOR_BROKER_TOKEN",
      invalidConfig: invalidMcpBroker,
    };
  }
  const mcpUrl = runtimeValue(env, tenantSecrets, ["MCP_BROKER_URL"]);
  if (mcpUrl) {
    return {
      url: mcpUrl,
      token: runtimeValue(env, tenantSecrets, ["MCP_BROKER_TOKEN", "CONNECTOR_BROKER_TOKEN"]),
      missingTokenLabel: "MCP_BROKER_TOKEN or CONNECTOR_BROKER_TOKEN",
    };
  }
  const invalidConnectorBroker = firstInvalidRuntimeValue(env, tenantSecrets, ["CONNECTOR_BROKER_URL"]);
  if (invalidConnectorBroker) {
    return {
      url: "",
      token: "",
      missingTokenLabel: "CONNECTOR_BROKER_TOKEN",
      invalidConfig: invalidConnectorBroker,
    };
  }
  const connectorBrokerUrl = runtimeValue(env, tenantSecrets, ["CONNECTOR_BROKER_URL"]);
  if (connectorBrokerUrl) {
    return {
      url: connectorBrokerUrl,
      token: runtimeValue(env, tenantSecrets, ["CONNECTOR_BROKER_TOKEN"]),
      missingTokenLabel: "CONNECTOR_BROKER_TOKEN",
    };
  }
  return null;
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

  const brokerSecrets = await readTenantSecretValues(
    params.request.organizationId,
    [...brokerRuntimeSecretNames],
  ).catch(() => ({}));
  const externalBroker = externalBrokerConfig(process.env, brokerSecrets);
  if (externalBroker) {
    if ("invalidConfig" in externalBroker && externalBroker.invalidConfig) {
      const blockedDecision: PolicyDecision = {
        ...decision,
        status: "blocked",
        reason: `External connector broker configuration is invalid: ${externalBroker.invalidConfig.issue}`,
      };
      return {
        id: executionId,
        status: "blocked",
        toolId: params.request.toolId,
        decision: blockedDecision,
        output: {
          message: "External connector broker configuration is invalid.",
          invalidSecret: externalBroker.invalidConfig.name,
        },
        brokerMode: "external",
        envelope: envelopeForDecision(blockedDecision),
      };
    }

    if (!externalBroker.token) {
      const blockedDecision: PolicyDecision = {
        ...decision,
        status: "blocked",
        reason: `External connector broker URL is configured, but ${externalBroker.missingTokenLabel} is missing.`,
      };
      return {
        id: executionId,
        status: "blocked",
        toolId: params.request.toolId,
        decision: blockedDecision,
        output: {
          message: blockedDecision.reason,
          missingSecret: externalBroker.missingTokenLabel,
        },
        brokerMode: "external",
        envelope: envelopeForDecision(blockedDecision),
      };
    }
    const executeUrl = brokerExecuteUrl(externalBroker.url);
    try {
      assertSafeOutboundUrlSync(executeUrl);
    } catch (error) {
      const reason = error instanceof SsrfError ? error.message : "URL failed safety validation.";
      const blockedDecision: PolicyDecision = {
        ...decision,
        status: "blocked",
        reason: `External connector broker URL is not permitted: ${reason}`,
      };
      return {
        id: executionId,
        status: "blocked",
        toolId: params.request.toolId,
        decision: blockedDecision,
        output: { message: blockedDecision.reason },
        brokerMode: "external",
        envelope: envelopeForDecision(blockedDecision),
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), brokerTimeoutMs());
    try {
      const response = await fetch(executeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EAIEOS-Connector-Envelope": "enterprise-ai-enablement-os.connector-execution-request.v1",
          "X-EAIEOS-Idempotency-Key": envelopeForDecision(decision).idempotencyKey,
          Authorization: `Bearer ${externalBroker.token}`,
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
          ? safeConnectorOutput(output)
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
        ...safeConnectorOutput(nativeResult.output),
      },
      brokerMode: "native",
      envelope: envelopeForDecision(nativeDecision),
    };
  }

  // No external broker and no native adapter executed this tool. In production we
  // must fail closed instead of returning a fabricated success, unless rehearsal
  // mode is explicitly accepted.
  if (!policyOnlyConnectorsAllowed()) {
    const blockedDecision: PolicyDecision = {
      ...decision,
      status: "blocked",
      reason:
        "No connector adapter executed this tool and no external broker is configured. Refusing to simulate a connector action in production. Configure MCP_BROKER_URL/CONNECTOR_BROKER_URL or a native adapter, or set ALLOW_POLICY_ONLY_CONNECTORS_IN_PRODUCTION=true to explicitly accept rehearsal-only mode.",
    };
    return {
      id: executionId,
      status: "blocked",
      toolId: params.request.toolId,
      decision: blockedDecision,
      output: {
        message: blockedDecision.reason,
        executionMode: "policy-only",
        simulated: false,
      },
      brokerMode: "policy-only",
      envelope: envelopeForDecision(blockedDecision),
    };
  }

  // Rehearsal mode: the policy decision is real, but no external action ran. Keep
  // the genuine policy status (do NOT fabricate "approved") and rely on the
  // top-level status:"simulated" so callers never read it as executed.
  const policyOnlyDecision: PolicyDecision = {
    ...decision,
    reason: `${decision.reason} [policy-only rehearsal: the policy decision is real, but no external action was executed]`,
  };
  return {
    id: executionId,
    status: "simulated",
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
