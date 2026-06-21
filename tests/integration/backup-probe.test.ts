import { test, after } from "node:test";
import assert from "node:assert/strict";

import { getDatabasePool, closeDatabasePool } from "../../src/lib/database.ts";
import { probeManagedBackups } from "../../src/lib/production-ops-readiness.ts";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for integration tests (run via `npm run test:integration`).");
}

after(async () => {
  await closeDatabasePool();
});

test("probeManagedBackups queries pg_stat_archiver and never falsely claims a verified backup", async () => {
  const pool = getDatabasePool();
  assert.ok(pool);

  const readiness = await probeManagedBackups(pool, {});
  assert.equal(typeof readiness.configured, "boolean");
  assert.equal(typeof readiness.mode, "string");

  // CI Postgres has no WAL archiving configured, so the probe must NOT report a
  // verified recoverable backup — that is the whole point (no false attestation).
  assert.notEqual(readiness.mode, "verified-wal-archiving");
});

test("probeManagedBackups marks env-attested backups as unverified when archiving is absent", async () => {
  const pool = getDatabasePool();
  assert.ok(pool);

  const readiness = await probeManagedBackups(pool, {
    MANAGED_DATABASE_BACKUPS: "true",
    RESTORE_DRILL_VERIFIED: "true",
  });
  assert.equal(readiness.configured, true);
  assert.equal(readiness.mode, "operator-attested-unverified");
  assert.match(readiness.reason, /could not be verified/i);
});
