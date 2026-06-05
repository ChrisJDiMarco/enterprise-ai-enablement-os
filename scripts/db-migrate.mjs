import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

async function readMigrations() {
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  try {
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));
    if (files.length > 0) {
      return Promise.all(
        files.map(async (file) => {
          const id = file.replace(/\.sql$/, "");
          const sql = await readFile(path.join(migrationsDir, file), "utf8");
          return { id, file, sql, checksum: checksum(sql) };
        }),
      );
    }
  } catch {
    // Fall back to the compiled schema for older checkouts that do not have versioned migrations yet.
  }

  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const sql = await readFile(schemaPath, "utf8");
  return [{ id: "schema", file: "schema.sql", sql, checksum: checksum(sql) }];
}

function checksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

async function ensureMigrationTable(pool) {
  await pool.query(`
    create table if not exists schema_migrations (
      id text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    );
  `);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run database migrations.");
  }

  const migrations = await readMigrations();
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await ensureMigrationTable(pool);
    const applied = [];
    const skipped = [];
    for (const migration of migrations) {
      const existing = await pool.query("select checksum from schema_migrations where id = $1", [migration.id]);
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.id} checksum mismatch. Refusing to continue because production schema history changed.`,
          );
        }
        skipped.push(migration.id);
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(migration.sql);
        await client.query("insert into schema_migrations (id, checksum) values ($1, $2)", [
          migration.id,
          migration.checksum,
        ]);
        await client.query("commit");
        applied.push(migration.id);
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    await pool.query("select 1");
    console.log(
      JSON.stringify(
        {
          ok: true,
          schema: "enterprise-ai-enablement-os.database-migration.v1",
          migrations: migrations.map((migration) => ({ id: migration.id, file: migration.file })),
          applied,
          skipped,
          appliedAt: new Date().toISOString(),
          next: "Set DB_SCHEMA_VERSION or DB_MIGRATIONS_APPLIED=true in the deployment environment after this succeeds.",
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
