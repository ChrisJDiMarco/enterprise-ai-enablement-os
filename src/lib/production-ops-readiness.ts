import { configuredRuntimeHttpUrl, runtimeHttpUrlIssue } from "./runtime-url-config.ts";

export type RuntimeEnv = Record<string, string | undefined>;

export type OperationsReadiness = {
  configured: boolean;
  mode: string;
  reason: string;
  evidence: string[];
};

export type AuditChainVerificationLike = {
  verified: boolean;
  algorithm: string;
  checked: number;
  sealed: number;
  legacy: number;
  lastHash: string | null;
  gaps: string[];
};

function isProduction(env: RuntimeEnv) {
  return env.NODE_ENV === "production";
}

function hasValue(env: RuntimeEnv, name: string) {
  return Boolean(env[name]?.trim());
}

export function backupReadinessFromEnv(env: RuntimeEnv = process.env): OperationsReadiness {
  const hasBackupTarget =
    hasValue(env, "DATABASE_BACKUP_URL") ||
    hasValue(env, "PG_BACKUP_BUCKET") ||
    hasValue(env, "S3_BACKUP_BUCKET") ||
    env.MANAGED_DATABASE_BACKUPS === "true";
  const hasSchedule = hasValue(env, "DATABASE_BACKUP_SCHEDULE") || env.MANAGED_DATABASE_BACKUPS === "true";
  const hasRestoreDrill = hasValue(env, "DATABASE_RESTORE_DRILL_AT") || env.RESTORE_DRILL_VERIFIED === "true";
  const configured = hasBackupTarget && hasSchedule && hasRestoreDrill;

  if (configured) {
    return {
      configured: true,
      mode: env.MANAGED_DATABASE_BACKUPS === "true" ? "managed-backups" : "scheduled-backups",
      reason: "Database backup target, cadence, and restore-drill evidence are configured.",
      evidence: [
        hasBackupTarget ? "backup target configured" : "",
        hasSchedule ? "backup cadence configured" : "",
        hasRestoreDrill ? "restore drill recorded" : "",
      ].filter(Boolean),
    };
  }

  return {
    configured: false,
    mode: isProduction(env) ? "missing-production-backups" : "local-backup-not-required",
    reason: isProduction(env)
      ? "Production needs DATABASE_BACKUP_URL or managed backups, DATABASE_BACKUP_SCHEDULE, and DATABASE_RESTORE_DRILL_AT before customer data is accepted."
      : "Local development can run without backup infrastructure. Configure backup variables before launch.",
    evidence: [
      hasBackupTarget ? "backup target configured" : "backup target missing",
      hasSchedule ? "backup cadence configured" : "backup cadence missing",
      hasRestoreDrill ? "restore drill recorded" : "restore drill missing",
    ],
  };
}

export function migrationReadinessFromEnv(env: RuntimeEnv = process.env): OperationsReadiness {
  const schemaVersion = env.DB_SCHEMA_VERSION || env.APP_SCHEMA_VERSION;
  const migrationsApplied = env.DB_MIGRATIONS_APPLIED === "true" || Boolean(schemaVersion);

  if (migrationsApplied) {
    return {
      configured: true,
      mode: "schema-versioned",
      reason: schemaVersion
        ? `Database schema is versioned at ${schemaVersion}.`
        : "DB_MIGRATIONS_APPLIED=true confirms the schema migration gate has been run.",
      evidence: [schemaVersion ? `schema ${schemaVersion}` : "migration gate applied"],
    };
  }

  return {
    configured: false,
    mode: isProduction(env) ? "migration-gate-missing" : "local-auto-schema",
    reason: isProduction(env)
      ? "Set DB_SCHEMA_VERSION or DB_MIGRATIONS_APPLIED=true after running npm run db:migrate against the production database."
      : "Development auto-creates local schema. Production should run the explicit migration gate.",
    evidence: ["schema version not declared"],
  };
}

export function traceStoreReadinessFromEnv(env: RuntimeEnv = process.env): OperationsReadiness {
  const durable = hasValue(env, "DATABASE_URL");
  const emergencyFileStore = isProduction(env) && env.ALLOW_FILE_DATABASE_IN_PRODUCTION === "true";
  return {
    configured: durable || emergencyFileStore || !isProduction(env),
    mode: durable
      ? "postgres-trace-store"
      : emergencyFileStore
        ? "emergency-file-trace-store"
        : isProduction(env)
          ? "missing-durable-trace-store"
          : "local-file-trace-store",
    reason: durable
      ? "Harness traces, model routing metadata, policy decisions, and prompt quality records can be stored durably in Postgres."
      : emergencyFileStore
        ? "Emergency file trace storage is active. This is acceptable only for an explicitly scoped private-beta or recovery window."
        : isProduction(env)
        ? "DATABASE_URL is required for a durable trace store at scale."
        : "Harness traces use local file storage during development.",
    evidence: [durable ? "Postgres trace table available" : "file trace fallback"],
  };
}

export function evalRunnerReadinessFromEnv(env: RuntimeEnv = process.env): OperationsReadiness {
  const externalRunner = Boolean(configuredRuntimeHttpUrl(env, "EVAL_RUNNER_URL"));
  const externalRunnerIssue = runtimeHttpUrlIssue(env, "EVAL_RUNNER_URL");
  const durableResults = hasValue(env, "DATABASE_URL");
  const configured = externalRunner || durableResults || !isProduction(env);

  return {
    configured,
    mode: externalRunner ? "external-eval-runner" : durableResults ? "durable-local-eval-runner" : isProduction(env) ? "missing-eval-runner" : "local-eval-runner",
    reason: externalRunner
      ? "External evaluation runner is configured for scale-out eval jobs."
      : durableResults
        ? "Deterministic eval runner is active and persists artifacts durably in Postgres."
        : isProduction(env)
          ? externalRunnerIssue
            ? `EVAL_RUNNER_URL is invalid: ${externalRunnerIssue}`
            : "Configure EVAL_RUNNER_URL or DATABASE_URL before production eval evidence is relied on."
          : "Local deterministic eval runner is available for development.",
    evidence: [
      externalRunner ? "external runner endpoint" : "local deterministic runner",
      externalRunnerIssue ? "external runner endpoint invalid" : "",
      durableResults ? "durable eval artifacts" : "file eval artifacts",
    ].filter(Boolean),
  };
}

export function auditIntegrityReadinessFromEnv(env: RuntimeEnv = process.env): OperationsReadiness {
  const explicitlyDisabled = env.AUDIT_INTEGRITY_ENABLED === "false";
  const durableStore = hasValue(env, "DATABASE_URL");
  const emergencyFileStore = isProduction(env) && env.ALLOW_FILE_DATABASE_IN_PRODUCTION === "true";

  if (explicitlyDisabled) {
    return {
      configured: false,
      mode: "audit-chain-disabled",
      reason: "AUDIT_INTEGRITY_ENABLED=false disables tamper-evident audit sealing. Customer launches should keep it enabled.",
      evidence: ["audit chain disabled"],
    };
  }

  if (durableStore) {
    return {
      configured: true,
      mode: "postgres-hash-chain",
      reason: "Tamper-evident audit sealing is enabled and backed by durable Postgres persistence.",
      evidence: ["sha256 audit chain", "durable audit_events table"],
    };
  }

  if (emergencyFileStore) {
    return {
      configured: true,
      mode: "emergency-file-hash-chain",
      reason: "Tamper-evident audit sealing is enabled against emergency file persistence. Move to Postgres before broad customer launch.",
      evidence: ["sha256 audit chain", "file audit_events fallback"],
    };
  }

  return {
    configured: !isProduction(env),
    mode: isProduction(env) ? "missing-durable-audit-chain" : "local-file-hash-chain",
    reason: isProduction(env)
      ? "DATABASE_URL is required so signed audit evidence survives deploys, scale-out workers, and browser sessions."
      : "Tamper-evident audit sealing is enabled against the local file repository during development.",
    evidence: [isProduction(env) ? "durable audit store missing" : "local sealed audit log"],
  };
}

export function auditIntegrityReadinessFromVerification(
  integrity: AuditChainVerificationLike,
  env: RuntimeEnv = process.env,
): OperationsReadiness {
  if (env.AUDIT_INTEGRITY_ENABLED === "false") {
    return {
      configured: false,
      mode: "audit-chain-disabled",
      reason: "AUDIT_INTEGRITY_ENABLED=false disables tamper-evident audit sealing. Customer launches should keep it enabled.",
      evidence: ["audit chain disabled"],
    };
  }

  const hasAuditEvents = integrity.checked > 0;
  const configured = integrity.verified && (!hasAuditEvents || integrity.legacy === 0);

  return {
    configured,
    mode: hasAuditEvents ? integrity.algorithm : "empty-chain-ready",
    reason: !hasAuditEvents
      ? "No tenant audit events exist yet. New events will be sealed into the tamper-evident chain."
      : integrity.verified
        ? `${integrity.sealed} sealed audit event${integrity.sealed === 1 ? "" : "s"} verified.`
        : `Audit chain needs attention: ${integrity.gaps[0] ?? "unsealed or tampered events detected."}`,
    evidence: [
      `${integrity.sealed}/${integrity.checked} sealed`,
      integrity.lastHash ? `last ${integrity.lastHash.slice(0, 12)}` : "no chain head",
      integrity.legacy ? `${integrity.legacy} legacy` : "no legacy gaps",
    ],
  };
}
