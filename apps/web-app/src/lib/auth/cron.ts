import { createHmac, timingSafeEqual } from "crypto";
import { serverEnv } from "@/lib/env.server";

/**
 * Verify that the request carries a valid cron Authorization header.
 *
 * Uses HMAC-SHA256 so both operands to timingSafeEqual always have the
 * same length (32 bytes), avoiding the length-mismatch throw while still
 * being timing-safe. Never use === for secret comparison.
 */
export function isAuthorizedCron(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const incoming = authHeader.slice(7);
  const secret = serverEnv.CRON_SECRET;

  // HMAC both values with the same key → fixed 32-byte digests → safe compare
  const a = createHmac("sha256", secret).update(incoming).digest();
  const b = createHmac("sha256", secret).update(secret).digest();

  return timingSafeEqual(a, b);
}
