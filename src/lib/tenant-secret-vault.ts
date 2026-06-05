import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDatabasePool, ensureDatabaseSchema } from "./database.ts";
import {
  configuredSecret,
  secretVaultReadinessFromEnv,
  type SecretVaultReadiness,
} from "./runtime-readiness-policy.ts";

const algorithm = "aes-256-gcm";
const developmentVaultSecret = "local-dev-tenant-secret-vault-change-me";

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
  return path.join(process.cwd(), ".data", "secrets", `${organizationId}.json`);
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

export function getSecretVaultReadiness(env: NodeJS.ProcessEnv = process.env): SecretVaultReadiness {
  return secretVaultReadinessFromEnv(env);
}

export async function listTenantSecrets(organizationId: string): Promise<TenantSecretRecord[]> {
  const activePool = getDatabasePool();
  if (activePool) {
    await ensureDatabaseSchema(activePool);
    const result = await activePool.query<{ secret_name: string; updated_at: Date }>(
      "select secret_name, updated_at from tenant_secrets where organization_id = $1 order by updated_at desc",
      [organizationId],
    );
    return result.rows.map((row) => ({ name: row.secret_name, updatedAt: row.updated_at.toISOString() }));
  }

  try {
    const raw = await readFile(secretsPath(organizationId), "utf8");
    const records = JSON.parse(raw) as Record<string, EncryptedSecret>;
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
  const requested = new Set(requestedNames?.map((name) => name.trim()).filter(Boolean));
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
    const result = requested.size
      ? await activePool.query<{
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
      : await activePool.query<{
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
    return decryptRecords(JSON.parse(raw) as Record<string, EncryptedSecret>);
  } catch {
    return {};
  }
}

export async function upsertTenantSecrets(organizationId: string, secrets: Record<string, string>) {
  const entries = Object.entries(secrets)
    .map(([name, value]) => [name.trim(), value.trim()] as const)
    .filter(([name, value]) => name && value);
  if (!entries.length) return listTenantSecrets(organizationId);

  const encrypted = entries.map(([name, value]) => ({ name, ...encryptSecret(value) }));
  const activePool = getDatabasePool();
  if (activePool) {
    await ensureDatabaseSchema(activePool);
    for (const record of encrypted) {
      await activePool.query(
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
    return listTenantSecrets(organizationId);
  }

  const filePath = secretsPath(organizationId);
  let records: Record<string, EncryptedSecret> = {};
  try {
    records = JSON.parse(await readFile(filePath, "utf8")) as Record<string, EncryptedSecret>;
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
