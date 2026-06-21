import { authReadiness } from "./auth-readiness.ts";
import {
  apiProtectionReadinessFromEnv,
  databaseReadinessFromEnv,
  secretVaultReadinessFromEnv,
} from "./runtime-readiness-policy.ts";

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

function enabled(env: RuntimeEnv, name: string) {
  return env[name] === "true";
}

function onboardingTermsConfigured(env: RuntimeEnv) {
  return ["CUSTOMER_ONBOARDING_TERMS_URL", "ONBOARDING_TERMS_URL", "TERMS_OF_SERVICE_URL"].some((name) => {
    const raw = env[name]?.trim();
    if (!raw) return false;
    try {
      const url = new URL(raw);
      return url.protocol === "https:" && Boolean(url.host) && !url.username && !url.password && !url.hash;
    } catch {
      return false;
    }
  });
}

export function selfServeSignupRequested(env: RuntimeEnv = process.env) {
  return env.NODE_ENV !== "production" || enabled(env, "SELF_SERVE_SIGNUP_ENABLED");
}

export function tenantProvisioningReadinessFromEnv(env: RuntimeEnv = process.env): TenantProvisioningReadiness {
  const requested = selfServeSignupRequested(env);
  const production = env.NODE_ENV === "production";
  const auth = authReadiness(env);
  const database = databaseReadinessFromEnv(env);
  const secretVault = secretVaultReadinessFromEnv(env);
  const apiProtection = apiProtectionReadinessFromEnv(env);
  const ssoReady = enabled(env, "AUTH_REQUIRED") && auth.oidcConfigured;
  const databaseReady = database.durable;
  const secretVaultReady = secretVault.encrypted && secretVault.configured;
  const apiProtectionReady = apiProtection.configured && apiProtection.salted;
  const termsReady = onboardingTermsConfigured(env);
  const evidence = [
    ssoReady ? "enterprise SSO ready" : "enterprise SSO missing",
    databaseReady ? "durable database ready" : "durable database missing",
    secretVaultReady ? "tenant secret vault ready" : "tenant secret vault missing",
    apiProtectionReady ? "trusted origin and salted rate-limit keys ready" : "trusted origin or rate-limit salt missing",
    termsReady ? "customer onboarding terms linked" : "customer onboarding terms missing",
  ];
  const missing = [
    ssoReady ? "" : "AUTH_REQUIRED=true with OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_REDIRECT_URI",
    databaseReady ? "" : "DATABASE_URL",
    secretVaultReady ? "" : "TENANT_SECRET_KEY or SECRET_VAULT_KEY",
    apiProtectionReady ? "" : "API_TRUSTED_ORIGINS and API_RATE_LIMIT_KEY_SALT",
    termsReady ? "" : "CUSTOMER_ONBOARDING_TERMS_URL, ONBOARDING_TERMS_URL, or TERMS_OF_SERVICE_URL with an HTTPS URL",
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
