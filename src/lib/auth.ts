import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type UserRole =
  | "admin"
  | "ai_enablement_director"
  | "ai_product_owner"
  | "governance_reviewer"
  | "security_reviewer"
  | "legal_reviewer"
  | "privacy_reviewer"
  | "function_leader"
  | "builder"
  | "viewer";

export type SessionUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
};

export type Session = {
  user: SessionUser;
  issuedAt: number;
  expiresAt: number;
};

export const sessionCookieName = "eaieos_session";
export const oidcStateCookieName = "eaieos_oidc_state";

export const allowedRoles: UserRole[] = [
  "admin",
  "ai_enablement_director",
  "ai_product_owner",
  "governance_reviewer",
  "security_reviewer",
  "legal_reviewer",
  "privacy_reviewer",
  "function_leader",
  "builder",
  "viewer",
];

const roleRank: Record<UserRole, number> = {
  viewer: 1,
  function_leader: 2,
  builder: 3,
  ai_product_owner: 4,
  governance_reviewer: 4,
  security_reviewer: 4,
  legal_reviewer: 4,
  privacy_reviewer: 4,
  ai_enablement_director: 5,
  admin: 6,
};

const defaultDevSecret = "local-dev-auth-secret-change-me";

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (process.env.NODE_ENV === "production" && !value) {
    throw new Error("AUTH_SECRET is required in production.");
  }
  return value || defaultDevSecret;
}

function localAdminModeAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_REQUIRED !== "true";
}

function base64url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function unbase64url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(session: Session) {
  const payload = base64url(JSON.stringify(session));
  return `${payload}.${signPayload(payload)}`;
}

export function parseSessionToken(token?: string): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let expected: string;
  try {
    expected = signPayload(payload);
  } catch {
    return null;
  }
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(unbase64url(payload)) as Session;
    if (!session.expiresAt || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getRequestSession() {
  const store = await cookies();
  const token = store.get(sessionCookieName)?.value;
  const session = parseSessionToken(token);
  if (session) return session;

  if (!localAdminModeAllowed()) return null;

  return {
    user: {
      id: "current-user",
      organizationId: process.env.DEFAULT_ORGANIZATION_ID || "default",
      name: "Workspace Admin",
      email: "admin@example.com",
      role: "admin" as const,
      department: "AI Enablement",
    },
    issuedAt: Date.now(),
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  };
}

export function canAccess(session: Session | null, minimumRole: UserRole) {
  if (!session) return false;
  return roleRank[session.user.role] >= roleRank[minimumRole];
}

export function requireRole(session: Session | null, minimumRole: UserRole) {
  if (!canAccess(session, minimumRole)) {
    return {
      ok: false as const,
      response: Response.json({ error: "Forbidden", requiredRole: minimumRole }, { status: session ? 403 : 401 }),
    };
  }

  return { ok: true as const, session: session as Session };
}

export function createSession(user: SessionUser, maxAgeSeconds = 8 * 60 * 60): Session {
  const issuedAt = Date.now();
  return {
    user,
    issuedAt,
    expiresAt: issuedAt + maxAgeSeconds * 1000,
  };
}

export function roleIsAllowed(value: unknown): value is UserRole {
  return typeof value === "string" && allowedRoles.includes(value as UserRole);
}

export function mapRole(value: unknown): UserRole {
  if (roleIsAllowed(value)) return value;
  if (Array.isArray(value)) {
    const matched = value.find(roleIsAllowed);
    if (matched) return matched;
  }
  return "viewer";
}

export function localLoginAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.LOCAL_LOGIN_ENABLED === "true";
}

export function authConfigurationIssues() {
  const issues: string[] = [];
  const warnings: string[] = [];
  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  const oidcConfigured = Boolean(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET);

  if (process.env.NODE_ENV === "production" && !authSecret) {
    issues.push("AUTH_SECRET is required in production.");
  }

  if (process.env.NODE_ENV === "production" && process.env.AUTH_REQUIRED !== "true") {
    issues.push("AUTH_REQUIRED must be true in production.");
  }

  if (process.env.AUTH_REQUIRED === "true" && !oidcConfigured && !localLoginAllowed()) {
    issues.push("AUTH_REQUIRED is true but OIDC is not configured.");
  }

  if (process.env.NODE_ENV !== "production" && !authSecret) {
    warnings.push("Using the local development auth secret.");
  }

  if (localLoginAllowed() && process.env.NODE_ENV === "production") {
    warnings.push("LOCAL_LOGIN_ENABLED is true in production. Disable after emergency access is no longer needed.");
  }

  return { issues, warnings };
}

export function authReadiness() {
  const oidcConfigured = Boolean(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET);
  const configuration = authConfigurationIssues();

  return {
    authRequired: process.env.AUTH_REQUIRED === "true",
    oidcConfigured,
    localLoginEnabled: localLoginAllowed(),
    sessionCookie: sessionCookieName,
    mode: oidcConfigured ? "oidc-ready" : process.env.AUTH_REQUIRED === "true" ? "signed-cookie-required" : localAdminModeAllowed() ? "local-admin-dev" : "disabled",
    issues: configuration.issues,
    warnings: configuration.warnings,
  };
}
