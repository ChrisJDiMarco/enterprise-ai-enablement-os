import { NextRequest, NextResponse } from "next/server";
import { createSession, createSessionToken, oidcStateCookieName, sessionCookieName } from "@/lib/auth";
import {
  exchangeOidcAuthorizationCode,
  getOidcDiscovery,
  normalizeOidcIssuer,
  normalizeOidcRedirectUri,
  verifyOidcIdToken,
} from "@/lib/oidc";
import { parseOidcStateCookie, sessionUserFromOidcClaims } from "@/lib/oidc-session";

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

  const session = createSession(user);

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
