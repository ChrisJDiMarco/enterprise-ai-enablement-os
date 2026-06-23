import { getWorkspaceRepository, persistenceUnavailable } from "./database.ts";
import { defaultOrganizationSecurityPolicy, type OrganizationSecurityPolicy } from "./workspace-schema.ts";

/**
 * Loads a tenant's persisted security policy for the auth path. Best-effort:
 * any failure (no DB, unreachable, missing) falls back to the permissive
 * default so a policy lookup can never lock anyone out — per-tenant policy can
 * only TIGHTEN access (shorter sessions, additional MFA), never open a hole.
 */
export async function loadOrganizationSecurityPolicy(organizationId: string): Promise<OrganizationSecurityPolicy> {
  try {
    const repository = getWorkspaceRepository();
    if (persistenceUnavailable(repository)) return { ...defaultOrganizationSecurityPolicy };
    const workspace = await repository.getWorkspace(organizationId);
    return workspace.organization?.securityPolicy ?? { ...defaultOrganizationSecurityPolicy };
  } catch {
    return { ...defaultOrganizationSecurityPolicy };
  }
}

/** The signed-session lifetime (seconds) implied by a tenant's policy. */
export function sessionMaxAgeSecondsForPolicy(policy: OrganizationSecurityPolicy): number {
  return Math.max(1, Math.round(policy.sessionTimeoutHours)) * 60 * 60;
}
