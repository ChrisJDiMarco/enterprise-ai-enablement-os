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

  let result: ReturnType<typeof applyPrivacyRetentionSweep>;
  if (parsed.data.dryRun) {
    const workspace = await repository.getWorkspace(guard.session.user.organizationId);
    result = applyPrivacyRetentionSweep({ workspace, dryRun: true });
  } else {
    // Compute + apply the sweep atomically against the freshest state, sealing
    // the audit event under a per-tenant lock so concurrent sweeps can't clobber.
    const outcome = await repository.mutateWorkspace<ReturnType<typeof applyPrivacyRetentionSweep>>(
      guard.session.user.organizationId,
      (current) => {
        const sweep = applyPrivacyRetentionSweep({ workspace: current, dryRun: false });
        return {
          commit: true as const,
          workspace: sweep.applied ? sweep.workspace : current,
          result: sweep,
          auditLog: {
            id: `privacy-retention-sweep-${Date.now()}`,
            eventType: "privacy_retention_sweep",
            message: `Privacy retention sweep applied: ${sweep.expired} expired work signal(s) removed, ${sweep.retained} retained.`,
            actor: guard.session.user.name,
            riskLevel: sweep.expired > 0 ? "medium" : "low",
            createdAt: sweep.generatedAt,
          },
        };
      },
    );
    result = outcome.result;
  }

  const { workspace: discardedWorkspace, ...payload } = result;
  void discardedWorkspace;
  return NextResponse.json({
    ...payload,
    lifecycle: privacyLifecycleConfigFromEnv(),
    persisted: !result.dryRun,
  });
}
