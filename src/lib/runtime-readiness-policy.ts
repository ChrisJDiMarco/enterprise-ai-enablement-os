import { describeSecretWeakness, secretWeakness } from "./secret-strength.ts";

export type RuntimeEnv = Record<string, string | undefined>;

export const MIN_RATE_LIMIT_SALT_LENGTH = 16;

export type DatabaseMode = "postgres" | "file" | "unconfigured";

export type DatabaseReadiness = {
  mode: DatabaseMode;
  configured: boolean;
  durable: boolean;
  reason: string;
};

export type SecretVaultMode = "tenant-encrypted" | "development-fallback" | "missing";

export type SecretVaultReadiness = {
  configured: boolean;
  encrypted: boolean;
  mode: SecretVaultMode;
  reason: string;
};

export type ApiProtectionReadiness = {
  configured: boolean;
  salted: boolean;
  mode: "production-origin-guard" | "development-origin-guard" | "missing-trusted-origins" | "missing-rate-limit-salt";
  reason: string;
};

export const missingProductionDatabaseReason =
  "DATABASE_URL is required for production persistence. Set DATABASE_URL before launch, or set ALLOW_FILE_DATABASE_IN_PRODUCTION=true only for an explicitly accepted emergency fallback.";

function usableDatabaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "postgres:" || url.protocol === "postgresql:";
  } catch {
    return false;
  }
}

function validTrustedOrigin(value: string) {
  try {
    const url = new URL(value.trim());
    const pathIsOriginOnly = (url.pathname === "" || url.pathname === "/") && !url.search && !url.hash;
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.host) && pathIsOriginOnly;
  } catch {
    return false;
  }
}

export function trustedOriginValues(env: RuntimeEnv = process.env) {
  return (env.API_TRUSTED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function trustedOriginsAreValid(env: RuntimeEnv = process.env) {
  const origins = trustedOriginValues(env);
  return origins.length > 0 && origins.every(validTrustedOrigin);
}

export function productionDatabaseFallbackAllowed(env: RuntimeEnv = process.env) {
  return env.NODE_ENV !== "production" || env.ALLOW_FILE_DATABASE_IN_PRODUCTION === "true";
}

export function databaseReadinessFromEnv(env: RuntimeEnv = process.env): DatabaseReadiness {
  if (usableDatabaseUrl(env.DATABASE_URL)) {
    return {
      mode: "postgres",
      configured: true,
      durable: true,
      reason: "DATABASE_URL is configured. Workspace snapshots and audit events use Postgres.",
    };
  }

  if (env.DATABASE_URL?.trim() && env.NODE_ENV === "production") {
    return {
      mode: "unconfigured",
      configured: false,
      durable: false,
      reason: "DATABASE_URL must be a valid postgres:// or postgresql:// connection string before production launch.",
    };
  }

  if (!productionDatabaseFallbackAllowed(env)) {
    return {
      mode: "unconfigured",
      configured: false,
      durable: false,
      reason: missingProductionDatabaseReason,
    };
  }

  const productionOverride = env.NODE_ENV === "production" && env.ALLOW_FILE_DATABASE_IN_PRODUCTION === "true";
  return {
    mode: "file",
    configured: true,
    durable: false,
    reason: productionOverride
      ? "Emergency file persistence override is active. This is not durable enough for customer production data."
      : "DATABASE_URL is not configured. Using local file persistence under .data for development.",
  };
}

export function configuredSecret(env: RuntimeEnv = process.env) {
  return env.TENANT_SECRET_KEY || env.SECRET_VAULT_KEY;
}

export function secretVaultReadinessFromEnv(env: RuntimeEnv = process.env): SecretVaultReadiness {
  const configured = configuredSecret(env);

  if (env.NODE_ENV === "production") {
    const weakness = secretWeakness(configured);
    if (weakness) {
      return {
        configured: false,
        encrypted: false,
        mode: "missing",
        reason:
          weakness === "missing"
            ? "TENANT_SECRET_KEY is required in production before self-serve tenant provider keys can be stored."
            : describeSecretWeakness("TENANT_SECRET_KEY", weakness),
      };
    }
    return {
      configured: true,
      encrypted: true,
      mode: "tenant-encrypted",
      reason: "TENANT_SECRET_KEY is configured. Tenant-owned provider credentials can be encrypted server-side.",
    };
  }

  if (configured) {
    return {
      configured: true,
      encrypted: true,
      mode: "tenant-encrypted",
      reason: "TENANT_SECRET_KEY is configured. Tenant-owned provider credentials can be encrypted server-side.",
    };
  }

  return {
    configured: true,
    encrypted: true,
    mode: "development-fallback",
    reason: "Using a local development vault key. Set TENANT_SECRET_KEY before production launch.",
  };
}

export function apiProtectionReadinessFromEnv(env: RuntimeEnv = process.env): ApiProtectionReadiness {
  const trusted = trustedOriginsAreValid(env);
  const saltValue = env.API_RATE_LIMIT_KEY_SALT?.trim();
  const salted = Boolean(saltValue && saltValue.length >= MIN_RATE_LIMIT_SALT_LENGTH);
  const allowUnsalted = env.ALLOW_UNSALTED_RATE_LIMITS_IN_PRODUCTION === "true";

  if (env.NODE_ENV === "production" && !trusted) {
    return {
      configured: false,
      salted,
      mode: "missing-trusted-origins",
      reason: "API_TRUSTED_ORIGINS must include valid HTTP(S) origins without paths, query strings, or fragments before customer launch.",
    };
  }

  if (env.NODE_ENV === "production") {
    if (!salted && !allowUnsalted) {
      return {
        configured: false,
        salted: false,
        mode: "missing-rate-limit-salt",
        reason: `API_RATE_LIMIT_KEY_SALT (at least ${MIN_RATE_LIMIT_SALT_LENGTH} characters) is required in production so per-client rate-limit keys are not guessable. Set it, or set ALLOW_UNSALTED_RATE_LIMITS_IN_PRODUCTION=true for a scoped beta.`,
      };
    }
    return {
      configured: true,
      salted,
      mode: "production-origin-guard",
      reason: salted
        ? "API same-origin mutation guard, route-sensitive rate limits, request IDs, and salted rate-limit keys are active."
        : "API same-origin mutation guard and route-sensitive rate limits are active. Rate-limit keys are unsalted (ALLOW_UNSALTED_RATE_LIMITS_IN_PRODUCTION override).",
    };
  }

  return {
    configured: true,
    salted,
    mode: "development-origin-guard",
    reason: "API mutation origin guard, route-sensitive rate limits, payload caps, and request IDs are active for local development.",
  };
}
