import { serverEnv } from "@/lib/env.server";

export function isAuthEnforced(): boolean {
  const flag = serverEnv.AUTH_ENFORCEMENT;
  if (flag === "false" || flag === "0") {
    return false;
  }
  return true;
}

export function hasRedisConfig(): boolean {
  return Boolean(
    serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN
  );
}
