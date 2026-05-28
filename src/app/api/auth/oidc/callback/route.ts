import { NextRequest, NextResponse } from "next/server";
import { createSession, createSessionToken, mapRole, oidcStateCookieName, sessionCookieName } from "@/lib/auth";
import { getOidcDiscovery, verifyOidcIdToken } from "@/lib/oidc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const redirectUri = process.env.OIDC_REDIRECT_URI;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(oidcStateCookieName)?.value;
  const [expectedState, nonce] = storedState?.split(".") ?? [];

  if (!issuer || !clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "OIDC is not configured." }, { status: 501 });
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Invalid OIDC state." }, { status: 400 });
  }

  const discovery = await getOidcDiscovery(issuer).catch((error) => {
    const message = error instanceof Error ? error.message : "OIDC discovery failed.";
    return { error: message };
  });
  if ("error" in discovery) {
    return NextResponse.json({ error: discovery.error }, { status: 502 });
  }
  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: "OIDC token exchange failed." }, { status: 502 });
  }

  const tokenPayload = (await tokenResponse.json()) as { id_token?: string };
  if (!tokenPayload.id_token) {
    return NextResponse.json({ error: "OIDC provider did not return an id_token." }, { status: 502 });
  }

  let claims: Record<string, unknown>;
  try {
    claims = await verifyOidcIdToken({
      idToken: tokenPayload.id_token,
      issuer,
      clientId,
      nonce,
    }) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "OIDC id_token verification failed." }, { status: 401 });
  }

  const session = createSession({
    id: String(claims.sub || claims.email || "oidc-user"),
    organizationId: String(claims.eaieos_org_id || claims.organization_id || process.env.DEFAULT_ORGANIZATION_ID || "default"),
    name: String(claims.name || claims.email || "OIDC User"),
    email: String(claims.email || "oidc-user@example.com"),
    role: mapRole(claims.eaieos_role || claims.role || claims.roles),
    department: typeof claims.department === "string" ? claims.department : undefined,
  });

  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  response.cookies.set(sessionCookieName, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  response.cookies.set(oidcStateCookieName, "", { path: "/", maxAge: 0 });

  return response;
}
