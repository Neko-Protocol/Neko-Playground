import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { FAUCET_COOLDOWN_MS } from "@/lib/constants/faucet";

export type FaucetRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  releaseToken?: string;
};

const memoryStore = new Map<
  string,
  { acquiredAt: number; releaseToken: string }
>();
let warnedInMemoryFallback = false;

const releaseIfOwnedScript = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

function cooldownSeconds(): number {
  return Math.max(1, Math.ceil(FAUCET_COOLDOWN_MS / 1000));
}

function keyFor(address: string): string {
  return `faucet:rl:${address}`;
}

function isRateLimitDisabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.FAUCET_RATE_LIMIT_DISABLED === "true"
  );
}

/**
 * Prefer Upstash REST env; also accept Vercel KV REST vars (same shape).
 * Read at call time so tests can stub env without reloading the module.
 */
function getRedis(): Redis | null {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const credentials =
    upstashUrl && upstashToken
      ? { url: upstashUrl, token: upstashToken }
      : kvUrl && kvToken
        ? { url: kvUrl, token: kvToken }
        : null;

  if (!credentials) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Faucet rate limiting requires Redis configuration in production"
      );
    }
    return null;
  }
  return new Redis(credentials);
}

function acquireInMemory(address: string): FaucetRateLimitResult {
  if (!warnedInMemoryFallback) {
    console.warn(
      "[faucet] Rate limit using in-memory Map (no Upstash/Vercel KV configured). " +
        "Not durable across serverless instances. Set UPSTASH_REDIS_REST_URL + " +
        "UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_*), or FAUCET_RATE_LIMIT_DISABLED=true for local tooling."
    );
    warnedInMemoryFallback = true;
  }

  const now = Date.now();
  const last = memoryStore.get(address);
  if (last !== undefined && now - last.acquiredAt < FAUCET_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((FAUCET_COOLDOWN_MS - (now - last.acquiredAt)) / 1000)
      ),
    };
  }

  // Check + set is synchronous (no await between), so two concurrent
  // requests on one Node process cannot both pass within a single tick.
  const releaseToken = randomUUID();
  memoryStore.set(address, { acquiredAt: now, releaseToken });
  return { allowed: true, retryAfterSeconds: 0, releaseToken };
}

/**
 * Atomically acquire a faucet mint slot for `address`.
 *
 * Production: Redis `SET key releaseToken NX EX <cooldownSeconds>` — shared across
 * cold starts and parallel instances. Missing configuration rejects the mint.
 * Outside production / no KV: in-memory Map + one-shot warn.
 * Local tooling: `FAUCET_RATE_LIMIT_DISABLED=true` only skips limiting outside
 * production; it never bypasses the shared production cooldown.
 */
export async function acquireFaucetRateLimit(
  address: string
): Promise<FaucetRateLimitResult> {
  if (isRateLimitDisabled()) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const redis = getRedis();
  if (!redis) {
    return acquireInMemory(address);
  }

  const key = keyFor(address);
  const ex = cooldownSeconds();
  const releaseToken = randomUUID();
  const set = await redis.set(key, releaseToken, { nx: true, ex });

  if (set === "OK") {
    return { allowed: true, retryAfterSeconds: 0, releaseToken };
  }

  const ttl = await redis.ttl(key);
  return {
    allowed: false,
    retryAfterSeconds: ttl >= 0 ? Math.max(1, ttl) : ex,
  };
}

/**
 * Release only the slot owned by this acquisition (e.g. mint failed). A late
 * failure after expiry or a retried cleanup cannot delete a successor's slot.
 * Disabled limiting returns no token, so its cleanup is a no-op.
 */
export async function releaseFaucetRateLimit(
  address: string,
  releaseToken: string | undefined
): Promise<void> {
  if (releaseToken === undefined) return;

  const redis = getRedis();
  if (!redis) {
    if (memoryStore.get(address)?.releaseToken === releaseToken) {
      memoryStore.delete(address);
    }
    return;
  }

  await redis.eval(releaseIfOwnedScript, [keyFor(address)], [releaseToken]);
}

/** Test-only: clear in-memory state and the one-shot warn flag. */
export function __resetFaucetRateLimitForTests(): void {
  memoryStore.clear();
  warnedInMemoryFallback = false;
}
