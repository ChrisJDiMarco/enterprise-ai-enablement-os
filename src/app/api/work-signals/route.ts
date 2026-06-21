import { NextRequest, NextResponse } from "next/server";
import type { AuditLog, WorkSignal } from "@/lib/enterprise-ai-data";
import { boundedQueryLimit, formatZodError, workSignalBatchInputSchema } from "@/lib/api-validation";
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

  const limit = boundedQueryLimit(request.nextUrl.searchParams.get("limit"), { defaultLimit: 250, maxLimit: 1000 });
  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.work-signals.v1",
    persistence: repository.readiness(),
    workSignals: workspace.workSignals.slice(0, limit),
    total: workspace.workSignals.length,
    page: {
      limit,
      returned: Math.min(workspace.workSignals.length, limit),
      hasMore: workspace.workSignals.length > limit,
    },
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

  type IngestResult =
    | { ok: true; acceptedSignals: WorkSignal[] }
    | { ok: false; issues: ReturnType<typeof resolveWorkSignalReferences>["issues"] };

  const outcome = await repository.mutateWorkspace<IngestResult>(guard.session.user.organizationId, (workspace) => {
    const referenceResolution = resolveWorkSignalReferences({ workspace, signals: normalizedSignals });
    if (referenceResolution.issues.length) {
      return { commit: false, result: { ok: false, issues: referenceResolution.issues } };
    }

    const acceptedSignals = referenceResolution.signals;
    const mergedSignals = normalizeWorkSignals([...acceptedSignals, ...workspace.workSignals]).slice(0, 50000);
    const auditLog: AuditLog = {
      id: `audit-work-signals-${Date.now()}`,
      eventType: "work_signals_ingested",
      message: `${acceptedSignals.length} governed work signal${acceptedSignals.length === 1 ? "" : "s"} ingested into Work Intelligence.`,
      actor: guard.session.user.name,
      riskLevel: summarizeWorkSignalRisk(acceptedSignals),
      createdAt: now,
    };
    return {
      commit: true,
      workspace: { ...workspace, workSignals: mergedSignals },
      result: { ok: true, acceptedSignals },
      auditLog,
    };
  });

  if (!outcome.result.ok) {
    return NextResponse.json(
      {
        error: "Work signal relationship guardrail violation.",
        details: outcome.result.issues,
      },
      { status: 400 },
    );
  }

  const acceptedSignals = outcome.result.acceptedSignals;

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.work-signals-ingest.v1",
    persistence: repository.readiness(),
    accepted: acceptedSignals.length,
    total: outcome.workspace.workSignals.length,
    workSignals: acceptedSignals,
    auditLog: outcome.auditLog,
  });
}
