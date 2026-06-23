import { describeSecretWeakness, secretWeakness } from "./secret-strength.ts";
import { trustedOriginsAreValid, type RuntimeEnv } from "./runtime-readiness-policy.ts";

/**
 * Fatal misconfigurations that must stop a PRODUCTION server from booting.
 *
 * These are the cases where serving traffic is actively dangerous, not merely
 * degraded: a forgeable session secret, a guessable tenant-vault key, or a
 * broken origin allowlist. Readiness/preflight reports the softer "absent"
 * cases; this is the hard fail-fast gate.
 */
export function productionStartupIssues(env: RuntimeEnv = process.env): string[] {
  const issues: string[] = [];

  // AUTH_SECRET signs every session token — missing, placeholder, or weak is fatal.
  const authSecret = env.AUTH_SECRET || env.NEXTAUTH_SECRET;
  const authWeakness = secretWeakness(authSecret);
  if (authWeakness) issues.push(describeSecretWeakness("AUTH_SECRET", authWeakness));

  // TENANT_SECRET_KEY encrypts tenant provider credentials. Absence degrades the
  // vault (handled by readiness), but a PLACEHOLDER/weak value set by mistake is
  // dangerous — it implies "configured" while being publicly known. Fail on that.
  const vaultKey = env.TENANT_SECRET_KEY || env.SECRET_VAULT_KEY;
  if (vaultKey !== undefined && vaultKey.trim() !== "") {
    const vaultWeakness = secretWeakness(vaultKey);
    if (vaultWeakness) issues.push(describeSecretWeakness("TENANT_SECRET_KEY", vaultWeakness));
  }

  // A broken trusted-origins list silently blocks every mutation — fail fast.
  if (!trustedOriginsAreValid(env)) {
    issues.push("API_TRUSTED_ORIGINS must list valid HTTP(S) origins (no paths, queries, or fragments) in production.");
  }

  return issues;
}

/**
 * In production, refuse to start if any fatal misconfiguration is present.
 * Logs a structured error and exits non-zero so orchestrators (K8s, etc.)
 * detect the bad startup instead of routing traffic to a broken instance.
 */
export function assertProductionStartup(env: RuntimeEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;
  const issues = productionStartupIssues(env);
  if (issues.length === 0) return;

  console.error(
    JSON.stringify({ level: "error", name: "startup.config_invalid", issues }),
  );
  process.exit(1);
}
