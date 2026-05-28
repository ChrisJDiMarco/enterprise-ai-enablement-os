import { NextRequest, NextResponse } from "next/server";
import { allowedRoles, createSession, createSessionToken, localLoginAllowed, sessionCookieName, SessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!localLoginAllowed()) {
    return NextResponse.json(
      {
        error: "Local login is disabled. Use OIDC SSO or set LOCAL_LOGIN_ENABLED=true for emergency access.",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Partial<SessionUser>;
  const role = body.role && allowedRoles.includes(body.role) ? body.role : "admin";
  const user: SessionUser = {
    id: body.id || "current-user",
    organizationId: body.organizationId || process.env.DEFAULT_ORGANIZATION_ID || "default",
    name: body.name || "Workspace Admin",
    email: body.email || "admin@example.com",
    role,
    department: body.department || "AI Enablement",
  };
  const session = createSession(user);
  const response = NextResponse.json({
    schema: "enterprise-ai-enablement-os.login.v1",
    authenticated: true,
    session,
  });

  response.cookies.set(sessionCookieName, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });

  return response;
}
