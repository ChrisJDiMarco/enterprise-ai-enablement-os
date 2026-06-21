import { normalizeAISettings, redactAISettingsSecrets, type AIProviderSettings } from "./model-router.ts";
import { sanitizeAuditText } from "./audit-sanitization.ts";

export type WorkspaceExportPayload<T extends { aiSettings?: Partial<AIProviderSettings> }> = T & {
  exportedAt: string;
  aiSettings: AIProviderSettings;
};

const redacted = "[redacted]";
const omitted = "[omitted]";
const secretKeyPattern =
  /(?:token|secret|password|credential|authorization|api[_-]?key|private[_-]?key|session|cookie|webhook|auth[_-]?ref|headers?)/i;
const rawContainerKeyPattern =
  /(?:raw[_-]?(?:content|payload|body|message|response)|request[_-]?body|response[_-]?body|transcript|payloadPreview|full[_-]?response)/i;
const secretStringPatterns = [
  /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/i,
  /\b(?:sk|xox[baprs]|ghp|github_pat|glpat|ya29|eyJ)[A-Za-z0-9._-]{12,}\b/i,
  /\b(?:postgres|postgresql|mysql|redis|mongodb):\/\/[^\s,;]+/i,
  /https:\/\/hooks\.slack\.com\/services\/[^\s,;]+/i,
  /[?&](?:token|secret|password|credential|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token)=([^&#\s]+)/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/i,
];

function sanitizeExportString(value: string) {
  const auditSafe = sanitizeAuditText(value);
  return secretStringPatterns.reduce((current, pattern) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    return current.replace(new RegExp(pattern.source, flags), redacted);
  }, auditSafe);
}

function sanitizeExportValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null) return null;
  if (typeof value === "string") return sanitizeExportString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : omitted;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol" || typeof value === "undefined") {
    return omitted;
  }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : omitted;
  if (Array.isArray(value)) return value.map((item) => sanitizeExportValue(item, seen));
  if (typeof value === "object") {
    if (seen.has(value)) return omitted;
    seen.add(value);
    const sanitized: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = secretKeyPattern.test(key) || rawContainerKeyPattern.test(key)
        ? redacted
        : sanitizeExportValue(raw, seen);
    }
    seen.delete(value);
    return sanitized;
  }
  return omitted;
}

export function sanitizeWorkspaceExportSnapshot<T>(workspaceSnapshot: T): T {
  return sanitizeExportValue(workspaceSnapshot, new WeakSet<object>()) as T;
}

export function buildWorkspaceExportPayload<T extends { aiSettings?: Partial<AIProviderSettings> }>(
  workspaceSnapshot: T,
  exportedAt = new Date().toISOString(),
): WorkspaceExportPayload<T> {
  const sanitizedSnapshot = sanitizeWorkspaceExportSnapshot(workspaceSnapshot);
  return {
    ...sanitizedSnapshot,
    exportedAt,
    aiSettings: redactAISettingsSecrets(normalizeAISettings(workspaceSnapshot.aiSettings ?? {})),
  };
}
