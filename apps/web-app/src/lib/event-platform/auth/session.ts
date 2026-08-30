import { randomBytes, createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventPlatformDb } from "../supabaseServer";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = "neko_wallet_session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

export class UnauthorizedError extends Error {}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  walletAddress: string,
  db: SupabaseClient = getEventPlatformDb()
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { error } = await db.from("wallet_sessions").insert({
    wallet_address: walletAddress,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  });
  if (error) throw new Error(`createSession failed: ${error.message}`);
  return token;
}

async function resolveSession(
  token: string,
  db: SupabaseClient
): Promise<string | null> {
  const { data, error } = await db
    .from("wallet_sessions")
    .select("wallet_address, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.wallet_address as string;
}

function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * Resolves the wallet a request is authenticated as, throwing
 * `UnauthorizedError` if it isn't. This is what every new route calls to
 * scope reads/writes to exactly one wallet — the ownership boundary the
 * rest of this codebase's routes don't have (they trust a client-supplied
 * address; this platform's wallet-scoped surface is new enough to warrant
 * the real check).
 */
export async function requireWalletSession(
  request: Request,
  db: SupabaseClient = getEventPlatformDb()
): Promise<string> {
  const token = parseCookie(
    request.headers.get("cookie") ?? "",
    SESSION_COOKIE_NAME
  );
  if (!token) throw new UnauthorizedError("No session cookie");

  const walletAddress = await resolveSession(token, db);
  if (!walletAddress) throw new UnauthorizedError("Invalid or expired session");
  return walletAddress;
}
