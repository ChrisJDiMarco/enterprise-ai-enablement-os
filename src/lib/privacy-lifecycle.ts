import { createHash } from "node:crypto";

import type { AuditLog, Run, WorkSignal } from "./enterprise-ai-data.ts";
import type { EnterpriseWorkspace } from "./workspace-schema.ts";

export type PrivacyRequestType = "export" | "delete" | "review";

export type PrivacyLifecycleConfig = {
  configured: boolean;
  mode: "internal-workflow" | "external-workflow" | "missing";
  retentionDays: number;
  exportEnabled: boolean;
  requestWorkflowUrl: string;
  reason: string;
};

export type PrivacyLifecycleOperations = {
  requestCount: number;
  acceptedCount: number;
  forwardedCount: number;
  blockedCount: number;
  exportCount: number;
  retentionSweepCount: number;
  latestAt?: string;
};

export type PrivacyExportPacket = {
  schema: "enterprise-ai-enablement-os.privacy-export.v1";
  generatedAt: string;
  organizationId: string;
  scope: "subject" | "tenant";
  subject: {
    userId?: string;
    email?: string;
    hash: string;
  };
  retention: {
    configuredDays: number;
    expiredWorkSignals: number;
    maxSignalRetentionDays: number;
  };
  records: {
    userProfiles: unknown[];
    runs: Pick<Run, "id" | "skillId" | "useCaseId" | "status" | "riskLevel" | "startedAt" | "costUsd" | "latencyMs">[];
    workSignals: ReturnType<typeof redactWorkSignal>[];
    auditEvents: Pick<AuditLog, "id" | "eventType" | "message" | "riskLevel" | "createdAt">[];
  };
  guardrails: string[];
};

export type PrivacyRequestReceipt = {
  id: string;
  type: PrivacyRequestType;
  organizationId: string;
  subjectHash: string;
  status: "accepted" | "forwarded" | "blocked";
  reason: string;
  createdAt: string;
};

export type PrivacyRetentionSweepItem = {
  id: string;
  source: WorkSignal["source"];
  eventType: WorkSignal["eventType"];
  department: WorkSignal["department"];
  process: string;
  riskLevel: WorkSignal["riskLevel"];
  createdAt: string;
  retentionDays: number;
  expiredAt: string;
};

export type PrivacyRetentionSweepPlan = {
  schema: "enterprise-ai-enablement-os.privacy-retention-sweep.v1";
  action: "retention_sweep";
  dryRun: boolean;
  generatedAt: string;
  organizationId: string;
  configuredRetentionDays: number;
  scanned: number;
  expired: number;
  retained: number;
  maxSignalRetentionDays: number;
  items: PrivacyRetentionSweepItem[];
  guardrails: string[];
};

export type PrivacyRetentionSweepResult = PrivacyRetentionSweepPlan & {
  workspace: EnterpriseWorkspace;
  applied: boolean;
};

type RuntimeEnv = Record<string, string | undefined>;

type PrivacyAuditEvent = Pick<AuditLog, "eventType" | "message" | "createdAt">;

export function privacyLifecycleConfigFromEnv(env: RuntimeEnv = process.env): PrivacyLifecycleConfig {
  const retentionDays = parsePositiveInt(env.DATA_RETENTION_DAYS) ?? 365;
  const exportEnabled = env.PRIVACY_EXPORT_ENABLED === "true";
  const requestWorkflowUrl = env.PRIVACY_REQUEST_WORKFLOW_URL || env.DSR_WORKFLOW_URL || "";
  const configured = retentionDays > 0 && (exportEnabled || Boolean(requestWorkflowUrl));

  if (requestWorkflowUrl) {
    return {
      configured,
      mode: "external-workflow",
      retentionDays,
      exportEnabled,
      requestWorkflowUrl,
      reason: "External privacy request workflow is configured.",
    };
  }

  if (exportEnabled) {
    return {
      configured,
      mode: "internal-workflow",
      retentionDays,
      exportEnabled,
      requestWorkflowUrl,
      reason: "Internal privacy export workflow is enabled.",
    };
  }

  return {
    configured: false,
    mode: "missing",
    retentionDays,
    exportEnabled,
    requestWorkflowUrl,
    reason: "Set PRIVACY_EXPORT_ENABLED=true or PRIVACY_REQUEST_WORKFLOW_URL to enable privacy lifecycle operations.",
  };
}

export function derivePrivacyLifecycleOperations(auditLogs: PrivacyAuditEvent[]): PrivacyLifecycleOperations {
  const operations: PrivacyLifecycleOperations = {
    requestCount: 0,
    acceptedCount: 0,
    forwardedCount: 0,
    blockedCount: 0,
    exportCount: 0,
    retentionSweepCount: 0,
  };

  for (const log of auditLogs) {
    if (log.eventType === "privacy_retention_sweep") {
      operations.retentionSweepCount += 1;
      operations.latestAt = latestTimestamp(operations.latestAt, log.createdAt);
      continue;
    }

    if (log.eventType === "privacy_export_generated") {
      operations.exportCount += 1;
      operations.latestAt = latestTimestamp(operations.latestAt, log.createdAt);
      continue;
    }

    if (log.eventType !== "privacy_request_received") continue;

    const message = log.message.toLowerCase();
    operations.requestCount += 1;
    operations.latestAt = latestTimestamp(operations.latestAt, log.createdAt);
    if (message.includes("forwarded")) {
      operations.forwardedCount += 1;
    } else if (message.includes("accepted")) {
      operations.acceptedCount += 1;
    } else if (message.includes("blocked")) {
      operations.blockedCount += 1;
    }
  }

  return operations;
}

export function derivePrivacyRetentionSweepPlan(params: {
  workspace: EnterpriseWorkspace;
  dryRun?: boolean;
  now?: Date;
  env?: RuntimeEnv;
}): PrivacyRetentionSweepPlan {
  const now = params.now ?? new Date();
  const config = privacyLifecycleConfigFromEnv(params.env);
  const signalRetentions = params.workspace.workSignals.map((signal) => signal.privacy.retentionDays).filter(Number.isFinite);
  const items = params.workspace.workSignals
    .filter((signal) => isSignalExpired(signal, now, config.retentionDays))
    .map((signal) => {
      const retentionDays = Math.min(signal.privacy.retentionDays, config.retentionDays);
      const createdAtMs = Date.parse(signal.createdAt);
      return {
        id: signal.id,
        source: signal.source,
        eventType: signal.eventType,
        department: signal.department,
        process: signal.process,
        riskLevel: signal.riskLevel,
        createdAt: signal.createdAt,
        retentionDays,
        expiredAt: new Date(createdAtMs + retentionDays * 24 * 60 * 60 * 1000).toISOString(),
      };
    });

  return {
    schema: "enterprise-ai-enablement-os.privacy-retention-sweep.v1",
    action: "retention_sweep",
    dryRun: params.dryRun ?? true,
    generatedAt: now.toISOString(),
    organizationId: params.workspace.organizationId,
    configuredRetentionDays: config.retentionDays,
    scanned: params.workspace.workSignals.length,
    expired: items.length,
    retained: params.workspace.workSignals.length - items.length,
    maxSignalRetentionDays: signalRetentions.length ? Math.max(...signalRetentions) : 0,
    items,
    guardrails: [
      "Only redacted Work Intelligence signals are eligible for automated retention sweep.",
      "Audit events, governance reviews, run traces, and legal-hold records are preserved for accountable operations.",
      "Retention uses the stricter value between DATA_RETENTION_DAYS and each signal retentionDays policy.",
    ],
  };
}

export function applyPrivacyRetentionSweep(params: {
  workspace: EnterpriseWorkspace;
  dryRun?: boolean;
  now?: Date;
  env?: RuntimeEnv;
}): PrivacyRetentionSweepResult {
  const plan = derivePrivacyRetentionSweepPlan(params);
  const expiredIds = new Set(plan.items.map((item) => item.id));
  const workspace =
    plan.dryRun || expiredIds.size === 0
      ? params.workspace
      : {
          ...params.workspace,
          workSignals: params.workspace.workSignals.filter((signal) => !expiredIds.has(signal.id)),
          updatedAt: plan.generatedAt,
        };

  return {
    ...plan,
    workspace,
    applied: !plan.dryRun && expiredIds.size > 0,
  };
}

export function buildPrivacyExportPacket(params: {
  workspace: EnterpriseWorkspace;
  subjectUserId?: string;
  subjectEmail?: string;
  now?: Date;
  env?: RuntimeEnv;
}): PrivacyExportPacket {
  const now = params.now ?? new Date();
  const config = privacyLifecycleConfigFromEnv(params.env);
  const normalizedEmail = params.subjectEmail?.trim().toLowerCase();
  const subjectHash = hashSubject(params.workspace.organizationId, params.subjectUserId, normalizedEmail);
  const userProfiles = params.workspace.users
    .filter((user) => matchesSubject({ userId: user.id, email: user.email }, params.subjectUserId, normalizedEmail))
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      title: user.title,
      department: user.department,
      role: user.role,
    }));
  const runs = params.workspace.runs
    .filter((run) => matchesFreeText(run.triggeredBy, params.subjectUserId, normalizedEmail))
    .map((run) => ({
      id: run.id,
      skillId: run.skillId,
      useCaseId: run.useCaseId,
      status: run.status,
      riskLevel: run.riskLevel,
      startedAt: run.startedAt,
      costUsd: run.costUsd,
      latencyMs: run.latencyMs,
    }));
  const workSignals = params.workspace.workSignals
    .filter((signal) => matchesSubject({ userId: signal.userId }, params.subjectUserId, normalizedEmail))
    .map(redactWorkSignal);
  const auditEvents = params.workspace.auditLogs
    .filter((log) => matchesFreeText(log.actor, params.subjectUserId, normalizedEmail))
    .map((log) => ({
      id: log.id,
      eventType: log.eventType,
      message: log.message,
      riskLevel: log.riskLevel,
      createdAt: log.createdAt,
    }));
  const expiredWorkSignals = params.workspace.workSignals.filter((signal) => isSignalExpired(signal, now, config.retentionDays));
  const signalRetentions = params.workspace.workSignals.map((signal) => signal.privacy.retentionDays).filter(Number.isFinite);

  return {
    schema: "enterprise-ai-enablement-os.privacy-export.v1",
    generatedAt: now.toISOString(),
    organizationId: params.workspace.organizationId,
    scope: params.subjectUserId || normalizedEmail ? "subject" : "tenant",
    subject: {
      userId: params.subjectUserId,
      email: normalizedEmail,
      hash: subjectHash,
    },
    retention: {
      configuredDays: config.retentionDays,
      expiredWorkSignals: expiredWorkSignals.length,
      maxSignalRetentionDays: signalRetentions.length ? Math.max(...signalRetentions) : 0,
    },
    records: {
      userProfiles,
      runs,
      workSignals,
      auditEvents,
    },
    guardrails: [
      "Raw employee message content is not included.",
      "Work Intelligence signals remain redacted and cannot be used for individual employee scoring.",
      "Provider secrets, connector payloads, and hidden prompts are excluded from privacy exports.",
      "Deletion requests should be reviewed against audit-retention and legal-hold obligations before removal.",
    ],
  };
}

export function createPrivacyRequestReceipt(params: {
  organizationId: string;
  type: PrivacyRequestType;
  subjectUserId?: string;
  subjectEmail?: string;
  accepted: boolean;
  reason: string;
  forwarded?: boolean;
  now?: Date;
}): PrivacyRequestReceipt {
  const now = params.now ?? new Date();
  return {
    id: `privacy-${params.type}-${now.getTime()}-${hashSubject(params.organizationId, params.subjectUserId, params.subjectEmail).slice(0, 8)}`,
    type: params.type,
    organizationId: params.organizationId,
    subjectHash: hashSubject(params.organizationId, params.subjectUserId, params.subjectEmail),
    status: params.accepted ? (params.forwarded ? "forwarded" : "accepted") : "blocked",
    reason: params.reason,
    createdAt: now.toISOString(),
  };
}

export function redactWorkSignal(signal: WorkSignal) {
  return {
    id: signal.id,
    source: signal.source,
    eventType: signal.eventType,
    department: signal.department,
    process: signal.process,
    summary: signal.summary,
    metadata: {
      volume: signal.metadata.volume,
      cycleTimeHours: signal.metadata.cycleTimeHours,
      delayHours: signal.metadata.delayHours,
      confidence: signal.metadata.confidence,
      sentiment: signal.metadata.sentiment,
      relatedSkillId: signal.metadata.relatedSkillId,
      relatedUseCaseId: signal.metadata.relatedUseCaseId,
      system: signal.metadata.system,
      region: signal.metadata.region,
      count: signal.metadata.count,
    },
    privacy: signal.privacy,
    riskLevel: signal.riskLevel,
    createdAt: signal.createdAt,
  };
}

function isSignalExpired(signal: WorkSignal, now: Date, configuredRetentionDays: number) {
  const retentionDays = Math.min(signal.privacy.retentionDays, configuredRetentionDays);
  const createdAt = new Date(signal.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  return now.getTime() - createdAt.getTime() > retentionDays * 24 * 60 * 60 * 1000;
}

function latestTimestamp(current: string | undefined, candidate: string) {
  const currentMs = Date.parse(current ?? "");
  const candidateMs = Date.parse(candidate);
  if (!Number.isFinite(candidateMs)) return current;
  return !Number.isFinite(currentMs) || candidateMs >= currentMs ? candidate : current;
}

function matchesSubject(
  candidate: { userId?: string; email?: string },
  subjectUserId?: string,
  subjectEmail?: string,
) {
  if (!subjectUserId && !subjectEmail) return true;
  if (subjectUserId && candidate.userId === subjectUserId) return true;
  if (subjectEmail && candidate.email?.trim().toLowerCase() === subjectEmail) return true;
  return false;
}

function matchesFreeText(value: string, subjectUserId?: string, subjectEmail?: string) {
  if (!subjectUserId && !subjectEmail) return true;
  const text = value.toLowerCase();
  return Boolean((subjectUserId && text.includes(subjectUserId.toLowerCase())) || (subjectEmail && text.includes(subjectEmail)));
}

function hashSubject(organizationId: string, userId?: string, email?: string) {
  return createHash("sha256")
    .update([organizationId, userId ?? "", email?.trim().toLowerCase() ?? ""].join("|"))
    .digest("hex");
}

function parsePositiveInt(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
