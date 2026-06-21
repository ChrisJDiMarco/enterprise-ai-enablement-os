const tenantSecretNamePattern = /^[A-Z0-9_]{2,120}$/;
const maxTenantSecretValueLength = 20_000;
const localhostNames = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const sensitiveUrlParamPattern =
  /(?:token|secret|password|credential|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|key)/i;

export function canonicalTenantSecretName(value: string) {
  const normalized = value.trim().toUpperCase();
  return tenantSecretNamePattern.test(normalized) ? normalized : "";
}

function isUrlTenantSecretName(name: string) {
  return (
    name.endsWith("_URL") ||
    name.endsWith("_URI") ||
    name.endsWith("_ENDPOINT") ||
    name === "OIDC_ISSUER"
  );
}

function tenantSecretUrlIssue(name: string, value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `${name} must be a valid HTTP(S) URL.`;
  }

  const localHttp = url.protocol === "http:" && localhostNames.has(url.hostname);
  if (url.protocol !== "https:" && !localHttp) {
    return `${name} must use HTTPS, except localhost HTTP for local development.`;
  }

  if (url.username || url.password) {
    return `${name} must not embed credentials in the URL. Store credentials in their dedicated secret fields.`;
  }

  if (url.hash) {
    return `${name} must not include URL fragments.`;
  }

  for (const key of url.searchParams.keys()) {
    if (sensitiveUrlParamPattern.test(key)) {
      return `${name} must not include credential-like query parameters. Store credentials in their dedicated secret fields.`;
    }
  }

  return "";
}

function tenantSecretEmailIssue(name: string, value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320
    ? ""
    : `${name} must be a valid email address.`;
}

function tenantSecretSubdomainIssue(name: string, value: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value)
    ? ""
    : `${name} must be a DNS-safe subdomain such as acme or acme-support.`;
}

export function tenantSecretValueIssue(name: string, value: unknown) {
  const canonical = canonicalTenantSecretName(name);
  if (!canonical) return "Secret name may only contain uppercase letters, numbers, and underscores.";
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return `${canonical} requires a non-empty secret value.`;
  if (trimmed.length > maxTenantSecretValueLength) {
    return `${canonical} must be ${maxTenantSecretValueLength.toLocaleString("en-US")} characters or fewer.`;
  }
  if (isUrlTenantSecretName(canonical)) return tenantSecretUrlIssue(canonical, trimmed);
  if (canonical.endsWith("_EMAIL")) return tenantSecretEmailIssue(canonical, trimmed);
  if (canonical.endsWith("_SUBDOMAIN")) return tenantSecretSubdomainIssue(canonical, trimmed);
  return "";
}

export function tenantSecretRuntimeValueIsUsable(name: string, value: unknown) {
  return typeof value === "string" && !tenantSecretValueIssue(name, value);
}
