import { NextResponse } from "next/server";
import { authReadiness, getRequestSession, publicAuthReadiness } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getRequestSession();

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.session.v1",
    authenticated: Boolean(session),
    session,
    readiness: session ? authReadiness() : publicAuthReadiness(),
  });
}
