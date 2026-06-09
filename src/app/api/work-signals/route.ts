import { NextRequest, NextResponse } from "next/server";
import type { AuditLog, WorkSignal } from "@/lib/enterprise-ai-data";
import { formatZodError, workSignalBatchInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import {
  normalizeWorkSignal,
  normalizeWorkSignals,
  resolveWorkSignalReferences,
  summarizeWorkSignalRisk,
  workSignalPrivacyIssues,
} from "@/lib/work-signal-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 250);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : 250;
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.work-signals.v1",
    persistence: repository.readiness(),
    workSignals: workspace.workSignals.slice(0, limit),
    total: workspace.workSignals.length,
  });
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "builder");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const candidate = Array.isArray(body) ? { signals: body } : body;
  const parsed = workSignalBatchInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid work signal payload.", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const normalizedSignals = parsed.data.signals.map((input, index) =>
    normalizeWorkSignal({
      ...input,
      id: input.id || `ws-${Date.now()}-${index}`,
      createdAt: input.createdAt || now,
    } as WorkSignal),
  );
  const privacyIssues = normalizedSignals.flatMap((signal) =>
    workSignalPrivacyIssues(signal).map((issue) => ({ signalId: signal.id, ...issue })),
  );
  if (privacyIssues.length) {
    return NextResponse.json(
      {
        error: "Work signal privacy guardrail violation.",
        details: privacyIssues,
      },
      { status: 400 },
    );
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const referenceResolution = resolveWorkSignalReferences({ workspace, signals: normalizedSignals });
  if (referenceResolution.issues.length) {
    return NextResponse.json(
      {
        error: "Work signal relationship guardrail violation.",
        details: referenceResolution.issues,
      },
      { status: 400 },
    );
  }

  const acceptedSignals = referenceResolution.signals;
  const mergedSignals = normalizeWorkSignals([...acceptedSignals, ...workspace.workSignals]).slice(0, 50000);
  const saved = await repository.saveWorkspace({
    ...workspace,
    workSignals: mergedSignals,
    updatedAt: now,
  });
  const auditLog: AuditLog = {
    id: `audit-work-signals-${Date.now()}`,
    eventType: "work_signals_ingested",
    message: `${acceptedSignals.length} governed work signal${acceptedSignals.length === 1 ? "" : "s"} ingested into Work Intelligence.`,
    actor: guard.session.user.name,
    riskLevel: summarizeWorkSignalRisk(acceptedSignals),
    createdAt: now,
  };
  await repository.appendAuditLog(guard.session.user.organizationId, auditLog);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.work-signals-ingest.v1",
    persistence: repository.readiness(),
    accepted: acceptedSignals.length,
    total: saved.workSignals.length,
    workSignals: acceptedSignals,
    auditLog,
  });
}
