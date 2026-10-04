import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Vercel Cron auth: when `CRON_SECRET` is set in the project env, Vercel
 * automatically sends `Authorization: Bearer <CRON_SECRET>` on cron
 * invocations. Manual/admin callers must send the same header.
 *
 * Reads `process.env.CRON_SECRET` at call time (not module load) so tests can
 * stub it and so a missing secret always fails closed.
 *
 * Never logs or returns the secret.
 */
export function verifyCronBearer(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const token = header.slice("Bearer ".length);
  const expected = Buffer.from(secret);
  const actual = Buffer.from(token);
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}
