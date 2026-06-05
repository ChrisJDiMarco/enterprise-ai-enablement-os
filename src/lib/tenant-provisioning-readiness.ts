type RuntimeEnv = Record<string, string | undefined>;

export type TenantProvisioningReadiness = {
  requested: boolean;
  enabled: boolean;
  configured: boolean;
  mode: "disabled" | "development-self-serve" | "production-self-serve-ready" | "production-self-serve-risk";
  reason: string;
  evidence: string[];
  missing: string[];
};

function hasValue(env: RuntimeEnv, name: string) {
  return Boolean(env[name]?.trim());
}

function enabled(env: RuntimeEnv, name: string) {
  return env[name] === "true";
}

function onboardingTermsConfigured(env: RuntimeEnv) {
  return (
    hasValue(env, "CUSTOMER_ONBOARDING_TERMS_URL") ||
    hasValue(env, "ONBOARDING_TERMS_URL") ||
    hasValue(env, "TERMS_OF_SERVICE_URL")
  );
}

export function selfServeSignupRequested(env: RuntimeEnv = process.env) {
  return env.NODE_ENV !== "production" || enabled(env, "SELF_SERVE_SIGNUP_ENABLED");
}

export function tenantProvisioningReadinessFromEnv(env: RuntimeEnv = process.env): TenantProvisioningReadiness {
  const requested = selfServeSignupRequested(env);
  const production = env.NODE_ENV === "production";
  const ssoReady =
    enabled(env, "AUTH_REQUIRED") &&
    hasValue(env, "OIDC_ISSUER") &&
    hasValue(env, "OIDC_CLIENT_ID") &&
    hasValue(env, "OIDC_CLIENT_SECRET");
  const databaseReady = hasValue(env, "DATABASE_URL");
  const secretVaultReady = hasValue(env, "TENANT_SECRET_KEY") || hasValue(env, "SECRET_VAULT_KEY");
  const apiProtectionReady = hasValue(env, "API_TRUSTED_ORIGINS") && hasValue(env, "API_RATE_LIMIT_KEY_SALT");
  const termsReady = onboardingTermsConfigured(env);
  const evidence = [
    ssoReady ? "enterprise SSO ready" : "enterprise SSO missing",
    databaseReady ? "durable database ready" : "durable database missing",
    secretVaultReady ? "tenant secret vault ready" : "tenant secret vault missing",
    apiProtectionReady ? "trusted origin and salted rate-limit keys ready" : "trusted origin or rate-limit salt missing",
    termsReady ? "customer onboarding terms linked" : "customer onboarding terms missing",
  ];
  const missing = [
    ssoReady ? "" : "AUTH_REQUIRED=true with OIDC_ISSUER, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET",
    databaseReady ? "" : "DATABASE_URL",
    secretVaultReady ? "" : "TENANT_SECRET_KEY or SECRET_VAULT_KEY",
    apiProtectionReady ? "" : "API_TRUSTED_ORIGINS and API_RATE_LIMIT_KEY_SALT",
    termsReady ? "" : "CUSTOMER_ONBOARDING_TERMS_URL, ONBOARDING_TERMS_URL, or TERMS_OF_SERVICE_URL",
  ].filter(Boolean);

  if (!requested) {
    return {
      requested,
      enabled: false,
      configured: true,
      mode: "disabled",
      reason: "Self-serve tenant onboarding is disabled; use controlled admin/import onboarding until launch prerequisites are ready.",
      evidence: ["self-serve disabled", ...evidence],
      missing: [],
    };
  }

  if (!production) {
    return {
      requested,
      enabled: true,
      configured: false,
      mode: "development-self-serve",
      reason: "Self-serve tenant onboarding is open for local development. Disable it in production until SSO, durable storage, tenant secrets, API protection, and onboarding terms are ready.",
      evidence: ["local development self-serve", ...evidence],
      missing,
    };
  }

  if (missing.length) {
    return {
      requested,
      enabled: false,
      configured: false,
      mode: "production-self-serve-risk",
      reason: `SELF_SERVE_SIGNUP_ENABLED=true, but self-serve onboarding is not safe yet. Missing: ${missing.join("; ")}.`,
      evidence,
      missing,
    };
  }

  return {
    requested,
    enabled: true,
    configured: true,
    mode: "production-self-serve-ready",
    reason: "Self-serve tenant onboarding is enabled with enterprise identity, durable storage, tenant secrets, API protection, and onboarding terms.",
    evidence,
    missing,
  };
}
