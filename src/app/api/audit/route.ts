import { NextRequest, NextResponse } from "next/server";
import type { AuditLog } from "@/lib/enterprise-ai-data";
import { auditLogInputSchema, formatZodError } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository } from "@/lib/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : 100;
  const repository = getWorkspaceRepository();
  const auditLogs = await repository.listAuditLogs(guard.session.user.organizationId, limit);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.audit-list.v1",
    persistence: repository.readiness(),
    auditLogs,
  });
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = auditLogInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid audit log payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  const input = parsed.data;
  const log: AuditLog = {
    id: input.id || `audit-${Date.now()}`,
    eventType: input.eventType,
    message: input.message,
    actor: input.actor || guard.session.user.name,
    riskLevel: input.riskLevel,
    createdAt: input.createdAt || new Date().toISOString(),
  };
  const repository = getWorkspaceRepository();
  await repository.appendAuditLog(guard.session.user.organizationId, log);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.audit-append.v1",
    persistence: repository.readiness(),
    auditLog: log,
  });
}
