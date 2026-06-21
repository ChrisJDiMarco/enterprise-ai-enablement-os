import { createHash } from "node:crypto";
import type { AuditLog } from "./enterprise-ai-data.ts";
import { sanitizeAuditLog } from "./audit-sanitization.ts";
export { sanitizeAuditLog, sanitizeAuditText } from "./audit-sanitization.ts";

export const AUDIT_CHAIN_ALGORITHM = "sha256-v1" as const;
export const AUDIT_CHAIN_GENESIS = "GENESIS" as const;

export type AuditIntegritySeal = {
  algorithm: typeof AUDIT_CHAIN_ALGORITHM;
  sequence: number;
  previousHash: string;
  hash: string;
  canonicalHash: string;
  sealedAt: string;
};

export type AuditIntegrityVerification = {
  verified: boolean;
  algorithm: typeof AUDIT_CHAIN_ALGORITHM;
  checked: number;
  sealed: number;
  legacy: number;
  lastHash: string | null;
  gaps: string[];
};

export type AuditChainResealResult = {
  logs: AuditLog[];
  integrity: AuditIntegrityVerification;
};

type SealableAuditLog = AuditLog & {
  integrity?: AuditIntegritySeal;
};

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortKeys(entry)]),
  );
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function withoutIntegrity(log: SealableAuditLog) {
  const canonical = { ...log };
  delete canonical.integrity;
  return canonical;
}

export function canonicalAuditLogPayload(organizationId: string, sequence: number, previousHash: string, log: AuditLog) {
  return JSON.stringify(sortKeys({
    organizationId,
    sequence,
    previousHash,
    log: withoutIntegrity(log as SealableAuditLog),
  }));
}

function orderedSealedLogs(logs: AuditLog[]) {
  return logs
    .filter((log): log is SealableAuditLog => Boolean((log as SealableAuditLog).integrity))
    .sort((left, right) => left.integrity!.sequence - right.integrity!.sequence);
}

export function sortAuditLogsChronologically(logs: AuditLog[]) {
  return [...logs].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
    if (Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return -1;
    if (!Number.isFinite(leftTime) && Number.isFinite(rightTime)) return 1;
    return left.id.localeCompare(right.id);
  });
}

export function sealAuditLog(params: {
  organizationId: string;
  log: AuditLog;
  existingLogs: AuditLog[];
  sealedAt?: string;
}): AuditLog {
  const log = sanitizeAuditLog(params.log);
  const sealed = orderedSealedLogs(params.existingLogs);
  const previous = sealed.at(-1);
  const sequence = (previous?.integrity?.sequence ?? 0) + 1;
  const previousHash = previous?.integrity?.hash ?? AUDIT_CHAIN_GENESIS;
  const canonical = canonicalAuditLogPayload(params.organizationId, sequence, previousHash, log);
  const canonicalHash = sha256(canonical);

  return {
    ...withoutIntegrity(log as SealableAuditLog),
    integrity: {
      algorithm: AUDIT_CHAIN_ALGORITHM,
      sequence,
      previousHash,
      canonicalHash,
      hash: sha256(`${AUDIT_CHAIN_ALGORITHM}:${canonicalHash}`),
      sealedAt: params.sealedAt ?? new Date().toISOString(),
    },
  } as AuditLog;
}

export function verifyAuditChain(organizationId: string, logs: AuditLog[]): AuditIntegrityVerification {
  const sealed = orderedSealedLogs(logs);
  const gaps: string[] = [];
  let previousHash: string = AUDIT_CHAIN_GENESIS;
  let expectedSequence = 1;
  let lastHash: string | null = null;

  for (const log of sealed) {
    const seal = log.integrity!;
    const canonical = canonicalAuditLogPayload(organizationId, seal.sequence, seal.previousHash, log);
    const canonicalHash = sha256(canonical);
    const hash = sha256(`${AUDIT_CHAIN_ALGORITHM}:${canonicalHash}`);

    if (seal.algorithm !== AUDIT_CHAIN_ALGORITHM) {
      gaps.push(`${log.id}: unsupported audit seal algorithm ${seal.algorithm}.`);
    }
    if (seal.sequence !== expectedSequence) {
      gaps.push(`${log.id}: expected sequence ${expectedSequence}, found ${seal.sequence}.`);
      expectedSequence = seal.sequence;
    }
    if (seal.previousHash !== previousHash) {
      gaps.push(`${log.id}: previous hash mismatch.`);
    }
    if (seal.canonicalHash !== canonicalHash) {
      gaps.push(`${log.id}: canonical payload hash mismatch.`);
    }
    if (seal.hash !== hash) {
      gaps.push(`${log.id}: audit seal hash mismatch.`);
    }

    previousHash = seal.hash;
    lastHash = seal.hash;
    expectedSequence += 1;
  }

  const legacy = logs.length - sealed.length;
  if (legacy > 0) {
    gaps.push(`${legacy} legacy audit log${legacy === 1 ? "" : "s"} do not have integrity seals.`);
  }

  return {
    verified: gaps.length === 0,
    algorithm: AUDIT_CHAIN_ALGORITHM,
    checked: logs.length,
    sealed: sealed.length,
    legacy,
    lastHash,
    gaps,
  };
}

export function resealAuditLogs(params: {
  organizationId: string;
  logs: AuditLog[];
  sealedAt?: string;
}): AuditChainResealResult {
  const resealed = sortAuditLogsChronologically(params.logs).reduce<AuditLog[]>((current, log) => {
    const sealedLog = sealAuditLog({
      organizationId: params.organizationId,
      log: withoutIntegrity(log as SealableAuditLog) as AuditLog,
      existingLogs: current,
      sealedAt: params.sealedAt,
    });
    return [...current, sealedLog];
  }, []);

  return {
    logs: resealed,
    integrity: verifyAuditChain(params.organizationId, resealed),
  };
}
