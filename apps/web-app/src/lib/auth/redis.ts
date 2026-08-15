import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env.server";

let redisClient: Redis | null = null;

const memoryStore = new Map<string, { value: string; expiresAt?: number }>();

function cleanExpiredMemoryKeys(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}

export function getRedis(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const url = serverEnv.UPSTASH_REDIS_REST_URL;
  const token = serverEnv.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

export async function redisGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    const value = await redis.get<string>(key);
    return value ?? null;
  }

  cleanExpiredMemoryKeys();
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    if (ttlSeconds) {
      await redis.set(key, value, { ex: ttlSeconds });
    } else {
      await redis.set(key, value);
    }
    return;
  }

  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
  });
}

export async function redisGetDel(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    const value = await redis.getdel<string>(key);
    return value ?? null;
  }

  cleanExpiredMemoryKeys();
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  memoryStore.delete(key);
  return entry.value;
}

export async function redisIncr(
  key: string,
  ttlSeconds: number
): Promise<number> {
  const redis = getRedis();
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return count;
  }

  cleanExpiredMemoryKeys();
  const entry = memoryStore.get(key);
  const now = Date.now();
  if (!entry || (entry.expiresAt !== undefined && entry.expiresAt <= now)) {
    memoryStore.set(key, {
      value: "1",
      expiresAt: now + ttlSeconds * 1000,
    });
    return 1;
  }

  const next = Number.parseInt(entry.value, 10) + 1;
  memoryStore.set(key, { value: String(next), expiresAt: entry.expiresAt });
  return next;
}
