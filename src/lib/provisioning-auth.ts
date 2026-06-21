import { createHash, timingSafeEqual } from "node:crypto";

import { normalizeSessionOrganizationId } from "./auth-tenant.ts";

export type RuntimeEnv = Record<string, string | undefined>;

export type ProvisioningTenantDecision =
  | { ok: true; organizationId: string }
  | {
      ok: false;
      status: 400;
      code: "TENANT_REQUIRED" | "TENANT_MISMATCH" | "TENANT_INVALID";
      error: string;
    };

export type MachineProvisioningResolution =
  | { ok: true; organizationId: string }
  | {
      ok: false;
      status: 400 | 401 | 403 | 503;
      code:
        | "TENANT_REQUIRED"
        | "TENANT_MISMATCH"
        | "TENANT_INVALID"
        | "PROVISIONING_TOKEN_MISSING"
        | "PROVISIONING_TOKEN_INVALID";
      error: string;
    };

export type ProvisioningTokenEntry = { organizationId: string; token: string };

export function provisioningToken(env: RuntimeEnv = process.env) {
  return env.PROVISIONING_API_TOKEN || env.SCIM_BEARER_TOKEN || "";
}

/**
 * Tenant-bound provisioning credentials. A leaked provisioning token must never
 * be a cross-tenant superuser, so every token is bound to a single tenant.
 *
 * Preferred (multi-tenant): PROVISIONING_TOKENS="acme:tok_live_xxx, globex:sha256:<hex>"
 * (comma- or newline-separated "<organizationId>:<token-or-sha256:hash>" pairs).
 *
 * Legacy single-tenant: PROVISIONING_API_TOKEN / SCIM_BEARER_TOKEN are bound to
 * PROVISIONING_TOKEN_ORG (falling back to DEFAULT_ORGANIZATION_ID, then "default").
 */
export function provisioningTokenRegistry(env: RuntimeEnv = process.env): ProvisioningTokenEntry[] {
  const entries: ProvisioningTokenEntry[] = [];
  const registry = env.PROVISIONING_TOKENS;
  if (registry) {
    for (const pair of registry.split(/[,\n]/)) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const separator = trimmed.indexOf(":");
      if (separator <= 0) continue;
      const organizationId = normalizeSessionOrganizationId(trimmed.slice(0, separator).trim());
      const token = trimmed.slice(separator + 1).trim();
      if (organizationId && token) entries.push({ organizationId, token });
    }
  }

  const legacy = provisioningToken(env).trim();
  if (legacy) {
    const boundOrg = normalizeSessionOrganizationId(
      env.PROVISIONING_TOKEN_ORG?.trim() || env.DEFAULT_ORGANIZATION_ID?.trim() || "default",
    );
    if (boundOrg) entries.push({ organizationId: boundOrg, token: legacy });
  }

  return entries;
}

export function provisioningConfigured(env: RuntimeEnv = process.env) {
  return provisioningTokenRegistry(env).length > 0;
}

export function tokenEntryMatches(provided: string, entryToken: string) {
  if (entryToken.startsWith("sha256:")) {
    const expectedHex = entryToken.slice("sha256:".length).trim().toLowerCase();
    const providedHex = createHash("sha256").update(provided).digest("hex");
    return tokenMatches(providedHex, expectedHex);
  }
  return tokenMatches(provided, entryToken);
}

export function tokenMatches(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export function bearerToken(authorization: string | null) {
  const [scheme, ...tokenParts] = (authorization ?? "").trim().split(/\s+/);
  const token = tokenParts.join(" ").trim();
  return scheme?.toLowerCase() === "bearer" && token ? token : "";
}

function normalizedTenantHint(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function validatedTenantHint(value?: string | null) {
  const hint = normalizedTenantHint(value);
  if (!hint) return { raw: "", organizationId: "" };
  return { raw: hint, organizationId: normalizeSessionOrganizationId(hint) };
}

/**
 * Validates and reconciles a client-supplied tenant hint (body + header) without
 * deciding whether one is required. Returns organizationId "" when none is given.
 */
function requestedProvisioningTenant({
  bodyOrganizationId,
  headerOrganizationId,
}: {
  bodyOrganizationId?: string | null;
  headerOrganizationId?: string | null;
}): { ok: true; organizationId: string } | { ok: false; status: 400; code: "TENANT_MISMATCH" | "TENANT_INVALID"; error: string } {
  const bodyTenant = validatedTenantHint(bodyOrganizationId);
  const headerTenant = validatedTenantHint(headerOrganizationId);

  if ((bodyTenant.raw && !bodyTenant.organizationId) || (headerTenant.raw && !headerTenant.organizationId)) {
    return {
      ok: false,
      status: 400,
      code: "TENANT_INVALID",
      error: "Provisioning organizationId may only contain letters, numbers, dot, dash, and underscore.",
    };
  }

  if (bodyTenant.organizationId && headerTenant.organizationId && bodyTenant.organizationId !== headerTenant.organizationId) {
    return {
      ok: false,
      status: 400,
      code: "TENANT_MISMATCH",
      error: "Provisioning body organizationId must match x-eaieos-tenant.",
    };
  }

  return { ok: true, organizationId: bodyTenant.organizationId || headerTenant.organizationId };
}

export function machineProvisioningTenant({
  bodyOrganizationId,
  headerOrganizationId,
}: {
  bodyOrganizationId?: string | null;
  headerOrganizationId?: string | null;
}): ProvisioningTenantDecision {
  const requested = requestedProvisioningTenant({ bodyOrganizationId, headerOrganizationId });
  if (!requested.ok) return requested;

  if (!requested.organizationId) {
    return {
      ok: false,
      status: 400,
      code: "TENANT_REQUIRED",
      error: "Machine provisioning requires organizationId in the body or x-eaieos-tenant.",
    };
  }

  return { ok: true, organizationId: requested.organizationId };
}

/**
 * The security boundary for machine provisioning: authenticate the bearer token
 * against the tenant-bound registry, then ensure the target tenant is one the
 * token is actually authorized for. The tenant is NEVER taken from the client
 * alone — it must be covered by the token's binding.
 */
export function resolveMachineProvisioningTenant({
  token,
  env = process.env,
  bodyOrganizationId,
  headerOrganizationId,
}: {
  token: string;
  env?: RuntimeEnv;
  bodyOrganizationId?: string | null;
  headerOrganizationId?: string | null;
}): MachineProvisioningResolution {
  const registry = provisioningTokenRegistry(env);
  if (registry.length === 0) {
    return {
      ok: false,
      status: 503,
      code: "PROVISIONING_TOKEN_MISSING",
      error: "Provisioning bearer auth is not configured.",
    };
  }

  const boundOrganizationIds = new Set<string>();
  for (const entry of registry) {
    if (tokenEntryMatches(token, entry.token)) boundOrganizationIds.add(entry.organizationId);
  }
  if (boundOrganizationIds.size === 0) {
    return { ok: false, status: 401, code: "PROVISIONING_TOKEN_INVALID", error: "Invalid provisioning token." };
  }

  const requested = requestedProvisioningTenant({ bodyOrganizationId, headerOrganizationId });
  if (!requested.ok) return requested;

  if (requested.organizationId) {
    if (!boundOrganizationIds.has(requested.organizationId)) {
      return {
        ok: false,
        status: 403,
        code: "TENANT_MISMATCH",
        error: "Provisioning token is not authorized for the requested tenant.",
      };
    }
    return { ok: true, organizationId: requested.organizationId };
  }

  if (boundOrganizationIds.size > 1) {
    return {
      ok: false,
      status: 400,
      code: "TENANT_REQUIRED",
      error: "This provisioning token is bound to multiple tenants; specify organizationId or x-eaieos-tenant.",
    };
  }

  return { ok: true, organizationId: [...boundOrganizationIds][0] };
}

export function sessionProvisioningTenant({
  bodyOrganizationId,
  sessionOrganizationId,
}: {
  bodyOrganizationId?: string | null;
  sessionOrganizationId: string;
}): ProvisioningTenantDecision {
  const bodyTenant = validatedTenantHint(bodyOrganizationId);
  if (bodyTenant.raw && !bodyTenant.organizationId) {
    return {
      ok: false,
      status: 400,
      code: "TENANT_INVALID",
      error: "Provisioning organizationId may only contain letters, numbers, dot, dash, and underscore.",
    };
  }

  if (bodyTenant.organizationId && bodyTenant.organizationId !== sessionOrganizationId) {
    return {
      ok: false,
      status: 400,
      code: "TENANT_MISMATCH",
      error: "Provisioning body organizationId must match the authenticated session tenant.",
    };
  }

  return { ok: true, organizationId: sessionOrganizationId };
}
