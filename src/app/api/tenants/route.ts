import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { tenantProvisionInputSchema, formatZodError } from "@/lib/api-validation";
import { createSession, createSessionToken, sessionCookieName, type SessionUser } from "@/lib/auth";
import { getWorkspaceRepository, persistenceUnavailable } from "@/lib/database";
import type { AuditLog, User } from "@/lib/enterprise-ai-data";
import {
  buildTenantProvisioningDisabledResponse,
  buildTenantProvisioningResponse,
  buildTenantProvisioningStatusResponse,
} from "@/lib/tenant-provisioning-response";
import { tenantProvisioningReadinessFromEnv } from "@/lib/tenant-provisioning-readiness";
import { defaultOrganizationSecurityPolicy, normalizeWorkspace } from "@/lib/workspace-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET() {
  const readiness = tenantProvisioningReadinessFromEnv();
  return NextResponse.json(buildTenantProvisioningStatusResponse(readiness));
}

export async function POST(request: NextRequest) {
  const readiness = tenantProvisioningReadinessFromEnv();
  if (!readiness.enabled) {
    return NextResponse.json(buildTenantProvisioningDisabledResponse(readiness), { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = tenantProvisionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tenant provisioning payload.", details: formatZodError(parsed.error) }, { status: 400 });
  }

  const input = parsed.data;
  const slug = slugify(input.organizationName) || "workspace";
  const organizationId = `${slug}-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const adminId = `admin-${randomUUID().slice(0, 8)}`;
  const adminUser: User = {
    id: adminId,
    name: input.adminName,
    email: input.adminEmail,
    title: "Workspace Admin",
    department: input.adminDepartment,
    role: input.adminRole,
  };
  const workspace = normalizeWorkspace(
    {
      organizationId,
      workspaceMode: input.workspaceMode,
      organization: {
        id: organizationId,
        name: input.organizationName,
        slug,
        workspaceLabel: input.workspaceLabel,
        primaryColor: input.primaryColor,
        logoUrl: input.logoUrl,
        securityPolicy: defaultOrganizationSecurityPolicy,
        updatedAt: now,
      },
      users: [adminUser],
      auditLogs: [
        {
          id: `audit-tenant-created-${Date.now()}`,
          eventType: "tenant_workspace_created",
          message: `${input.organizationName} workspace provisioned in ${input.workspaceMode} mode.`,
          actor: input.adminName,
          riskLevel: "low",
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    organizationId,
  );

  const repository = getWorkspaceRepository();
  const unavailable = persistenceUnavailable(repository);
  if (unavailable) return NextResponse.json(unavailable, { status: 503 });

  const auditLog: AuditLog = {
    id: `audit-provisioning-${Date.now()}`,
    eventType: "tenant_provisioned",
    message: "Self-serve workspace provisioning completed and first admin session issued.",
    actor: input.adminName,
    riskLevel: "low",
    createdAt: now,
  };
  // Wrap the initial persist in mutateWorkspace so the creation write serializes
  // against any concurrent writer for this (freshly minted) tenant.
  const outcome = await repository.mutateWorkspace(organizationId, () => ({
    commit: true as const,
    workspace,
    result: true,
    auditLog,
  }));
  const saved = outcome.workspace;

  const sessionUser: SessionUser = {
    id: adminId,
    organizationId,
    name: input.adminName,
    email: input.adminEmail,
    role: input.adminRole,
    department: input.adminDepartment,
  };
  const session = createSession(sessionUser);
  const response = NextResponse.json(buildTenantProvisioningResponse({ workspace: saved, session }));

  response.cookies.set(sessionCookieName, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });

  return response;
}
