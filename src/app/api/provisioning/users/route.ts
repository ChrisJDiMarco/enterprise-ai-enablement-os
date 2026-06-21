import { NextRequest, NextResponse } from "next/server";
import {
  formatZodError,
  workspaceUserProvisionBatchInputSchema,
} from "@/lib/api-validation";
import { getRequestSession, requireRole } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import type { AuditLog } from "@/lib/enterprise-ai-data";
import {
  bearerToken,
  provisioningConfigured,
  resolveMachineProvisioningTenant,
  sessionProvisioningTenant,
} from "@/lib/provisioning-auth";
import { sortWorkspaceUsers, syncWorkspaceUsers, type WorkspaceProvisionUser } from "@/lib/workspace-users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProvisioningActor = {
  mode: "admin-session" | "machine-token";
  organizationId: string;
  actor: string;
};

async function requireProvisioningAccess(request: NextRequest, bodyOrganizationId?: string) {
  const token = bearerToken(request.headers.get("authorization"));
  if (token) {
    const tenant = resolveMachineProvisioningTenant({
      token,
      bodyOrganizationId,
      headerOrganizationId: request.headers.get("x-eaieos-tenant"),
    });
    if (!tenant.ok) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { error: tenant.error, code: tenant.code },
          { status: tenant.status },
        ),
      };
    }

    return {
      ok: true as const,
      actor: {
        mode: "machine-token",
        organizationId: tenant.organizationId,
        actor: "Provisioning API",
      } satisfies ProvisioningActor,
    };
  }

  const guard = requireRole(await getRequestSession(), "admin");
  if (!guard.ok) return guard;
  const tenant = sessionProvisioningTenant({
    bodyOrganizationId,
    sessionOrganizationId: guard.session.user.organizationId,
  });
  if (!tenant.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: tenant.error, code: tenant.code }, { status: tenant.status }),
    };
  }

  return {
    ok: true as const,
    actor: {
      mode: "admin-session",
      organizationId: tenant.organizationId,
      actor: guard.session.user.name,
    } satisfies ProvisioningActor,
  };
}

function displayName(value: unknown, email: string) {
  if (typeof value === "string" && value.trim()) return value.trim().replace(/\s+/g, " ");
  if (value && typeof value === "object") {
    const name = value as { formatted?: unknown; givenName?: unknown; familyName?: unknown };
    if (typeof name.formatted === "string" && name.formatted.trim()) return name.formatted.trim().replace(/\s+/g, " ");
    const parts = [name.givenName, name.familyName].filter((part): part is string => typeof part === "string" && Boolean(part.trim()));
    if (parts.length) return parts.join(" ").trim().replace(/\s+/g, " ");
  }
  return email.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Workspace Member";
}

function toProvisionUser(record: {
  id?: string;
  externalId?: string;
  name?: unknown;
  userName?: string;
  email?: string;
  title?: string;
  department?: WorkspaceProvisionUser["department"];
  role?: WorkspaceProvisionUser["role"];
  active?: boolean;
}): WorkspaceProvisionUser {
  const email = (record.email || record.userName || "").trim().toLowerCase();
  return {
    id: record.id,
    externalId: record.externalId,
    name: record.active === false ? displayName(record.name, email) : displayName(record.name, email),
    email,
    userName: record.userName,
    title: record.title,
    department: record.department,
    role: record.role,
    active: record.active,
  };
}

function provisioningAuditLog(params: {
  source: string;
  actor: string;
  upserted: number;
  removed: number;
  skipped: number;
  dryRun: boolean;
}): AuditLog {
  return {
    id: `audit-provisioning-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventType: params.dryRun ? "workspace_members_provisioning_dry_run" : "workspace_members_synced",
    message: `${params.source} user sync ${params.dryRun ? "previewed" : "completed"}: ${params.upserted} upserted, ${params.removed} removed, ${params.skipped} skipped.`,
    actor: params.actor,
    riskLevel: params.removed ? "medium" : "low",
    createdAt: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const guard = await requireProvisioningAccess(request);
  if (!guard.ok) return guard.response;

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.actor.organizationId);

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.provisioning-users.v1",
    mode: guard.actor.mode,
    provisioningTokenConfigured: provisioningConfigured(),
    organizationId: guard.actor.organizationId,
    persistence: repository.readiness(),
    users: sortWorkspaceUsers(workspace.users),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = workspaceUserProvisionBatchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provisioning payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  const guard = await requireProvisioningAccess(request, parsed.data.organizationId);
  if (!guard.ok) return guard.response;

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const workspace = await repository.getWorkspace(guard.actor.organizationId);
  const provisionUsers = parsed.data.users.map(toProvisionUser);
  const sync = syncWorkspaceUsers(workspace.users, provisionUsers, {
    deprovisionMissing: parsed.data.deprovisionMissing,
  });
  const auditLog = provisioningAuditLog({
    source: parsed.data.source,
    actor: guard.actor.actor,
    upserted: sync.upserted.length,
    removed: sync.removed.length,
    skipped: sync.skipped.length,
    dryRun: parsed.data.dryRun,
  });

  if (!sync.ok) {
    return NextResponse.json(
      {
        error: "Provisioning sync failed validation.",
        schema: "enterprise-ai-enablement-os.provisioning-users.v1",
        errors: sync.errors,
        skipped: sync.skipped,
        previewUsers: sortWorkspaceUsers(sync.users),
      },
      { status: 409 },
    );
  }

  if (!parsed.data.dryRun) {
    const saved = await repository.saveWorkspace({
      ...workspace,
      users: sync.users,
      updatedAt: new Date().toISOString(),
    });
    await repository.appendAuditLog(guard.actor.organizationId, auditLog);

    return NextResponse.json({
      schema: "enterprise-ai-enablement-os.provisioning-users.v1",
      mode: guard.actor.mode,
      organizationId: guard.actor.organizationId,
      source: parsed.data.source,
      dryRun: false,
      deprovisionMissing: parsed.data.deprovisionMissing,
      upserted: sync.upserted,
      removed: sync.removed,
      skipped: sync.skipped,
      users: sortWorkspaceUsers(saved.users),
      auditLog,
    });
  }

  return NextResponse.json({
    schema: "enterprise-ai-enablement-os.provisioning-users.v1",
    mode: guard.actor.mode,
    organizationId: guard.actor.organizationId,
    source: parsed.data.source,
    dryRun: true,
    deprovisionMissing: parsed.data.deprovisionMissing,
    upserted: sync.upserted,
    removed: sync.removed,
    skipped: sync.skipped,
    users: sortWorkspaceUsers(sync.users),
    auditLog,
  });
}
