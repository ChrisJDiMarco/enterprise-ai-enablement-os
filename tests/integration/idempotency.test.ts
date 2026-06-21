import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { getDatabasePool, closeDatabasePool, getWorkspaceRepository } from "../../src/lib/database.ts";
import { withIdempotency } from "../../src/lib/idempotency.ts";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for integration tests (run via `npm run test:integration`).");
}

const org = `idem-${process.pid}`;

async function clean() {
  const pool = getDatabasePool();
  if (pool) {
    await pool.query("delete from idempotency_records where organization_id like $1", [`${org}%`]);
  }
}

before(async () => {
  await getWorkspaceRepository().getWorkspace(org); // ensure schema
  await clean();
});

after(async () => {
  await clean();
  await closeDatabasePool();
});

test("withIdempotency runs the handler once and replays the cached response on retry", async () => {
  const pool = getDatabasePool();
  assert.ok(pool);
  let calls = 0;
  const handler = async () => {
    calls += 1;
    return { id: "run-1", value: calls };
  };

  const first = await withIdempotency(pool, { organizationId: org, scope: "test", key: "k1" }, handler);
  assert.equal(first.replayed, false);
  assert.equal(calls, 1);
  assert.deepEqual(first.result, { id: "run-1", value: 1 });

  const retry = await withIdempotency(pool, { organizationId: org, scope: "test", key: "k1" }, handler);
  assert.equal(retry.replayed, true, "a retry replays the stored response");
  assert.equal(calls, 1, "the side-effecting handler must NOT run again");
  assert.deepEqual(retry.result, { id: "run-1", value: 1 });

  const otherKey = await withIdempotency(pool, { organizationId: org, scope: "test", key: "k2" }, handler);
  assert.equal(otherKey.replayed, false);
  assert.equal(calls, 2, "a different key executes again");
});

test("idempotency keys are scoped per organization", async () => {
  const pool = getDatabasePool();
  assert.ok(pool);
  let calls = 0;
  const handler = async () => {
    calls += 1;
    return { calls };
  };
  await withIdempotency(pool, { organizationId: org, scope: "test", key: "shared" }, handler);
  await withIdempotency(pool, { organizationId: `${org}-other`, scope: "test", key: "shared" }, handler);
  assert.equal(calls, 2, "the same key in different orgs does not collide");
});
