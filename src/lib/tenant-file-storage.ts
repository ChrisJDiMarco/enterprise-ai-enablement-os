import { createHash } from "node:crypto";
import path from "node:path";

const safeTenantFileStemPattern = /^[A-Za-z0-9_-]{1,180}$/;

export function safeTenantFileStem(organizationId: string) {
  const trimmed = organizationId.trim();
  if (safeTenantFileStemPattern.test(trimmed)) return trimmed;

  const digest = createHash("sha256").update(organizationId).digest("hex").slice(0, 32);
  return `tenant-${digest}`;
}

export function tenantScopedJsonPath(baseDir: string, organizationId: string) {
  return path.join(baseDir, `${safeTenantFileStem(organizationId)}.json`);
}
