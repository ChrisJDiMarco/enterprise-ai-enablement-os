const sessionOrganizationIdPattern = /^[A-Za-z0-9._-]{1,180}$/;

export function normalizeSessionOrganizationId(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return sessionOrganizationIdPattern.test(trimmed) ? trimmed : fallback;
}

export function requireSessionOrganizationId(value: unknown, field = "organizationId") {
  const normalized = normalizeSessionOrganizationId(value);
  if (!normalized) {
    throw new Error(`${field} must contain only letters, numbers, dot, dash, and underscore.`);
  }
  return normalized;
}
