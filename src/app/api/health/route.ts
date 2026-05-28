import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.health.v1",
    ok: true,
    service: "enterprise-ai-enablement-os",
    generatedAt: new Date().toISOString(),
  });
}
