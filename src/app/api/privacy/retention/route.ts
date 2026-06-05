import { NextRequest, NextResponse } from "next/server";

import { formatZodError, privacyRetentionMaintenanceInputSchema } from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import {
  applyPrivacyRetentionSweep,
  derivePrivacyRetentionSweepPlan,
  privacyLifecycleConfigFromEnv,
} from "@/lib/privacy-lifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = requireRole(await getRequestSession(), "privacy_reviewer");
  if (!guard.ok) return guard.response;

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const plan = derivePrivacyRetentionSweepPlan({ workspace, dryRun: true });

  return NextResponse.json({
    ...plan,
    lifecycle: privacyLifecycleConfigFromEnv(),
  });
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "privacy_reviewer");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const parsed = privacyRetentionMaintenanceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid privacy retention maintenance payload.", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);
  const result = applyPrivacyRetentionSweep({
    workspace,
    dryRun: parsed.data.dryRun,
  });

  if (!result.dryRun) {
    if (result.applied) {
      await repository.saveWorkspace(result.workspace);
    }
    await repository.appendAuditLog(guard.session.user.organizationId, {
      id: `privacy-retention-sweep-${Date.now()}`,
      eventType: "privacy_retention_sweep",
      message: `Privacy retention sweep applied: ${result.expired} expired work signal(s) removed, ${result.retained} retained.`,
      actor: guard.session.user.name,
      riskLevel: result.expired > 0 ? "medium" : "low",
      createdAt: result.generatedAt,
    });
  }

  const { workspace: discardedWorkspace, ...payload } = result;
  void discardedWorkspace;
  return NextResponse.json({
    ...payload,
    lifecycle: privacyLifecycleConfigFromEnv(),
    persisted: !result.dryRun,
  });
}
