import { ensureDatabaseSchema, getDatabasePool, withTenant } from "./database.ts";

/**
 * Session revocation: stateless signed-cookie sessions can't be torn down on
 * their own, so a deactivated/removed user's token would stay valid until expiry.
 * This records a per-(org,user) "revoked_after" instant; any session issued at or
 * before it is rejected on the next request via getRequestSession.
 *
 * Reads are cached per org with a short TTL and FAIL OPEN — an unavailable
 * revocation store must never lock out an entire tenant (the token still expires).
 */

type RevocationMap = Map<string, number>; // userId -> revokedAfter (ms)

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { loadedAt: number; map: RevocationMap }>();
// File-mode / no-DB fallback: process-local store (dev only).
const memoryStore = new Map<string, RevocationMap>();

function nowMs() {
  return Date.now();
}

function memoryOrg(organizationId: string): RevocationMap {
  let map = memoryStore.get(organizationId);
  if (!map) {
    map = new Map();
    memoryStore.set(organizationId, map);
  }
  return map;
}

async function loadOrgRevocations(organizationId: string): Promise<RevocationMap> {
  const cached = cache.get(organizationId);
  if (cached && nowMs() - cached.loadedAt < CACHE_TTL_MS) return cached.map;

  const pool = getDatabasePool();
  if (!pool) {
    const map = memoryOrg(organizationId);
    cache.set(organizationId, { loadedAt: nowMs(), map });
    return map;
  }

  try {
    await ensureDatabaseSchema(pool);
    const result = await withTenant(pool, organizationId, (client) =>
      client.query<{ user_id: string; revoked_after: Date }>(
        "select user_id, revoked_after from session_revocations where organization_id = $1",
        [organizationId],
      ),
    );
    const map: RevocationMap = new Map(
      result.rows.map((row) => [row.user_id, new Date(row.revoked_after).getTime()]),
    );
    cache.set(organizationId, { loadedAt: nowMs(), map });
    return map;
  } catch {
    // Fail open — never block a whole tenant because the revocation store is down.
    return cached?.map ?? new Map();
  }
}

export async function isSessionRevoked(
  organizationId: string,
  userId: string,
  sessionIssuedAtMs: number,
): Promise<boolean> {
  if (!userId || !Number.isFinite(sessionIssuedAtMs)) return false;
  const map = await loadOrgRevocations(organizationId);
  const revokedAfter = map.get(userId);
  return typeof revokedAfter === "number" && sessionIssuedAtMs <= revokedAfter;
}

export async function revokeUserSessions(
  organizationId: string,
  userId: string,
  at: Date = new Date(),
): Promise<void> {
  if (!organizationId || !userId) return;
  const atMs = at.getTime();

  // Write through to the in-memory/cache layers so revocation is instant in-process.
  memoryOrg(organizationId).set(userId, atMs);
  const cached = cache.get(organizationId);
  if (cached) cached.map.set(userId, atMs);

  const pool = getDatabasePool();
  if (!pool) return;
  try {
    await ensureDatabaseSchema(pool);
    await withTenant(pool, organizationId, (client) =>
      client.query(
        `
        insert into session_revocations (organization_id, user_id, revoked_after)
        values ($1, $2, $3)
        on conflict (organization_id, user_id) do update set revoked_after = excluded.revoked_after
        `,
        [organizationId, userId, at],
      ),
    );
  } catch {
    // Best-effort: the in-process cache is already updated for this instance.
  }
}

/** Test seam — clears cached revocations and the in-memory fallback store. */
export function __resetSessionRevocationStateForTests() {
  cache.clear();
  memoryStore.clear();
}
