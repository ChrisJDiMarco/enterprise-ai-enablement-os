import type { AuditLog } from "./enterprise-ai-data.ts";

const redacted = "[redacted]";
const credentialValuePatterns = [
  /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi,
  /\b(?:sk|xox[baprs]|ghp|github_pat|glpat|ya29|eyJ)[A-Za-z0-9._-]{12,}\b/g,
  /\b(?:postgres|postgresql|mysql|redis|mongodb):\/\/[^\s,;]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];
const namedSecretValuePattern =
  /\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|id[_ -]?token|bearer[_ -]?token|authorization|client[_ -]?secret|secret|password|credential|private[_ -]?key)\s*[:=]\s*("[^"]+"|'[^']+'|[^\s,;]+)/gi;
const rawContentFieldPattern =
  /\b(system[_ -]?prompt|developer[_ -]?message|prompt|payload|raw[_ -]?content|transcript|body)\s*[:=]\s*("[^"]{4,}"|'[^']{4,}'|[^\n.;]{4,})/gi;

export function sanitizeAuditText(value: string) {
  return credentialValuePatterns
    .reduce((current, pattern) => current.replace(pattern, redacted), value)
    .replace(namedSecretValuePattern, (_match, label: string) => `${label}=${redacted}`)
    .replace(rawContentFieldPattern, (_match, label: string) => `${label}=${redacted}`);
}

export function sanitizeAuditLog(log: AuditLog): AuditLog {
  return {
    ...log,
    eventType: sanitizeAuditText(log.eventType),
    message: sanitizeAuditText(log.message),
    actor: sanitizeAuditText(log.actor),
  };
}
