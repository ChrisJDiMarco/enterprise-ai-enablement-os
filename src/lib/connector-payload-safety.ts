import type { RiskLevel, Tool } from "./enterprise-ai-data.ts";
import type { PolicyDecision } from "./policy-engine.ts";

export type ConnectorPayloadSafetyDecision = PolicyDecision & {
  findings: string[];
  payloadSizeBytes: number;
};

const defaultMaxPayloadBytes = 128_000;

const credentialKeyPattern =
  /(?:token|secret|password|credential|authorization|api[_-]?key|private[_-]?key|session|cookie)/i;
const credentialStringPatterns = [
  /\b(?:bearer|authorization|api[_ -]?key|secret|password|credential|private key|session token)\b/i,
  /\b(?:sk|xox[baprs]|ghp|github_pat|glpat|ya29|eyJ)[A-Za-z0-9._-]{12,}\b/i,
  /\b(?:postgres|postgresql|mysql|redis|mongodb):\/\/[^\s]+/i,
];
const readMethods = new Set(["GET", "HEAD"]);
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const nativeWriteOnlyNamespaces = new Set(["slack", "service_now", "servicenow"]);
const microsoftNamespaces = new Set(["microsoft", "msgraph", "teams", "sharepoint"]);

function payloadJsonSize(payload: Record<string, unknown>) {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

function higherRisk(left: RiskLevel, right: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high", "restricted"];
  return order.indexOf(left) > order.indexOf(right) ? left : right;
}

function maxPayloadBytesFromEnv(env: Record<string, string | undefined> = process.env) {
  const parsed = Number(env.CONNECTOR_PAYLOAD_MAX_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultMaxPayloadBytes;
}

function toolNamespace(toolId: string) {
  return toolId.split(/[.:]/)[0]?.toLowerCase() ?? "";
}

function stringValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function payloadContainsCredential(value: unknown, keyPath: string[] = []): boolean {
  if (typeof value === "string") {
    if (credentialKeyPattern.test(keyPath.at(-1) ?? "") && value.trim()) return true;
    return credentialStringPatterns.some((pattern) => pattern.test(value));
  }

  if (Array.isArray(value)) {
    return value.some((item, index) => payloadContainsCredential(item, [...keyPath, String(index)]));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, item]) =>
      payloadContainsCredential(item, [...keyPath, key]),
    );
  }

  return false;
}

function actionTypeAllowsMethod(actionType: Tool["actionType"], method: string) {
  if (!method) return true;
  const normalized = method.toUpperCase();

  if (actionType === "read") return readMethods.has(normalized);
  if (actionType === "delete") return normalized === "DELETE";
  if (actionType === "create") return normalized === "POST";
  if (actionType === "update") return normalized === "PUT" || normalized === "PATCH" || normalized === "POST";
  return readMethods.has(normalized) || writeMethods.has(normalized);
}

function nativeActionMatchesTool(tool: Tool, toolId: string, payload: Record<string, unknown>) {
  const namespace = toolNamespace(toolId);
  const method = stringValue(payload, ["method", "httpMethod"]).toUpperCase();

  if (method && !actionTypeAllowsMethod(tool.actionType, method)) {
    return `${method} is not allowed for a ${tool.actionType} connector tool.`;
  }

  if (nativeWriteOnlyNamespaces.has(namespace) && tool.actionType === "read") {
    return `${namespace} native execution is write-only in this adapter and cannot run through a read tool.`;
  }

  if (namespace === "jira" && tool.actionType === "read") {
    const issueKey = stringValue(payload, ["issueKey", "key"]);
    const explicitlyRead = /\bread\b/i.test(toolId);
    if (!issueKey || !explicitlyRead) {
      return "Jira read tools must use an explicit read tool id and an issueKey payload.";
    }
  }

  if (microsoftNamespaces.has(namespace)) {
    const graphMethod = method || "GET";
    if (!actionTypeAllowsMethod(tool.actionType, graphMethod)) {
      return `Microsoft Graph ${graphMethod} is not allowed for a ${tool.actionType} connector tool.`;
    }
  }

  return "";
}

export function evaluateConnectorPayloadSafety(params: {
  skillRiskLevel: RiskLevel;
  tool: Tool;
  toolId: string;
  payload: Record<string, unknown>;
  env?: Record<string, string | undefined>;
}): ConnectorPayloadSafetyDecision {
  const findings: string[] = [];
  const payloadSizeBytes = payloadJsonSize(params.payload);
  const maxPayloadBytes = maxPayloadBytesFromEnv(params.env);
  const policyId = `${params.toolId}-payload-safety-v1`;

  if (payloadSizeBytes > maxPayloadBytes) {
    findings.push(`Payload is ${payloadSizeBytes} bytes, above the ${maxPayloadBytes} byte connector limit.`);
  }

  if (payloadContainsCredential(params.payload)) {
    findings.push("Connector payload appears to contain credentials or connection secrets. Store secrets in the tenant vault instead.");
  }

  const actionMismatch = nativeActionMatchesTool(params.tool, params.toolId, params.payload);
  if (actionMismatch) {
    findings.push(actionMismatch);
  }

  if (findings.length) {
    return {
      status: "blocked",
      reason: findings.join(" "),
      policyId,
      riskLevel: higherRisk(params.skillRiskLevel, "high"),
      findings,
      payloadSizeBytes,
    };
  }

  return {
    status: "approved",
    reason: "Connector payload passed size, credential, and action-boundary checks.",
    policyId,
    riskLevel: params.skillRiskLevel,
    findings,
    payloadSizeBytes,
  };
}
