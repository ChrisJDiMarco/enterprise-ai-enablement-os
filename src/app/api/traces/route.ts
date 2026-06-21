import { NextResponse } from "next/server";
import { getRequestSession, requireRole } from "@/lib/auth";
import { listHarnessTraces, sanitizeHarnessTraceForViewer, summarizeHarnessTraces } from "@/lib/trace-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const traces = await listHarnessTraces(guard.session.user.organizationId, 250);
  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.harness-traces.v1",
    tracePolicy: "Viewer trace records omit model output, raw trace details, policy reasons, and prompt finding details. Use evidence packets for reviewer-ready summaries.",
    summary: summarizeHarnessTraces(traces),
    traces: traces.map(sanitizeHarnessTraceForViewer),
  });
}
