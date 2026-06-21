import { createHash } from "node:crypto";
import type { PolicyDecision } from "@/lib/policy-engine";
import type { Skill } from "@/lib/enterprise-ai-data";

export type ConnectorApprovalEvidence = {
  approved: boolean;
  approvedBy?: string;
  approvalId?: string;
  approvedAt?: string;
};

export type ConnectorExecutionEnvelope = {
  schema: "enterprise-ai-enablement-os.connector-execution-envelope.v1";
  executionId: string;
  idempotencyKey: string;
  organizationId: string;
  actor: string;
  skill: {
    id: string;
    name: string;
    riskLevel: Skill["riskLevel"];
    autonomyTier: Skill["autonomyTier"];
    version: string;
  };
  toolId: string;
  payloadDigest: string;
  payloadSizeBytes: number;
  payloadPreview: Record<string, unknown>;
  approval: ConnectorApprovalEvidence;
  policy: PolicyDecision;
  controls: string[];
  createdAt: string;
};

const redacted = "[redacted]";
const omitted = "[omitted]";
const maxDepth = 4;
const maxKeys = 24;
const maxArrayItems = 12;
const maxStringLength = 280;
const safeIdempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/;
const sensitiveKeyPattern =
  /(?:token|secret|password|credential|authorization|api[_-]?key|private[_-]?key|session|cookie|payload|raw|body|content|transcript|email|phone|ssn)/i;
const evidenceFreeformKeyPattern =
  /(?:message|text|summary|description|note|comment|query|search|prompt|instruction|subject|title|name|label|reason|question|answer)/i;
const evidenceSafeKeyPattern =
  /(?:^id$|id$|identifier|slug|status|state|type|kind|category|source|provider|vendor|system|region|department|environment|method|path|endpoint|resource|object|entity|version|risk[_-]?level|autonomy[_-]?tier|action[_-]?type|mode|scope|tenant|workspace|project|ticket|issue|run|trace|span|eval|proof|approval|order|connector|tool|skill)/i;
const safeEvidenceScalarPattern = /^[A-Za-z0-9._:/@#-]{1,120}$/;
const sensitiveStringPatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b\d{3}-\d{2}-\d{4}\b/i,
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/i,
  /\b(?:\d[ -]*?){13,19}\b/i,
  /\b(?:bearer|authorization|api[_ -]?key|secret|password|credential|private key|session token)\b/i,
  /\b(?:access[_ -]?token|refresh[_ -]?token|id[_ -]?token|api[_ -]?key|secret|password|credential|session|code)=\S+/i,
  /\b(?:sk|xox[baprs]|ghp|github_pat|glpat|ya29|eyJ)[A-Za-z0-9._-]{12,}\b/i,
  /\b(?:postgres|postgresql|mysql|redis|mongodb):\/\/[^\s]+/i,
];

function stableJsonValue(value: unknown, seen: WeakSet<object>): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(omitted);
  if (typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") return JSON.stringify(omitted);
  if (value instanceof Date) return JSON.stringify(Number.isFinite(value.getTime()) ? value.toISOString() : omitted);
  if (Array.isArray(value)) {
    if (seen.has(value)) return JSON.stringify(omitted);
    seen.add(value);
    const serialized = `[${value.map((item) => stableJsonValue(item, seen)).join(",")}]`;
    seen.delete(value);
    return serialized;
  }
  if (seen.has(value)) return JSON.stringify(omitted);
  seen.add(value);
  const serialized = `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJsonValue((value as Record<string, unknown>)[key], seen)}`)
    .join(",")}}`;
  seen.delete(value);
  return serialized;
}

function stableJson(value: unknown): string {
  return stableJsonValue(value, new WeakSet<object>());
}

function safeIdempotencyKey(value: string | undefined, fallbackSeed: Record<string, unknown>) {
  const trimmed = value?.trim();
  if (
    trimmed &&
    safeIdempotencyKeyPattern.test(trimmed) &&
    !sensitiveStringPatterns.some((pattern) => pattern.test(trimmed))
  ) {
    return trimmed;
  }

  return `generated:${digest({
    ...fallbackSeed,
    clientIdempotencyKeyDigest: trimmed ? digest(trimmed) : "missing",
  })}`;
}

function digest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function sanitizeString(value: string) {
  if (sensitiveStringPatterns.some((pattern) => pattern.test(value))) return redacted;
  return value.length > maxStringLength ? `${value.slice(0, maxStringLength)}...` : value;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null) return null;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : omitted;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") return omitted;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : omitted;
  if (Array.isArray(value)) {
    if (depth >= maxDepth) return omitted;
    const sanitized = value.slice(0, maxArrayItems).map((item) => sanitizeValue(item, depth + 1, seen));
    if (value.length > maxArrayItems) sanitized.push(`...${value.length - maxArrayItems} more`);
    return sanitized;
  }
  if (typeof value === "object") {
    if (depth >= maxDepth) return omitted;
    if (seen.has(value)) return omitted;
    seen.add(value);
    const entries = Object.entries(value as Record<string, unknown>);
    const sanitized: Record<string, unknown> = {};
    for (const [key, raw] of entries.slice(0, maxKeys)) {
      sanitized[key] = sensitiveKeyPattern.test(key) ? redacted : sanitizeValue(raw, depth + 1, seen);
    }
    if (entries.length > maxKeys) sanitized._truncatedKeys = entries.length - maxKeys;
    seen.delete(value);
    return sanitized;
  }
  return omitted;
}

export function redactConnectorPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeValue(payload, 0, new WeakSet<object>());
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized) ? sanitized as Record<string, unknown> : {};
}

function sanitizeEvidenceString(key: string, value: string) {
  const sanitized = sanitizeString(value);
  if (sanitized === redacted) return redacted;
  if (sensitiveKeyPattern.test(key) || evidenceFreeformKeyPattern.test(key)) return redacted;
  if (evidenceSafeKeyPattern.test(key) || safeEvidenceScalarPattern.test(sanitized)) return sanitized;
  return redacted;
}

function sanitizeEvidenceValue(value: unknown, key: string, depth: number, seen: WeakSet<object>): unknown {
  if (value === null) return null;
  if (typeof value === "string") return sanitizeEvidenceString(key, value);
  if (typeof value === "number") return Number.isFinite(value) ? value : omitted;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") return omitted;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : omitted;
  if (Array.isArray(value)) {
    if (depth >= maxDepth) return omitted;
    const sanitized = value.slice(0, maxArrayItems).map((item) => sanitizeEvidenceValue(item, key, depth + 1, seen));
    if (value.length > maxArrayItems) sanitized.push(`...${value.length - maxArrayItems} more`);
    return sanitized;
  }
  if (typeof value === "object") {
    if (depth >= maxDepth) return omitted;
    if (seen.has(value)) return omitted;
    seen.add(value);
    const entries = Object.entries(value as Record<string, unknown>);
    const sanitized: Record<string, unknown> = {};
    for (const [childKey, raw] of entries.slice(0, maxKeys)) {
      sanitized[childKey] = sensitiveKeyPattern.test(childKey)
        ? redacted
        : sanitizeEvidenceValue(raw, childKey, depth + 1, seen);
    }
    if (entries.length > maxKeys) sanitized._truncatedKeys = entries.length - maxKeys;
    seen.delete(value);
    return sanitized;
  }
  return omitted;
}

export function redactConnectorEvidencePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeEvidenceValue(payload, "", 0, new WeakSet<object>());
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized) ? sanitized as Record<string, unknown> : {};
}

export function connectorPayloadDigest(payload: Record<string, unknown>) {
  return `sha256:${digest(payload)}`;
}

export function buildConnectorExecutionEnvelope(params: {
  organizationId: string;
  actor?: string;
  skill: Skill;
  toolId: string;
  payload: Record<string, unknown>;
  approved?: boolean;
  approvalId?: string;
  approvedAt?: string;
  policy: PolicyDecision;
  executionId: string;
  idempotencyKey?: string;
  createdAt?: string;
}): ConnectorExecutionEnvelope {
  const payloadJson = stableJson(params.payload);
  const createdAt = params.createdAt ?? new Date().toISOString();
  const idempotencyKey = safeIdempotencyKey(params.idempotencyKey, {
    organizationId: params.organizationId,
    skillId: params.skill.id,
    toolId: params.toolId,
    payload: params.payload,
    policyId: params.policy.policyId,
  });

  return {
    schema: "enterprise-ai-enablement-os.connector-execution-envelope.v1",
    executionId: params.executionId,
    idempotencyKey,
    organizationId: params.organizationId,
    actor: params.actor || "Unknown actor",
    skill: {
      id: params.skill.id,
      name: params.skill.name,
      riskLevel: params.skill.riskLevel,
      autonomyTier: params.skill.autonomyTier,
      version: params.skill.version || "1",
    },
    toolId: params.toolId,
    payloadDigest: connectorPayloadDigest(params.payload),
    payloadSizeBytes: Buffer.byteLength(payloadJson, "utf8"),
    payloadPreview: redactConnectorEvidencePayload(params.payload),
    approval: {
      approved: Boolean(params.approved),
      ...(params.approved ? { approvedBy: params.actor || "Unknown actor", approvedAt: params.approvedAt ?? createdAt } : {}),
      ...(params.approvalId ? { approvalId: params.approvalId } : {}),
    },
    policy: params.policy,
    controls: [
      "tool_catalog_registration",
      "skill_allowlist",
      "autonomy_tier_boundary",
      "human_approval_gate",
      "payload_safety_gate",
      "action_type_method_binding",
      "credential_payload_block",
      "idempotency_key_sanitization",
      "payload_digest",
      "redacted_evidence",
      "broker_timeout_fail_closed",
    ],
    createdAt,
  };
}
