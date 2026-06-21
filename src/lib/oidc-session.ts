import { requireSessionOrganizationId } from "./auth-tenant.ts";

export type OidcClaims = Record<string, unknown>;

export type OidcSessionUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role:
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
  department?: string;
};

const allowedRoles = [
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
] as const;

export function parseOidcStateCookie(value?: string) {
  const [state = "", nonce = "", codeVerifier = "", extra] = (value ?? "").split(".");
  const validPart = /^[A-Za-z0-9_-]{24,256}$/;
  const validCodeVerifier = /^[A-Za-z0-9_-]{43,128}$/;

  if (
    extra !== undefined ||
    !validPart.test(state) ||
    !validPart.test(nonce) ||
    !validCodeVerifier.test(codeVerifier)
  ) {
    return null;
  }

  return { state, nonce, codeVerifier };
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`OIDC claim ${field} is required.`);
  }
  return value.trim();
}

function emailClaim(value: unknown) {
  const email = requiredString(value, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new Error("OIDC claim email must be a valid email address.");
  }
  return email;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function roleIsAllowed(value: unknown): value is OidcSessionUser["role"] {
  return typeof value === "string" && allowedRoles.includes(value as OidcSessionUser["role"]);
}

function mapOidcRole(value: unknown): OidcSessionUser["role"] {
  if (roleIsAllowed(value)) return value;
  if (Array.isArray(value)) {
    const matched = value.find(roleIsAllowed);
    if (matched) return matched;
  }
  return "viewer";
}

// AMR (RFC 8176) values that indicate a multi-factor / strong authentication.
const MFA_AMR_VALUES = new Set([
  "mfa",
  "otp",
  "hwk",
  "swk",
  "mca",
  "sms",
  "fido",
  "face",
  "iris",
  "retina",
  "pop",
  "vbm",
  "sc",
]);

/**
 * Enterprise IdP-asserted MFA enforcement. When AUTH_REQUIRE_MFA=true (or
 * OIDC_REQUIRED_ACR is set), the id_token must prove a multi-factor login via an
 * `amr` MFA method, an exact `acr` match, or a recognizable strong-acr value.
 * Returns true when MFA is not required.
 */
export function oidcAuthenticationMeetsMfa(claims: OidcClaims, env: Record<string, string | undefined> = process.env): boolean {
  const requiredAcr = optionalString(env.OIDC_REQUIRED_ACR);
  const requireMfa = env.AUTH_REQUIRE_MFA === "true" || Boolean(requiredAcr);
  if (!requireMfa) return true;

  if (requiredAcr && optionalString(claims.acr) === requiredAcr) return true;

  const amr = claims.amr;
  const methods = Array.isArray(amr) ? amr.map(String) : typeof amr === "string" ? [amr] : [];
  if (methods.some((method) => MFA_AMR_VALUES.has(method.toLowerCase()))) return true;

  const acr = optionalString(claims.acr)?.toLowerCase() ?? "";
  return /mfa|multi.?factor|2fa|aal[23]|loa[23]/.test(acr);
}

export function sessionUserFromOidcClaims({
  claims,
  env = process.env,
}: {
  claims: OidcClaims;
  env?: Record<string, string | undefined>;
}): OidcSessionUser {
  const subject = requiredString(claims.sub, "sub");
  const email = emailClaim(claims.email);
  const organizationId =
    optionalString(claims.eaieos_org_id) ||
    optionalString(claims.organization_id) ||
    optionalString(env.DEFAULT_ORGANIZATION_ID) ||
    "default";

  return {
    id: subject.slice(0, 180),
    organizationId: requireSessionOrganizationId(organizationId, "OIDC organization claim"),
    name: (optionalString(claims.name) || email).slice(0, 200),
    email,
    role: mapOidcRole(claims.eaieos_role || claims.role || claims.roles),
    department: optionalString(claims.department),
  };
}
