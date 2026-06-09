import type { Session } from "./auth.ts";
import type { TenantProvisioningReadiness } from "./tenant-provisioning-readiness.ts";
import type { EnterpriseWorkspace } from "./workspace-schema.ts";

export function buildTenantProvisioningStatusResponse(readiness: TenantProvisioningReadiness) {
  return {
    schema: "enterprise-ai-enablement-os.tenant-provisioning.v1" as const,
    public: true,
    enabled: readiness.enabled,
    requested: readiness.requested,
    configured: readiness.configured,
    mode: readiness.enabled ? "self-serve" : "disabled",
    readinessMode: readiness.mode,
    reason: readiness.enabled
      ? "Self-serve tenant onboarding is available."
      : "Self-serve tenant onboarding is currently unavailable.",
    detail: readiness.configured
      ? "Tenant onboarding controls are configured."
      : "An administrator can review launch readiness after signing in.",
  };
}

export function buildTenantProvisioningDisabledResponse(readiness: TenantProvisioningReadiness) {
  return {
    ...buildTenantProvisioningStatusResponse(readiness),
    error: "Self-serve tenant provisioning is disabled.",
    code: "TENANT_PROVISIONING_DISABLED" as const,
  };
}

export function buildTenantProvisioningResponse({
  workspace,
  session,
}: {
  workspace: EnterpriseWorkspace;
  session: Session;
}) {
  const admin = workspace.users.find((user) => user.id === session.user.id);

  return {
    schema: "enterprise-ai-enablement-os.tenant-provisioning.v1" as const,
    tenant: {
      organizationId: workspace.organizationId,
      name: workspace.organization.name,
      slug: workspace.organization.slug,
      workspaceLabel: workspace.organization.workspaceLabel,
      workspaceMode: workspace.workspaceMode,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      admin: admin
        ? {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            department: admin.department,
          }
        : null,
    },
    session: {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      role: session.user.role,
      expiresAt: session.expiresAt,
    },
    links: {
      workspace: "/api/workspace",
      readiness: "/api/readiness",
      providers: "/api/providers",
    },
    nextSteps: [
      "Connect SSO or invite reviewers.",
      "Add approved context sources.",
      "Capture the first use case from a department leader.",
      "Configure provider keys in the server vault.",
      "Run the launch readiness gate before inviting a pilot group.",
    ],
  };
}
