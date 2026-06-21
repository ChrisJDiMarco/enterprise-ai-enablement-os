import { NextResponse } from "next/server";
import { getRequestSession, sessionCookieName } from "@/lib/auth";
import { recordAuthAuditEvent } from "@/lib/auth-audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const session = await getRequestSession();
  if (session) {
    await recordAuthAuditEvent({
      organizationId: session.user.organizationId,
      eventType: "auth_logout",
      message: `Session ended for role ${session.user.role}.`,
      actor: session.user.name,
      riskLevel: "low",
    });
  }
  const response = NextResponse.json({
    schema: "enterprise-ai-enablement-os.logout.v1",
    authenticated: false,
  });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
