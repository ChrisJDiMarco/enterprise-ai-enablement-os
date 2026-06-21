import { cookies } from "next/headers";

import {
  authConfigurationIssues,
  authReadiness,
  localAdminModeAllowed,
  localLoginAllowed,
  publicAuthReadiness,
  sessionCookieName,
} from "./auth-readiness.ts";
import {
  canAccess,
  createSession,
  createSessionToken,
  mapRole,
  parseSessionToken,
  requireRole,
  type Session,
  type SessionUser,
} from "./auth-session.ts";
import { normalizeSessionOrganizationId } from "./auth-tenant.ts";
import { allowedRoles, type UserRole } from "./rbac.ts";
import { isSessionRevoked } from "./session-revocation.ts";

export {
  allowedRoles,
  authConfigurationIssues,
  authReadiness,
  canAccess,
  createSession,
  createSessionToken,
  localLoginAllowed,
  mapRole,
  parseSessionToken,
  publicAuthReadiness,
  requireRole,
  sessionCookieName,
};
export type { Session, SessionUser, UserRole };

export const oidcStateCookieName = "eaieos_oidc_state";

export async function getRequestSession() {
  const store = await cookies();
  const token = store.get(sessionCookieName)?.value;
  const session = parseSessionToken(token);
  if (session) {
    // Reject tokens for users whose sessions were revoked (deactivation/removal).
    if (await isSessionRevoked(session.user.organizationId, session.user.id, session.issuedAt)) {
      return null;
    }
    return session;
  }

  if (!localAdminModeAllowed()) return null;

  return {
    user: {
      id: "current-user",
      organizationId: normalizeSessionOrganizationId(process.env.DEFAULT_ORGANIZATION_ID, "default"),
      name: "Workspace Admin",
      email: "admin@example.com",
      role: "admin" as const,
      department: "AI Enablement",
    },
    issuedAt: Date.now(),
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  };
}
