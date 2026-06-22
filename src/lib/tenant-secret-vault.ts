import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDatabasePool, ensureDatabaseSchema, withTenant } from "./database.ts";
import {
  configuredSecret,
  secretVaultReadinessFromEnv,
  type SecretVaultReadiness,
} from "./runtime-readiness-policy.ts";
import { tenantSecretValueIssue } from "./tenant-secret-format.ts";
import { tenantScopedJsonPath } from "./tenant-file-storage.ts";

const algorithm = "aes-256-gcm";
const developmentVaultSecret = "local-dev-tenant-secret-vault-change-me";
const secretNamePattern = /^[A-Z0-9_]{2,120}$/;
const maxSecretValueLength = 20_000;

export type TenantSecretRecord = {
  name: string;
  updatedAt: string;
};

type EncryptedSecret = {
  encryptedValue: string;
  iv: string;
  tag: string;
  updatedAt: string;
};

function secretKey(env: NodeJS.ProcessEnv = process.env) {
  const configured = configuredSecret(env);
  if (!configured && env.NODE_ENV === "production") return null;
  return createHash("sha256").update(configured || developmentVaultSecret).digest();
}

function secretsPath(organizationId: string) {
  return tenantScopedJsonPath(path.join(process.cwd(), ".data", "secrets"), organizationId);
}

export function normalizeTenantSecretName(value: string) {
  const normalized = value.trim().toUpperCase();
  return secretNamePattern.test(normalized) ? normalized : "";
}

function normalizeTenantSecretNames(values: string[]) {
  return Array.from(new Set(values.map(normalizeTenantSecretName).filter(Boolean)));
}

function normalizeSecretUpdatedAt(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function normalizeSecretEntries(secrets: Record<string, string>) {
  const entries = new Map<string, string>();

  Object.entries(secrets).forEach(([rawName, rawValue]) => {
    const name = normalizeTenantSecretName(rawName);
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!name || !value || value.length > maxSecretValueLength || tenantSecretValueIssue(name, value)) return;
    entries.set(name, value);
  });

  return [...entries.entries()];
}

function encryptSecret(value: string, env: NodeJS.ProcessEnv = process.env): EncryptedSecret {
  const key = secretKey(env);
  if (!key) throw new Error("TENANT_SECRET_KEY is required before tenant secrets can be stored in production.");
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const encryptedValue = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64");
  const tag = cipher.getAuthTag().toString("base64");

  return {
    encryptedValue,
    iv: iv.toString("base64"),
    tag,
    updatedAt: new Date().toISOString(),
  };
}

export function decryptTenantSecret(record: EncryptedSecret, env: NodeJS.ProcessEnv = process.env) {
  const key = secretKey(env);
  if (!key) throw new Error("TENANT_SECRET_KEY is required before tenant secrets can be read in production.");
  const decipher = createDecipheriv(algorithm, key, Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function isEncryptedSecret(value: unknown): value is EncryptedSecret {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.encryptedValue === "string" &&
    typeof record.iv === "string" &&
    typeof record.tag === "string" &&
    typeof record.updatedAt === "string"
  );
}

/**
 * Parses the on-disk secrets file into a clean record. The raw cast is unsafe:
 * the values feed `createDecipheriv`, so a corrupt file (non-object, or records
 * missing iv/tag) must be rejected with a clear boundary error rather than
 * throwing deep inside the crypto primitives. Malformed individual records are
 * dropped and logged rather than poisoning the whole batch.
 */
function parseEncryptedSecretRecords(raw: string, organizationId: string): Record<string, EncryptedSecret> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.error("[secret-vault] secrets file is not a record object; ignoring it", { organizationId });
    return {};
  }
  const clean: Record<string, EncryptedSecret> = {};
  let dropped = 0;
  for (const [name, record] of Object.entries(parsed as Record<string, unknown>)) {
    const normalizedName = normalizeTenantSecretName(name);
    if (normalizedName && isEncryptedSecret(record)) {
      clean[normalizedName] = {
        ...record,
        updatedAt: normalizeSecretUpdatedAt(record.updatedAt),
      };
    } else {
      dropped += 1;
    }
  }
  if (dropped > 0) {
    console.error("[secret-vault] dropped malformed secret records", { organizationId, dropped });
  }
  return clean;
}

export function getSecretVaultReadiness(env: NodeJS.ProcessEnv = process.env): SecretVaultReadiness {
  return secretVaultReadinessFromEnv(env);
}

export async function listTenantSecrets(organizationId: string): Promise<TenantSecretRecord[]> {
  const activePool = getDatabasePool();
  if (activePool) {
    await ensureDatabaseSchema(activePool);
    const result = await withTenant(activePool, organizationId, (client) =>
      client.query<{ secret_name: string; updated_at: Date }>(
        "select secret_name, updated_at from tenant_secrets where organization_id = $1 order by updated_at desc",
        [organizationId],
      ),
    );
    return result.rows
      .map((row) => ({ name: normalizeTenantSecretName(row.secret_name), updatedAt: row.updated_at.toISOString() }))
      .filter((row): row is TenantSecretRecord => Boolean(row.name));
  }

  try {
    const raw = await readFile(secretsPath(organizationId), "utf8");
    const records = parseEncryptedSecretRecords(raw, organizationId);
    return Object.entries(records)
      .map(([name, record]) => ({ name, updatedAt: record.updatedAt }))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  } catch {
    return [];
  }
}

export async function readTenantSecretValues(
  organizationId: string,
  requestedNames?: string[],
): Promise<Record<string, string>> {
  const requested = new Set(normalizeTenantSecretNames(requestedNames ?? []));
  const shouldInclude = (name: string) => !requested.size || requested.has(name);

  const decryptRecords = (records: Record<string, EncryptedSecret>) =>
    Object.fromEntries(
      Object.entries(records)
        .filter(([name]) => shouldInclude(name))
        .map(([name, record]) => [name, decryptTenantSecret(record)]),
    );

  const activePool = getDatabasePool();
  if (activePool) {
    await ensureDatabaseSchema(activePool);
    const result = await withTenant(activePool, organizationId, (client) =>
      requested.size
        ? client.query<{
            secret_name: string;
            encrypted_value: string;
            iv: string;
            tag: string;
            updated_at: Date;
          }>(
            `
            select secret_name, encrypted_value, iv, tag, updated_at
            from tenant_secrets
            where organization_id = $1 and secret_name = any($2::text[])
            `,
            [organizationId, [...requested]],
          )
        : client.query<{
            secret_name: string;
            encrypted_value: string;
            iv: string;
            tag: string;
            updated_at: Date;
          }>(
            `
            select secret_name, encrypted_value, iv, tag, updated_at
            from tenant_secrets
            where organization_id = $1
            `,
            [organizationId],
          ),
    );

    return decryptRecords(
      Object.fromEntries(
        result.rows.map((row) => [
          row.secret_name,
          {
            encryptedValue: row.encrypted_value,
            iv: row.iv,
            tag: row.tag,
            updatedAt: row.updated_at.toISOString(),
          },
        ]),
      ),
    );
  }

  try {
    const raw = await readFile(secretsPath(organizationId), "utf8");
    return decryptRecords(parseEncryptedSecretRecords(raw, organizationId));
  } catch {
    return {};
  }
}

export async function upsertTenantSecrets(organizationId: string, secrets: Record<string, string>) {
  const entries = normalizeSecretEntries(secrets);
  if (!entries.length) return listTenantSecrets(organizationId);

  const encrypted = entries.map(([name, value]) => ({ name, ...encryptSecret(value) }));
  const activePool = getDatabasePool();
  if (activePool) {
    await ensureDatabaseSchema(activePool);
    await withTenant(activePool, organizationId, async (client) => {
      for (const record of encrypted) {
        await client.query(
          `
          insert into tenant_secrets (organization_id, secret_name, encrypted_value, iv, tag, updated_at)
          values ($1, $2, $3, $4, $5, $6)
          on conflict (organization_id, secret_name)
          do update set encrypted_value = excluded.encrypted_value,
            iv = excluded.iv,
            tag = excluded.tag,
            updated_at = excluded.updated_at
          `,
          [organizationId, record.name, record.encryptedValue, record.iv, record.tag, new Date(record.updatedAt)],
        );
      }
    });
    return listTenantSecrets(organizationId);
  }

  const filePath = secretsPath(organizationId);
  let records: Record<string, EncryptedSecret> = {};
  try {
    records = parseEncryptedSecretRecords(await readFile(filePath, "utf8"), organizationId);
  } catch {
    records = {};
  }
  encrypted.forEach((record) => {
    records[record.name] = {
      encryptedValue: record.encryptedValue,
      iv: record.iv,
      tag: record.tag,
      updatedAt: record.updatedAt,
    };
  });
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(records, null, 2));
  return listTenantSecrets(organizationId);
}

export async function deleteTenantSecrets(organizationId: string, names: string[]) {
  const requested = normalizeTenantSecretNames(names);
  if (!requested.length) return listTenantSecrets(organizationId);

  const activePool = getDatabasePool();
  if (activePool) {
    await ensureDatabaseSchema(activePool);
    await withTenant(activePool, organizationId, (client) =>
      client.query(
        "delete from tenant_secrets where organization_id = $1 and secret_name = any($2::text[])",
        [organizationId, requested],
      ),
    );
    return listTenantSecrets(organizationId);
  }

  const filePath = secretsPath(organizationId);
  let records: Record<string, EncryptedSecret> = {};
  try {
    records = parseEncryptedSecretRecords(await readFile(filePath, "utf8"), organizationId);
  } catch {
    return [];
  }
  requested.forEach((name) => {
    delete records[name];
  });
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(records, null, 2));
  return listTenantSecrets(organizationId);
}
