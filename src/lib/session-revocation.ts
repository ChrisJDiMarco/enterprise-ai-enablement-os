import { ensureDatabaseSchema, getDatabasePool, withTenant } from "./database.ts";

/**
 * Session revocation: stateless signed-cookie sessions can't be torn down on
 * their own, so a deactivated/removed user's token would stay valid until expiry.
 * This records a per-(org,user) "revoked_after" instant; any session issued at or
 * before it is rejected on the next request via getRequestSession.
 *
 * Reads are cached per org with a short TTL. The cache rides out transient
 * store blips (a stale cache is used when the DB errors), but a COLD cache with
 * an unavailable store FAILS CLOSED — we cannot prove a session wasn't revoked,
 * so the caller must deny rather than grant. A deprovisioned user must not slip
 * through during an outage; the rest of the app is already degraded then anyway.
 */

type RevocationMap = Map<string, number>; // userId -> revokedAfter (ms)

/** Thrown when revocation state cannot be determined (store down, no cache). */
export class SessionRevocationUnavailableError extends Error {
  readonly organizationId: string;
  constructor(organizationId: string, cause?: unknown) {
    super("Session revocation store is unavailable; failing closed.");
    this.name = "SessionRevocationUnavailableError";
    this.organizationId = organizationId;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

const CACHE_TTL_MS = 5_000;
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

async function loadOrgRevocations(
  organizationId: string,
  executor: ReturnType<typeof getDatabasePool> = getDatabasePool(),
): Promise<RevocationMap> {
  const cached = cache.get(organizationId);
  if (cached && nowMs() - cached.loadedAt < CACHE_TTL_MS) return cached.map;

  const pool = executor;
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
  } catch (error) {
    // Ride out transient blips with the last-known revocations.
    if (cached) return cached.map;
    // Cold cache + store unavailable: fail CLOSED so the caller denies access.
    throw new SessionRevocationUnavailableError(organizationId, error);
  }
}

export async function isSessionRevoked(
  organizationId: string,
  userId: string,
  sessionIssuedAtMs: number,
  executor: ReturnType<typeof getDatabasePool> = getDatabasePool(),
): Promise<boolean> {
  if (!userId || !Number.isFinite(sessionIssuedAtMs)) return false;
  const map = await loadOrgRevocations(organizationId, executor);
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
