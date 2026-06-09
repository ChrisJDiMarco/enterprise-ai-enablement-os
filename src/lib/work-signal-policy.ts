import type { RiskLevel, WorkSignal } from "@/lib/enterprise-ai-data";
import type { EnterpriseWorkspace } from "@/lib/workspace-schema";

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

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sameId(left: string | undefined, right: string | undefined) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}

export function workSignalPrivacyIssues(signal: WorkSignal): WorkSignalPrivacyIssue[] {
  const issues: WorkSignalPrivacyIssue[] = [];

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
  return {
    ...signal,
    id: cleanText(signal.id || `ws-${Date.now()}`, 160),
    process: cleanText(signal.process, 180),
    teamId: signal.teamId ? cleanText(signal.teamId, 160) : undefined,
    userId: signal.userId ? cleanText(signal.userId, 160) : undefined,
    summary: cleanText(signal.summary, 700),
    metadata: {
      ...signal.metadata,
      volume: signal.metadata.volume === undefined ? undefined : Math.max(0, Math.round(safeNumber(signal.metadata.volume))),
      cycleTimeHours:
        signal.metadata.cycleTimeHours === undefined ? undefined : Math.max(0, Math.round(safeNumber(signal.metadata.cycleTimeHours) * 10) / 10),
      delayHours: signal.metadata.delayHours === undefined ? undefined : Math.max(0, Math.round(safeNumber(signal.metadata.delayHours) * 10) / 10),
      confidence:
        signal.metadata.confidence === undefined
          ? undefined
          : Math.max(0, Math.min(1, Math.round(safeNumber(signal.metadata.confidence) * 100) / 100)),
      count: signal.metadata.count === undefined ? undefined : Math.max(0, Math.round(safeNumber(signal.metadata.count))),
      relatedSkillId: signal.metadata.relatedSkillId ? cleanText(signal.metadata.relatedSkillId, 180) : undefined,
      relatedUseCaseId: signal.metadata.relatedUseCaseId ? cleanText(signal.metadata.relatedUseCaseId, 180) : undefined,
      relatedContextSource: signal.metadata.relatedContextSource ? cleanText(signal.metadata.relatedContextSource, 240) : undefined,
      system: signal.metadata.system ? cleanText(signal.metadata.system, 160) : undefined,
      region: signal.metadata.region ? cleanText(signal.metadata.region, 160) : undefined,
    },
    privacy: {
      ...signal.privacy,
      retentionDays: Math.max(1, Math.min(730, Math.round(signal.privacy.retentionDays))),
    },
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
