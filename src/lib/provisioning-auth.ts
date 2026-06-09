import { timingSafeEqual } from "node:crypto";

export type RuntimeEnv = Record<string, string | undefined>;

export type ProvisioningTenantDecision =
  | { ok: true; organizationId: string }
  | {
      ok: false;
      status: 400;
      code: "TENANT_REQUIRED" | "TENANT_MISMATCH";
      error: string;
    };

export function provisioningToken(env: RuntimeEnv = process.env) {
  return env.PROVISIONING_API_TOKEN || env.SCIM_BEARER_TOKEN || "";
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
  return value?.trim() || "";
}

export function machineProvisioningTenant({
  bodyOrganizationId,
  headerOrganizationId,
}: {
  bodyOrganizationId?: string | null;
  headerOrganizationId?: string | null;
}): ProvisioningTenantDecision {
  const bodyTenant = normalizedTenantHint(bodyOrganizationId);
  const headerTenant = normalizedTenantHint(headerOrganizationId);

  if (bodyTenant && headerTenant && bodyTenant !== headerTenant) {
    return {
      ok: false,
      status: 400,
      code: "TENANT_MISMATCH",
      error: "Provisioning body organizationId must match x-eaieos-tenant.",
    };
  }

  const organizationId = bodyTenant || headerTenant;
  if (!organizationId) {
    return {
      ok: false,
      status: 400,
      code: "TENANT_REQUIRED",
      error: "Machine provisioning requires organizationId in the body or x-eaieos-tenant.",
    };
  }

  return { ok: true, organizationId };
}

export function sessionProvisioningTenant({
  bodyOrganizationId,
  sessionOrganizationId,
}: {
  bodyOrganizationId?: string | null;
  sessionOrganizationId: string;
}): ProvisioningTenantDecision {
  const bodyTenant = normalizedTenantHint(bodyOrganizationId);
  if (bodyTenant && bodyTenant !== sessionOrganizationId) {
    return {
      ok: false,
      status: 400,
      code: "TENANT_MISMATCH",
      error: "Provisioning body organizationId must match the authenticated session tenant.",
    };
  }

  return { ok: true, organizationId: sessionOrganizationId };
}
