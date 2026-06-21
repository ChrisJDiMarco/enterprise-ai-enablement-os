import type { RiskLevel, WorkSignal } from "@/lib/enterprise-ai-data";
import type { EnterpriseWorkspace } from "@/lib/workspace-schema";
import { sanitizeAuditText } from "./audit-sanitization.ts";

export type WorkSignalPrivacyIssue = {
  field: string;
  message: string;
};

export type WorkSignalReferenceIssue = {
  signalId: string;
  field: "metadata.relatedSkillId" | "metadata.relatedUseCaseId" | "metadata.relatedContextSource";
  message: string;
};

const riskRank: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  restricted: 4,
};

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

const redacted = "[redacted]";
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
const phonePattern = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const creditCardLikePattern = /\b(?:\d[ -]*?){13,19}\b/g;
const consentBases = new Set(["aggregated", "system_metadata", "explicit_opt_in", "business_record"]);

export function sanitizeWorkSignalText(value: string, maxLength: number) {
  return cleanText(
    sanitizeAuditText(value)
      .replace(emailPattern, redacted)
      .replace(ssnPattern, redacted)
      .replace(phonePattern, redacted)
      .replace(creditCardLikePattern, redacted),
    maxLength,
  );
}

function hasSensitiveWorkSignalText(value: string) {
  return sanitizeWorkSignalText(value, 5000) !== cleanText(value, 5000);
}

function optionalSanitizedText(value: string | undefined, maxLength: number) {
  const sanitized = value ? sanitizeWorkSignalText(value, maxLength) : "";
  return sanitized || undefined;
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sameId(left: string | undefined, right: string | undefined) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}

export function workSignalPrivacyIssues(signal: WorkSignal): WorkSignalPrivacyIssue[] {
  const issues: WorkSignalPrivacyIssue[] = [];
  const metadata = signal.metadata ?? {};

  if (!signal.privacy.contentRedacted) {
    issues.push({ field: "privacy.contentRedacted", message: "Work signals must redact raw content before ingestion." });
  }
  if (!signal.privacy.piiRedacted) {
    issues.push({ field: "privacy.piiRedacted", message: "Work signals must redact PII before ingestion." });
  }
  if (signal.privacy.rawContentStored) {
    issues.push({ field: "privacy.rawContentStored", message: "Raw employee message or document content cannot be stored in Work Intelligence." });
  }
  if (signal.privacy.individualScoringAllowed) {
    issues.push({ field: "privacy.individualScoringAllowed", message: "Individual employee scoring is not allowed." });
  }
  if (signal.privacy.retentionDays < 1 || signal.privacy.retentionDays > 730) {
    issues.push({ field: "privacy.retentionDays", message: "Retention must be between 1 and 730 days." });
  }
  if (signal.userId && signal.privacy.consentBasis !== "explicit_opt_in") {
    issues.push({ field: "userId", message: "User-level signals require explicit opt-in; prefer team or process-level aggregation." });
  }
  const textFields: Array<{ field: string; value?: string }> = [
    { field: "process", value: signal.process },
    { field: "summary", value: signal.summary },
    { field: "teamId", value: signal.teamId },
    { field: "userId", value: signal.userId },
    { field: "metadata.relatedSkillId", value: metadata.relatedSkillId },
    { field: "metadata.relatedUseCaseId", value: metadata.relatedUseCaseId },
    { field: "metadata.relatedContextSource", value: metadata.relatedContextSource },
    { field: "metadata.system", value: metadata.system },
    { field: "metadata.region", value: metadata.region },
  ];
  textFields.forEach(({ field, value }) => {
    if (typeof value === "string" && hasSensitiveWorkSignalText(value)) {
      issues.push({
        field,
        message: "Work signal text contains credentials, contact data, or raw-content markers that must be redacted.",
      });
    }
  });

  return issues;
}

export function resolveWorkSignalReferences(params: {
  workspace: EnterpriseWorkspace;
  signals: WorkSignal[];
}): { signals: WorkSignal[]; issues: WorkSignalReferenceIssue[] } {
  const skillsById = new Map(params.workspace.skills.map((skill) => [skill.id.toLowerCase(), skill]));
  const useCasesById = new Map(params.workspace.useCases.map((useCase) => [useCase.id.toLowerCase(), useCase]));
  const contextSourcesByKey = new Map(
    params.workspace.contextSources.flatMap((source) => [
      [source.id.toLowerCase(), source] as const,
      [source.name.toLowerCase(), source] as const,
    ]),
  );
  const issues: WorkSignalReferenceIssue[] = [];

  const signals = params.signals.map((signal) => {
    const relatedSkillId = signal.metadata.relatedSkillId?.trim();
    const relatedUseCaseId = signal.metadata.relatedUseCaseId?.trim();
    const relatedContextSource = signal.metadata.relatedContextSource?.trim();
    const skill = relatedSkillId ? skillsById.get(relatedSkillId.toLowerCase()) : undefined;
    const useCase = relatedUseCaseId ? useCasesById.get(relatedUseCaseId.toLowerCase()) : undefined;
    const contextSource = relatedContextSource ? contextSourcesByKey.get(relatedContextSource.toLowerCase()) : undefined;
    const metadata = { ...signal.metadata };

    if (relatedSkillId && !skill) {
      issues.push({
        signalId: signal.id,
        field: "metadata.relatedSkillId",
        message: `No Skill matched ${relatedSkillId}.`,
      });
    }
    if (relatedUseCaseId && !useCase) {
      issues.push({
        signalId: signal.id,
        field: "metadata.relatedUseCaseId",
        message: `No use case matched ${relatedUseCaseId}.`,
      });
    }
    if (skill) {
      metadata.relatedSkillId = skill.id;
      if (!relatedUseCaseId && skill.useCaseId && useCasesById.has(skill.useCaseId.toLowerCase())) {
        metadata.relatedUseCaseId = skill.useCaseId;
      }
    }
    if (useCase) {
      metadata.relatedUseCaseId = useCase.id;
      if (!relatedSkillId && useCase.linkedSkillId && skillsById.has(useCase.linkedSkillId.toLowerCase())) {
        metadata.relatedSkillId = useCase.linkedSkillId;
      }
    }
    if (skill && useCase) {
      const skillPointsElsewhere = skill.useCaseId && !sameId(skill.useCaseId, useCase.id);
      const useCasePointsElsewhere = useCase.linkedSkillId && !sameId(useCase.linkedSkillId, skill.id);
      if (skillPointsElsewhere || useCasePointsElsewhere) {
        issues.push({
          signalId: signal.id,
          field: "metadata.relatedSkillId",
          message: `Related Skill ${skill.id} is not linked to use case ${useCase.id}.`,
        });
      }
    }
    if (relatedContextSource && contextSource) {
      metadata.relatedContextSource = contextSource.name;
    } else if (relatedContextSource && signal.eventType !== "context_gap") {
      issues.push({
        signalId: signal.id,
        field: "metadata.relatedContextSource",
        message: `No context source matched ${relatedContextSource}. Use a context_gap signal for unmapped source gaps.`,
      });
    }

    return {
      ...signal,
      metadata,
    };
  });

  return { signals, issues };
}

export function normalizeWorkSignal(signal: WorkSignal): WorkSignal {
  const metadata = signal.metadata ?? {};
  const privacy = signal.privacy ?? {};
  const consentBasis = consentBases.has(privacy.consentBasis) ? privacy.consentBasis : "aggregated";

  return {
    id: sanitizeWorkSignalText(signal.id || `ws-${Date.now()}`, 160) || `ws-${Date.now()}`,
    source: signal.source,
    eventType: signal.eventType,
    department: signal.department,
    process: sanitizeWorkSignalText(signal.process, 180),
    teamId: optionalSanitizedText(signal.teamId, 160),
    userId: optionalSanitizedText(signal.userId, 160),
    summary: sanitizeWorkSignalText(signal.summary, 700),
    metadata: {
      volume: metadata.volume === undefined ? undefined : Math.max(0, Math.round(safeNumber(metadata.volume))),
      cycleTimeHours:
        metadata.cycleTimeHours === undefined ? undefined : Math.max(0, Math.round(safeNumber(metadata.cycleTimeHours) * 10) / 10),
      delayHours: metadata.delayHours === undefined ? undefined : Math.max(0, Math.round(safeNumber(metadata.delayHours) * 10) / 10),
      confidence:
        metadata.confidence === undefined
          ? undefined
          : Math.max(0, Math.min(1, Math.round(safeNumber(metadata.confidence) * 100) / 100)),
      sentiment: metadata.sentiment,
      relatedSkillId: optionalSanitizedText(metadata.relatedSkillId, 180),
      relatedUseCaseId: optionalSanitizedText(metadata.relatedUseCaseId, 180),
      relatedContextSource: optionalSanitizedText(metadata.relatedContextSource, 240),
      system: optionalSanitizedText(metadata.system, 160),
      region: optionalSanitizedText(metadata.region, 160),
      count: metadata.count === undefined ? undefined : Math.max(0, Math.round(safeNumber(metadata.count))),
    },
    privacy: {
      contentRedacted: privacy.contentRedacted === true,
      piiRedacted: privacy.piiRedacted === true,
      consentBasis,
      retentionDays: Math.max(1, Math.min(730, Math.round(safeNumber(privacy.retentionDays, 365)))),
      individualScoringAllowed: privacy.individualScoringAllowed === false ? false : (true as false),
      rawContentStored: privacy.rawContentStored === false ? false : (true as false),
    },
    riskLevel: signal.riskLevel,
    createdAt: signal.createdAt || new Date().toISOString(),
  };
}

export function normalizeWorkSignals(signals: WorkSignal[]) {
  const byId = new Map<string, WorkSignal>();

  signals.forEach((signal) => {
    const normalized = normalizeWorkSignal(signal);
    if (workSignalPrivacyIssues(normalized).length) return;
    byId.set(normalized.id, normalized);
  });

  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function summarizeWorkSignalRisk(signals: WorkSignal[]) {
  return signals.reduce<RiskLevel>((highest, signal) => (riskRank[signal.riskLevel] > riskRank[highest] ? signal.riskLevel : highest), "low");
}
