import type { NextRequest } from "next/server";
import { POST } from "../route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel Cron sends GET requests. Reuse the authenticated mutation handler;
// the public GET at /api/vault/invest remains a read-only status endpoint.
export async function GET(request: NextRequest) {
  return POST(request);
}

