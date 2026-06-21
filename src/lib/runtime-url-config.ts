import { tenantSecretRuntimeValueIsUsable, tenantSecretValueIssue } from "./tenant-secret-format.ts";

export type RuntimeUrlEnv = Record<string, string | undefined>;

export function configuredRuntimeHttpUrl(env: RuntimeUrlEnv, name: string) {
  const value = env[name]?.trim();
  return value && tenantSecretRuntimeValueIsUsable(name, value) ? value : "";
}

export function runtimeHttpUrlIssue(env: RuntimeUrlEnv, name: string) {
  const value = env[name]?.trim();
  return value ? tenantSecretValueIssue(name, value) : "";
}

function postgresLikeRuntimeUrlIssue(name: string, value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "postgres:" || url.protocol === "postgresql:") return "";
  } catch {
    return `${name} must be a valid HTTP(S), postgres://, or postgresql:// URL.`;
  }
  return `${name} must be a valid HTTP(S), postgres://, or postgresql:// URL.`;
}

export function configuredRuntimeHttpOrPostgresUrl(env: RuntimeUrlEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) return "";
  if (tenantSecretRuntimeValueIsUsable(name, value)) return value;
  return postgresLikeRuntimeUrlIssue(name, value) ? "" : value;
}

export function runtimeHttpOrPostgresUrlIssue(env: RuntimeUrlEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) return "";
  const httpIssue = tenantSecretValueIssue(name, value);
  if (!httpIssue) return "";
  return postgresLikeRuntimeUrlIssue(name, value);
}
