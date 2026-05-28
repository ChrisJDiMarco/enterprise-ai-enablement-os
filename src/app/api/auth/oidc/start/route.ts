import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { oidcStateCookieName } from "@/lib/auth";
import { getOidcDiscovery } from "@/lib/oidc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const redirectUri = process.env.OIDC_REDIRECT_URI;

  if (!issuer || !clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "OIDC is not configured.",
        requiredEnv: ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URI"],
      },
      { status: 501 },
    );
  }

  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const discovery = await getOidcDiscovery(issuer).catch((error) => {
    const message = error instanceof Error ? error.message : "OIDC discovery failed.";
    return { error: message };
  });
  if ("error" in discovery) {
    return NextResponse.json({ error: discovery.error }, { status: 502 });
  }
  const authorizeUrl = new URL(discovery.authorization_endpoint);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("nonce", nonce);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(oidcStateCookieName, `${state}.${nonce}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
