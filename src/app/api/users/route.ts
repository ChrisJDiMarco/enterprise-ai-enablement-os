import { NextRequest, NextResponse } from "next/server";
import {
  formatZodError,
  workspaceUserDeleteInputSchema,
  workspaceUserInputSchema,
} from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import { revokeUserSessions } from "@/lib/session-revocation";
import type { AuditLog, User } from "@/lib/enterprise-ai-data";
import {
  normalizeWorkspaceUser,
  removeWorkspaceUser,
  sortWorkspaceUsers,
  upsertWorkspaceUser,
} from "@/lib/workspace-users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function memberAuditLog(params: {
  eventType: string;
  message: string;
  actor: string;
  riskLevel?: AuditLog["riskLevel"];
}): AuditLog {
  return {
    id: `audit-member-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventType: params.eventType,
    message: params.message,
    actor: params.actor,
    riskLevel: params.riskLevel ?? "low",
    createdAt: new Date().toISOString(),
  };
}

export async function GET() {
  const guard = requireRole(await getRequestSession(), "viewer");
  if (!guard.ok) return guard.response;

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.session.user.organizationId);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.users-response.v1",
    persistence: repository.readiness(),
    users: sortWorkspaceUsers(workspace.users),
  });
}

export async function POST(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "admin");
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = workspaceUserInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workspace member payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const candidate = normalizeWorkspaceUser(parsed.data);
  const outcome = await repository.mutateWorkspace<ReturnType<typeof upsertWorkspaceUser>>(
    guard.session.user.organizationId,
    (workspace) => {
      const mutation = upsertWorkspaceUser(workspace.users, candidate);
      if (!mutation.ok) {
        return { commit: false, result: mutation };
      }
      const auditLog = memberAuditLog({
        eventType: "workspace_member_upserted",
        message: `${mutation.user.name} was ${mutation.action} as ${mutation.user.role}.`,
        actor: guard.session.user.name,
      });
      return { commit: true, workspace: { ...workspace, users: mutation.users }, result: mutation, auditLog };
    },
  );

  const mutation = outcome.result;
  if (!mutation.ok) {
    return NextResponse.json({ error: mutation.message, reason: mutation.reason }, { status: 409 });
  }

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.users-response.v1",
    persistence: repository.readiness(),
    user: mutation.user,
    users: sortWorkspaceUsers(outcome.workspace.users),
    auditLog: outcome.auditLog,
  });
}

export async function DELETE(request: NextRequest) {
  const guard = requireRole(await getRequestSession(), "admin");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const parsed = workspaceUserDeleteInputSchema.safeParse({ userId: url.searchParams.get("userId") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workspace member delete request.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const outcome = await repository.mutateWorkspace<{
    mutation: ReturnType<typeof removeWorkspaceUser>;
    currentUsers: User[];
  }>(guard.session.user.organizationId, (workspace) => {
    const mutation = removeWorkspaceUser(workspace.users, parsed.data.userId);
    if (!mutation.ok) {
      return { commit: false, result: { mutation, currentUsers: workspace.users } };
    }
    const auditLog = memberAuditLog({
      eventType: "workspace_member_removed",
      message: `${mutation.user.name} was removed from the tenant roster.`,
      actor: guard.session.user.name,
      riskLevel: "medium",
    });
    return {
      commit: true,
      workspace: { ...workspace, users: mutation.users },
      result: { mutation, currentUsers: workspace.users },
      auditLog,
    };
  });

  const mutation = outcome.result.mutation;
  if (!mutation.ok) {
    if (mutation.reason === "not_found") {
      return NextResponse.json({
        schema: "enterprise-ai-enablement-os.users-response.v1",
        persistence: repository.readiness(),
        removedUserId: parsed.data.userId,
        removed: false,
        users: sortWorkspaceUsers(outcome.result.currentUsers),
      });
    }
    return NextResponse.json({ error: mutation.message, reason: mutation.reason }, { status: 409 });
  }

  // The removed user's signed-cookie session must stop working immediately.
  await revokeUserSessions(guard.session.user.organizationId, mutation.user.id);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.users-response.v1",
    persistence: repository.readiness(),
    removedUserId: mutation.user.id,
    removed: true,
    users: sortWorkspaceUsers(outcome.workspace.users),
    auditLog: outcome.auditLog,
  });
}
