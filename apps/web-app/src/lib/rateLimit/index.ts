import type { NextRequest } from "next/server";
import { isAuthEnforced } from "@/lib/auth/config";
import type { AuthenticatedSession } from "@/lib/auth/requireSession";
import { RateLimitError } from "@/lib/auth/errors";
import { redisIncr } from "@/lib/auth/redis";

export type RateLimitBucket =
  | "anchor-default"
  | "anchor-customers"
  | "anchor-quotes"
  | "anchor-kyc-upload";

const LIMITS: Record<RateLimitBucket, { windowSeconds: number; max: number }> =
  {
    "anchor-default": { windowSeconds: 60, max: 60 },
    "anchor-customers": { windowSeconds: 60, max: 10 },
    "anchor-quotes": { windowSeconds: 60, max: 20 },
    "anchor-kyc-upload": { windowSeconds: 60, max: 10 },
  };

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

async function checkLimit(
  bucket: RateLimitBucket,
  identifier: string
): Promise<void> {
  const { windowSeconds, max } = LIMITS[bucket];
  const key = `ratelimit:${bucket}:${identifier}`;
  const count = await redisIncr(key, windowSeconds);
  if (count > max) {
    throw new RateLimitError();
  }
}

export async function assertRateLimit(
  request: NextRequest,
  session: AuthenticatedSession,
  bucket: RateLimitBucket = "anchor-default"
): Promise<void> {
  if (!isAuthEnforced()) return;

  const ip = getClientIp(request);
  await checkLimit(bucket, `ip:${ip}`);
  if (session.publicKey !== "__dev_unauthenticated__") {
    await checkLimit(bucket, `session:${session.publicKey}`);
  }
}
