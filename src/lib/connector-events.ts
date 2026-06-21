import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ConnectorExecutionResult } from "./connector-broker.ts";
import {
  redactConnectorEvidencePayload,
  redactConnectorPayload,
  type ConnectorExecutionEnvelope,
} from "./connector-execution-envelope.ts";
import { ensureDatabaseSchema, getDatabasePool } from "./database.ts";
import { tenantScopedJsonPath } from "./tenant-file-storage.ts";
import type { PolicyDecision, PolicyDecisionStatus } from "./policy-engine.ts";
import type { RiskLevel, Skill } from "./enterprise-ai-data.ts";

export type ConnectorEvent = {
  id: string;
  organizationId: string;
  skillId?: string;
  toolId: string;
  status: ConnectorExecutionResult["status"];
  decision: ConnectorExecutionResult["decision"];
  payload: Record<string, unknown>;
  envelope?: ConnectorExecutionEnvelope;
  createdAt: string;
};

export type ConnectorEventSummary = {
  total: number;
  executed: number;
  simulated: number;
  requiresApproval: number;
  blocked: number;
  envelopeCount: number;
  missingEnvelopeCount: number;
  redactedPayloadCount: number;
  latestAt?: string;
};

export type ConnectorEvidenceFreshness = {
  fresh: boolean;
  maxAgeDays: number;
  ageDays?: number;
  latestAt?: string;
  reason: string;
};

function payloadLooksRedacted(payload: Record<string, unknown>) {
  return JSON.stringify(payload).includes("[redacted]");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown, fallback: string, maxLength = 240) {
  const raw = typeof value === "string" ? value : fallback;
  const sanitized = redactConnectorPayload({ value: raw }).value;
  return (typeof sanitized === "string" ? sanitized : fallback).replace(/\s+/g, " ").trim().slice(0, maxLength) || fallback;
}

function cleanDate(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

const connectorStatuses = new Set<ConnectorExecutionResult["status"]>([
  "executed",
  "requires_approval",
  "blocked",
  "simulated",
]);
const policyStatuses = new Set<PolicyDecisionStatus>(["approved", "requires_approval", "blocked"]);
const riskLevels = new Set<RiskLevel>(["low", "medium", "high", "restricted"]);

function connectorStatus(value: unknown): ConnectorExecutionResult["status"] {
  return typeof value === "string" && connectorStatuses.has(value as ConnectorExecutionResult["status"])
    ? value as ConnectorExecutionResult["status"]
    : "blocked";
}

function decisionStatusFromEventStatus(status: ConnectorExecutionResult["status"]): PolicyDecisionStatus {
  if (status === "requires_approval") return "requires_approval";
  if (status === "blocked") return "blocked";
  return "approved";
}

function normalizePolicyDecision(input: unknown, eventStatus: ConnectorExecutionResult["status"]): PolicyDecision {
  const record = isRecord(input) ? input : {};
  const status = typeof record.status === "string" && policyStatuses.has(record.status as PolicyDecisionStatus)
    ? record.status as PolicyDecisionStatus
    : decisionStatusFromEventStatus(eventStatus);
  const riskLevel = typeof record.riskLevel === "string" && riskLevels.has(record.riskLevel as RiskLevel)
    ? record.riskLevel as RiskLevel
    : "medium";

  return {
    status,
    reason: cleanText(record.reason, "Connector event normalized by the event evidence store.", 700),
    policyId: cleanText(record.policyId, "connector-event-normalized-policy", 180),
    riskLevel,
  };
}

function normalizeApproval(input: unknown): ConnectorExecutionEnvelope["approval"] {
  const record = isRecord(input) ? input : {};
  const approved = record.approved === true;

  return {
    approved,
    ...(approved ? { approvedBy: cleanText(record.approvedBy, "Unknown actor", 180) } : {}),
    ...(typeof record.approvalId === "string" ? { approvalId: cleanText(record.approvalId, "", 180) } : {}),
    ...(typeof record.approvedAt === "string" ? { approvedAt: cleanDate(record.approvedAt) } : {}),
  };
}

function normalizeEnvelopeSkill(input: unknown): ConnectorExecutionEnvelope["skill"] {
  const record = isRecord(input) ? input : {};
  const riskLevel = typeof record.riskLevel === "string" && riskLevels.has(record.riskLevel as RiskLevel)
    ? record.riskLevel as RiskLevel
    : "medium";
  const autonomyTier = typeof record.autonomyTier === "string"
    ? record.autonomyTier as Skill["autonomyTier"]
    : "tier_2_prepare_action";

  return {
    id: cleanText(record.id, "unknown-skill", 180),
    name: cleanText(record.name, "Unknown Skill", 180),
    riskLevel,
    autonomyTier,
    version: cleanText(record.version, "1", 80),
  };
}

function normalizeEnvelope(input: unknown, fallback: ConnectorEvent): ConnectorExecutionEnvelope | undefined {
  if (!isRecord(input)) return undefined;
  const eventStatus = connectorStatus(fallback.status);
  const controls = Array.isArray(input.controls)
    ? input.controls.filter((control): control is string => typeof control === "string").slice(0, 40).map((control) => cleanText(control, "control", 120))
    : [];

  return {
    schema: "enterprise-ai-enablement-os.connector-execution-envelope.v1",
    executionId: cleanText(input.executionId, fallback.id, 180),
    idempotencyKey: cleanText(input.idempotencyKey, `event:${fallback.id}`, 180),
    organizationId: cleanText(input.organizationId, fallback.organizationId, 180),
    actor: cleanText(input.actor, "Unknown actor", 180),
    skill: normalizeEnvelopeSkill(input.skill),
    toolId: cleanText(input.toolId, fallback.toolId, 180),
    payloadDigest: cleanText(input.payloadDigest, "sha256:unavailable", 180),
    payloadSizeBytes: typeof input.payloadSizeBytes === "number" && Number.isFinite(input.payloadSizeBytes) ? Math.max(0, Math.round(input.payloadSizeBytes)) : 0,
    payloadPreview: redactConnectorEvidencePayload(isRecord(input.payloadPreview) ? input.payloadPreview : {}),
    approval: normalizeApproval(input.approval),
    policy: normalizePolicyDecision(input.policy, eventStatus),
    controls,
    createdAt: cleanDate(input.createdAt, fallback.createdAt),
  };
}

export function normalizeConnectorEvent(input: ConnectorEvent | Partial<ConnectorEvent>): ConnectorEvent {
  const fallbackCreatedAt = new Date().toISOString();
  const status = connectorStatus(input.status);
  const event: ConnectorEvent = {
    id: cleanText(input.id, `connector-event-${Date.now()}`, 180),
    organizationId: cleanText(input.organizationId, "unknown-organization", 180),
    skillId: input.skillId ? cleanText(input.skillId, "unknown-skill", 180) : undefined,
    toolId: cleanText(input.toolId, "unknown-tool", 180),
    status,
    decision: normalizePolicyDecision(input.decision, status),
    payload: redactConnectorEvidencePayload(isRecord(input.payload) ? input.payload : {}),
    createdAt: cleanDate(input.createdAt, fallbackCreatedAt),
  };
  const envelope = normalizeEnvelope(input.envelope, event);
  return envelope ? { ...event, envelope } : event;
}

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function connectorEvidenceFreshness(
  summary?: ConnectorEventSummary,
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
): ConnectorEvidenceFreshness {
  const maxAgeDays = positiveInteger(env.CONNECTOR_EVIDENCE_MAX_AGE_DAYS, 30);
  if (!summary?.latestAt) {
    return {
      fresh: false,
      maxAgeDays,
      reason: "No connector execution timestamp is available.",
    };
  }

  const latestMs = Date.parse(summary.latestAt);
  if (!Number.isFinite(latestMs)) {
    return {
      fresh: false,
      maxAgeDays,
      latestAt: summary.latestAt,
      reason: "Latest connector execution timestamp is invalid.",
    };
  }

  const ageMs = Math.max(0, now.getTime() - latestMs);
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  const fresh = ageMs <= maxAgeMs;

  return {
    fresh,
    maxAgeDays,
    ageDays,
    latestAt: summary.latestAt,
    reason: fresh
      ? `Latest connector execution evidence is ${ageDays.toLocaleString("en-US")} day(s) old within the ${maxAgeDays.toLocaleString("en-US")}-day freshness window.`
      : `Latest connector execution evidence is ${ageDays.toLocaleString("en-US")} day(s) old, outside the ${maxAgeDays.toLocaleString("en-US")}-day freshness window.`,
  };
}

export function summarizeConnectorEvents(events: ConnectorEvent[]): ConnectorEventSummary {
  return {
    total: events.length,
    executed: events.filter((event) => event.status === "executed").length,
    simulated: events.filter((event) => event.status === "simulated").length,
    requiresApproval: events.filter((event) => event.status === "requires_approval").length,
    blocked: events.filter((event) => event.status === "blocked").length,
    envelopeCount: events.filter((event) => Boolean(event.envelope)).length,
    missingEnvelopeCount: events.filter((event) => !event.envelope).length,
    redactedPayloadCount: events.filter((event) => payloadLooksRedacted(event.payload)).length,
    latestAt: events
      .map((event) => event.createdAt)
      .filter(Boolean)
      .sort()
      .at(-1),
  };
}

const connectorDir = path.join(process.cwd(), ".data", "connector-events");

function connectorPath(organizationId: string) {
  return tenantScopedJsonPath(connectorDir, organizationId);
}

export async function recordConnectorEvent(event: ConnectorEvent) {
  const normalized = normalizeConnectorEvent(event);
  const pool = getDatabasePool();
  if (pool) {
    await ensureDatabaseSchema(pool);
    await pool.query(
      `
      insert into connector_events (id, organization_id, skill_id, tool_id, status, decision, payload, envelope, created_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9)
      on conflict (id) do nothing
      `,
      [
        normalized.id,
        normalized.organizationId,
        normalized.skillId ?? null,
        normalized.toolId,
        normalized.status,
        JSON.stringify(normalized.decision),
        JSON.stringify(normalized.payload),
        JSON.stringify(normalized.envelope ?? null),
        new Date(normalized.createdAt),
      ],
    );
    return;
  }

  const events = await listConnectorEvents(normalized.organizationId, 10000);
  await mkdir(path.dirname(connectorPath(normalized.organizationId)), { recursive: true });
  await writeFile(
    connectorPath(normalized.organizationId),
    JSON.stringify([normalized, ...events.filter((item) => item.id !== normalized.id)], null, 2),
  );
}

export async function listConnectorEvents(organizationId: string, limit = 100): Promise<ConnectorEvent[]> {
  const pool = getDatabasePool();
  if (pool) {
    await ensureDatabaseSchema(pool);
    const result = await pool.query<{
      id: string;
      organization_id: string;
      skill_id: string | null;
      tool_id: string;
      status: ConnectorExecutionResult["status"];
      decision: ConnectorExecutionResult["decision"];
      payload: Record<string, unknown>;
      envelope: ConnectorExecutionEnvelope | null;
      created_at: Date;
    }>(
      "select id, organization_id, skill_id, tool_id, status, decision, payload, envelope, created_at from connector_events where organization_id = $1 order by created_at desc limit $2",
      [organizationId, limit],
    );
    return result.rows.map((row) => normalizeConnectorEvent({
      id: row.id,
      organizationId: row.organization_id,
      skillId: row.skill_id ?? undefined,
      toolId: row.tool_id,
      status: row.status,
      decision: row.decision,
      payload: row.payload,
      envelope: row.envelope ?? undefined,
      createdAt: row.created_at.toISOString(),
    }));
  }

  try {
    const raw = await readFile(connectorPath(organizationId), "utf8");
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : [])
      .map((event) => normalizeConnectorEvent(event as Partial<ConnectorEvent>))
      .slice(0, limit);
  } catch {
    return [];
  }
}
