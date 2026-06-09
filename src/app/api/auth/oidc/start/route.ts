import { NextResponse } from "next/server";
import { oidcStateCookieName } from "@/lib/auth";
import {
  createOidcCodeVerifier,
  getOidcDiscovery,
  normalizeOidcIssuer,
  normalizeOidcRedirectUri,
  oidcPkceChallenge,
} from "@/lib/oidc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const redirectUri = process.env.OIDC_REDIRECT_URI;

  if (!issuer || !clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "OIDC is not configured." }, { status: 501 });
  }

  let normalizedIssuer: string;
  let normalizedRedirectUri: string;
  try {
    normalizedIssuer = normalizeOidcIssuer(issuer);
    normalizedRedirectUri = normalizeOidcRedirectUri(redirectUri);
  } catch {
    logOidcStartIssue("OIDC configuration rejected.");
    return NextResponse.json({ error: "OIDC is not configured." }, { status: 501 });
  }

  const state = createOidcCodeVerifier();
  const nonce = createOidcCodeVerifier();
  const codeVerifier = createOidcCodeVerifier();
  const discovery = await getOidcDiscovery(normalizedIssuer).catch(() => {
    logOidcStartIssue("OIDC discovery failed.");
    return null;
  });
  if (!discovery) {
    return NextResponse.json({ error: "OIDC discovery failed." }, { status: 502 });
  }
  const authorizeUrl = new URL(discovery.authorization_endpoint);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", normalizedRedirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("nonce", nonce);
  authorizeUrl.searchParams.set("code_challenge", oidcPkceChallenge(codeVerifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(oidcStateCookieName, `${state}.${nonce}.${codeVerifier}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}

function logOidcStartIssue(message: string) {
  if (process.env.NODE_ENV !== "test") {
    console.warn(`[auth/oidc/start] ${message}`);
  }
}
