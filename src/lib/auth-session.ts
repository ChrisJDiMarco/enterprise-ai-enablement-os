import { createHmac, timingSafeEqual } from "node:crypto";

import { canRoleAccess, roleIsAllowed, type UserRole } from "./rbac.ts";

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

const defaultDevSecret = "local-dev-auth-secret-change-me";
const maxSessionAgeMs = 30 * 24 * 60 * 60 * 1000;
const maxSessionClockSkewMs = 5 * 60 * 1000;
const maxSessionStringLength = {
  id: 180,
  organizationId: 180,
  name: 200,
  email: 320,
  department: 120,
};

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (process.env.NODE_ENV === "production" && !value) {
    throw new Error("AUTH_SECRET is required in production.");
  }
  return value || defaultDevSecret;
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
  const segments = token.split(".");
  if (segments.length !== 2) return null;
  const [payload, signature] = segments;
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
    return normalizeSessionPayload(JSON.parse(unbase64url(payload)));
  } catch {
    return null;
  }
}

export function canAccess(session: Session | null, minimumRole: UserRole) {
  if (!session) return false;
  if (!roleIsAllowed(session.user?.role)) return false;
  return canRoleAccess(session.user.role, minimumRole);
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

export function mapRole(value: unknown): UserRole {
  if (roleIsAllowed(value)) return value;
  if (Array.isArray(value)) {
    const matched = value.find(roleIsAllowed);
    if (matched) return matched;
  }
  return "viewer";
}

function normalizeSessionPayload(value: unknown): Session | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const session = value as Partial<Session>;
  const now = Date.now();
  const issuedAt = finiteTimestamp(session.issuedAt);
  const expiresAt = finiteTimestamp(session.expiresAt);
  if (issuedAt === null || expiresAt === null) return null;
  if (issuedAt > now + maxSessionClockSkewMs) return null;
  if (expiresAt <= now || expiresAt <= issuedAt) return null;
  if (expiresAt - issuedAt > maxSessionAgeMs) return null;

  const user = normalizeSessionUser(session.user);
  if (!user) return null;

  return { user, issuedAt, expiresAt };
}

function normalizeSessionUser(value: unknown): SessionUser | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rawUser = value as Partial<SessionUser>;
  const id = sessionString(rawUser.id, maxSessionStringLength.id);
  const organizationId = sessionString(rawUser.organizationId, maxSessionStringLength.organizationId);
  const name = sessionString(rawUser.name, maxSessionStringLength.name);
  const email = normalizedEmail(rawUser.email);
  const role = rawUser.role;
  if (!id || !organizationId || !name || !email || !roleIsAllowed(role)) return null;

  const department = sessionString(rawUser.department, maxSessionStringLength.department);
  return {
    id,
    organizationId,
    name,
    email,
    role,
    ...(department ? { department } : {}),
  };
}

function finiteTimestamp(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function sessionString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return "";
  return trimmed;
}

function normalizedEmail(value: unknown) {
  const email = sessionString(value, maxSessionStringLength.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}
