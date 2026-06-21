import type { Pool } from "pg";

/**
 * Idempotency for mutating, side-effecting routes. Keyed by (organization, scope,
 * idempotency_key), it caches the first response and replays it on retry so a
 * client/network retry can't double-execute a real-world side effect (e.g. a
 * connector write). Covers the dominant case — a SEQUENTIAL retry after the first
 * attempt completed. A truly concurrent duplicate (same key in-flight twice) may
 * execute twice but still returns ONE consistent response (the stored winner);
 * once-only-under-concurrency would require a pre-execution claim row.
 */
export async function withIdempotency<T>(
  pool: Pool,
  params: { organizationId: string; scope: string; key: string },
  handler: () => Promise<T>,
): Promise<{ result: T; replayed: boolean }> {
  const { organizationId, scope, key } = params;

  const existing = await pool.query<{ response: T }>(
    "select response from idempotency_records where organization_id = $1 and scope = $2 and idempotency_key = $3",
    [organizationId, scope, key],
  );
  if (existing.rows[0]) {
    return { result: existing.rows[0].response, replayed: true };
  }

  const result = await handler();

  const inserted = await pool.query<{ idempotency_key: string }>(
    `insert into idempotency_records (organization_id, scope, idempotency_key, response)
     values ($1, $2, $3, $4::jsonb)
     on conflict (organization_id, scope, idempotency_key) do nothing
     returning idempotency_key`,
    [organizationId, scope, key, JSON.stringify(result)],
  );

  if (inserted.rows.length === 0) {
    // A concurrent request stored first — return its response for a consistent result.
    const winner = await pool.query<{ response: T }>(
      "select response from idempotency_records where organization_id = $1 and scope = $2 and idempotency_key = $3",
      [organizationId, scope, key],
    );
    if (winner.rows[0]) return { result: winner.rows[0].response, replayed: true };
  }

  return { result, replayed: false };
}
