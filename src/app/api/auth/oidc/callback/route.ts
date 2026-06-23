import { NextRequest, NextResponse } from "next/server";
import { createSession, createSessionToken, oidcStateCookieName, sessionCookieName } from "@/lib/auth";
import {
  exchangeOidcAuthorizationCode,
  getOidcDiscovery,
  normalizeOidcIssuer,
  normalizeOidcRedirectUri,
  verifyOidcIdToken,
} from "@/lib/oidc";
import { oidcAuthenticationMeetsMfa, parseOidcStateCookie, sessionUserFromOidcClaims } from "@/lib/oidc-session";
import { recordAuthAuditEvent } from "@/lib/auth-audit";
import { fireAlertOnce } from "@/lib/alerts";
import { loadOrganizationSecurityPolicy, sessionMaxAgeSecondsForPolicy } from "@/lib/organization-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const redirectUri = process.env.OIDC_REDIRECT_URI;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = parseOidcStateCookie(request.cookies.get(oidcStateCookieName)?.value);

  if (!issuer || !clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "OIDC is not configured." }, { status: 501 });
  }

  let normalizedIssuer: string;
  let normalizedRedirectUri: string;
  try {
    normalizedIssuer = normalizeOidcIssuer(issuer);
    normalizedRedirectUri = normalizeOidcRedirectUri(redirectUri);
  } catch {
    logOidcCallbackIssue("OIDC configuration rejected.");
    return NextResponse.json({ error: "OIDC is not configured." }, { status: 501 });
  }

  if (!code || !state || !storedState || state !== storedState.state) {
    return NextResponse.json({ error: "Invalid OIDC state." }, { status: 400 });
  }

  const discovery = await getOidcDiscovery(normalizedIssuer).catch(() => {
    logOidcCallbackIssue("OIDC discovery failed.");
    void fireAlertOnce({
      key: "oidc.discovery_failed",
      organizationId: "platform",
      severity: "critical",
      title: "OIDC discovery failed — SSO is down",
      detail: "The IdP discovery endpoint is unreachable; users cannot sign in via SSO.",
      route: "/api/auth/oidc/callback",
    }).catch(() => undefined);
    return null;
  });
  if (!discovery) {
    return NextResponse.json({ error: "OIDC discovery failed." }, { status: 502 });
  }

  const tokenPayload = await exchangeOidcAuthorizationCode({
    tokenEndpoint: discovery.token_endpoint,
    clientId,
    clientSecret,
    redirectUri: normalizedRedirectUri,
    code,
    codeVerifier: storedState.codeVerifier,
  }).catch(() => {
    logOidcCallbackIssue("OIDC token exchange failed.");
    void fireAlertOnce({
      key: "oidc.token_exchange_failed",
      organizationId: "platform",
      severity: "critical",
      title: "OIDC token exchange failed — SSO is down",
      detail: "The IdP token endpoint rejected or failed the code exchange; users cannot complete SSO sign-in.",
      route: "/api/auth/oidc/callback",
    }).catch(() => undefined);
    return null;
  });
  if (!tokenPayload) {
    return NextResponse.json({ error: "OIDC token exchange failed." }, { status: 502 });
  }

  if (!tokenPayload.id_token) {
    return NextResponse.json({ error: "OIDC provider did not return an id_token." }, { status: 502 });
  }

  let claims: Record<string, unknown>;
  try {
    claims = await verifyOidcIdToken({
      idToken: tokenPayload.id_token,
      issuer: normalizedIssuer,
      clientId,
      nonce: storedState.nonce,
    }) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "OIDC id_token verification failed." }, { status: 401 });
  }

  let user;
  try {
    user = sessionUserFromOidcClaims({ claims });
  } catch {
    return NextResponse.json({ error: "OIDC id_token is missing required user claims." }, { status: 401 });
  }

  // Per-tenant security policy can only further tighten access (require MFA even
  // when env doesn't, shorten the session) — never loosen the env baseline.
  const policy = await loadOrganizationSecurityPolicy(user.organizationId);

  if (!oidcAuthenticationMeetsMfa(claims, process.env, policy.requireMfa)) {
    logOidcCallbackIssue("OIDC login rejected: multi-factor authentication is required but was not asserted.");
    return NextResponse.json(
      { error: "Multi-factor authentication is required. Sign in again with an MFA-backed method.", code: "MFA_REQUIRED" },
      { status: 401 },
    );
  }

  const session = createSession(user, sessionMaxAgeSecondsForPolicy(policy));
  await recordAuthAuditEvent({
    organizationId: user.organizationId,
    eventType: "auth_login",
    message: `OIDC SSO login succeeded as role ${user.role}.`,
    actor: user.name,
    riskLevel: "low",
  });

  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  response.cookies.set(sessionCookieName, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  response.cookies.set(oidcStateCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

function logOidcCallbackIssue(message: string) {
  if (process.env.NODE_ENV !== "test") {
    console.warn(`[auth/oidc/callback] ${message}`);
  }
}
