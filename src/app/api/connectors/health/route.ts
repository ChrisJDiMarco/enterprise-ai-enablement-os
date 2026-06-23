import { NextResponse } from "next/server";
import { getRequestSession, requireRole } from "@/lib/auth";
import { probeConnectorBrokerHealth } from "@/lib/connector-broker-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const broker = await probeConnectorBrokerHealth(process.env);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.connector-health.v1",
    generatedAt: new Date().toISOString(),
    broker,
  });
}
