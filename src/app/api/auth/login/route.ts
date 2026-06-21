import { NextRequest, NextResponse } from "next/server";
import { allowedRoles, createSession, createSessionToken, localLoginAllowed, sessionCookieName, SessionUser } from "@/lib/auth";
import { recordAuthAuditEvent } from "@/lib/auth-audit";
import { normalizeSessionOrganizationId } from "@/lib/auth-tenant";
import { localLoginRequestToken, productionLocalLoginGuard, type LocalLoginTokenBody } from "@/lib/local-login";
import { formatZodError, localLoginInputSchema } from "@/lib/api-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function auditBucketOrganization() {
  return normalizeSessionOrganizationId(process.env.DEFAULT_ORGANIZATION_ID || "default") || "default";
}

export async function POST(request: NextRequest) {
  if (!localLoginAllowed()) {
    return NextResponse.json(
      {
        error: "Local login is disabled. Use OIDC SSO or set LOCAL_LOGIN_ENABLED=true for emergency access.",
      },
      { status: 403 },
    );
  }

  const rawBody = (await request.json().catch(() => ({}))) as unknown;

  // The emergency-token guard runs first and on the raw body, so a malformed
  // identity payload can never bypass the production token requirement.
  const productionGuard = productionLocalLoginGuard({
    providedToken: localLoginRequestToken({
      headers: request.headers,
      body: (rawBody && typeof rawBody === "object" ? rawBody : {}) as LocalLoginTokenBody,
    }),
  });
  if (!productionGuard.ok) {
    await recordAuthAuditEvent({
      organizationId: auditBucketOrganization(),
      eventType: "auth_login_failed",
      message: `Local login rejected by the emergency-access guard (${productionGuard.code}).`,
      actor: "Local login",
      riskLevel: "high",
    });
    return NextResponse.json(
      {
        error: productionGuard.error,
        code: productionGuard.code,
      },
      { status: productionGuard.status },
    );
  }

  // Validate and bound every identity field before it is sealed into a signed
  // session — unbounded/arbitrary values must never reach createSessionToken.
  const parsed = localLoginInputSchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid local login payload.", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }
  const body = parsed.data;

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
  await recordAuthAuditEvent({
    organizationId: user.organizationId,
    eventType: "auth_login",
    message: `Local login succeeded as role ${user.role}.`,
    actor: user.name,
    riskLevel: "medium",
  });
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
