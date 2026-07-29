import { kv } from "@vercel/kv";

const INVEST_LOCK_KEY = "vault:invest:lock";
// TTL slightly under 24 h so the lock auto-expires before the next daily cron
const INVEST_LOCK_TTL_SECONDS = 23 * 60 * 60;

/**
 * Attempt to acquire the invest cron lock atomically (Redis SET NX EX).
 * Returns true if the lock was granted — the caller should proceed.
 * Returns false if another invocation already holds the lock.
 */
export async function acquireInvestLock(): Promise<boolean> {
  const result = await kv.set(INVEST_LOCK_KEY, "1", {
    nx: true,
    ex: INVEST_LOCK_TTL_SECONDS,
  });
  return result === "OK";
}

/**
 * Release the invest lock. Always call in a finally block after the job
 * completes or errors so the next scheduled run is not blocked.
 */
export async function releaseInvestLock(): Promise<void> {
  await kv.del(INVEST_LOCK_KEY);
}

/**
 * Return the remaining TTL of the invest lock in seconds, or 0 if unlocked.
 * Use in GET /api/vault/invest to report durable cooldown state.
 */
export async function getInvestLockTtl(): Promise<number> {
  const ttl = await kv.ttl(INVEST_LOCK_KEY);
  return Math.max(0, ttl);
}

const FAUCET_PREFIX = "faucet:rl:";
const FAUCET_TTL_SECONDS = 5 * 60;

/**
 * Check and atomically set the faucet rate limit for an address.
 *
 * The KV TTL acts as automatic expiry — the store is always bounded.
 * Returns { allowed: true } when the caller may proceed, or
 * { allowed: false, remainingSeconds } when the cooldown is active.
 */
export async function checkAndSetFaucetRateLimit(
  address: string
): Promise<{ allowed: true } | { allowed: false; remainingSeconds: number }> {
  const key = `${FAUCET_PREFIX}${address}`;
  const result = await kv.set(key, Date.now(), { nx: true, ex: FAUCET_TTL_SECONDS });

  if (result === "OK") return { allowed: true };

  const ttl = await kv.ttl(key);
  return { allowed: false, remainingSeconds: Math.max(0, ttl) };
}
