export type RuntimeEnv = Record<string, string | undefined>;

export const sessionCookieName = "eaieos_session";

export function localLoginAllowed(env: RuntimeEnv = process.env) {
  return env.NODE_ENV !== "production" || env.LOCAL_LOGIN_ENABLED === "true";
}

export function localAdminModeAllowed(env: RuntimeEnv = process.env) {
  return env.NODE_ENV !== "production" && env.AUTH_REQUIRED !== "true";
}

export function authConfigurationIssues(env: RuntimeEnv = process.env) {
  const issues: string[] = [];
  const warnings: string[] = [];
  const authSecret = env.AUTH_SECRET || env.NEXTAUTH_SECRET;
  const oidcConfigured = Boolean(env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET);

  if (env.NODE_ENV === "production" && !authSecret) {
    issues.push("AUTH_SECRET is required in production.");
  }

  if (env.NODE_ENV === "production" && env.AUTH_REQUIRED !== "true") {
    issues.push("AUTH_REQUIRED must be true in production.");
  }

  if (env.AUTH_REQUIRED === "true" && !oidcConfigured && !localLoginAllowed(env)) {
    issues.push("AUTH_REQUIRED is true but OIDC is not configured.");
  }

  if (env.NODE_ENV !== "production" && !authSecret) {
    warnings.push("Using the local development auth secret.");
  }

  if (localLoginAllowed(env) && env.NODE_ENV === "production") {
    warnings.push("LOCAL_LOGIN_ENABLED is true in production. Disable after emergency access is no longer needed.");
  }

  return { issues, warnings };
}

export function authReadiness(env: RuntimeEnv = process.env) {
  const oidcConfigured = Boolean(env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET);
  const configuration = authConfigurationIssues(env);

  return {
    authRequired: env.AUTH_REQUIRED === "true",
    oidcConfigured,
    localLoginEnabled: localLoginAllowed(env),
    sessionCookie: sessionCookieName,
    mode: oidcConfigured
      ? "oidc-ready"
      : env.AUTH_REQUIRED === "true"
        ? "signed-cookie-required"
        : localAdminModeAllowed(env)
          ? "local-admin-dev"
          : "disabled",
    issues: configuration.issues,
    warnings: configuration.warnings,
  };
}
