import { authReadiness, publicAuthReadiness, type RuntimeEnv } from "./auth-readiness.ts";

export type PublicReadinessResponse = ReturnType<typeof buildPublicReadinessResponse>;

function authIssueToCheck(_issue: string, index: number) {
  return {
    id: `auth-${index + 1}`,
    label: "Authentication setup",
    status: "fail" as const,
    detail: "Authentication setup is not ready. Contact the workspace administrator.",
  };
}

function authWarningToCheck(_warning: string, index: number) {
  return {
    id: `auth-warning-${index + 1}`,
    label: "Authentication warning",
    status: "warn" as const,
    detail: "Authentication is running in a non-standard sign-in mode. Contact the workspace administrator if this is unexpected.",
  };
}

export function buildPublicReadinessResponse({
  generatedAt = new Date().toISOString(),
  env = process.env,
}: {
  generatedAt?: string;
  env?: RuntimeEnv;
} = {}) {
  const auth = authReadiness(env);
  const blockers = auth.issues.map(authIssueToCheck);
  const warnings = auth.warnings.map(authWarningToCheck);

  return {
    schema: "enterprise-ai-enablement-os.production-readiness.v1" as const,
    public: true,
    generatedAt,
      status: blockers.length ? ("blocked" as const) : ("degraded" as const),
    auth: publicAuthReadiness(env),
    blockers,
    warnings,
    tenantEvidence: {
      loaded: false,
      errors: ["Authenticate to load tenant readiness evidence."],
    },
    session: null,
  };
}
