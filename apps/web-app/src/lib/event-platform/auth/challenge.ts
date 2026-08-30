import { randomBytes, createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventPlatformDb } from "../supabaseServer";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function hashNonce(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

export interface Challenge {
  message: string;
  expiresAt: string;
}

/**
 * SEP-10-lite: issues a one-time nonce embedded in a human-readable message
 * for the wallet to sign, without a full SEP-10 challenge-transaction flow
 * (no existing SEP-10/web-auth code exists in this repo to build on, and
 * this platform only needs "prove you hold this key", not a full auth
 * server). The nonce is stored hashed, mirroring `admin_login_codes`.
 */
export async function createChallenge(
  walletAddress: string,
  db: SupabaseClient = getEventPlatformDb()
): Promise<Challenge> {
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

  const { error } = await db.from("wallet_auth_challenges").insert({
    wallet_address: walletAddress,
    nonce_hash: hashNonce(nonce),
    expires_at: expiresAt,
  });
  if (error) {
    throw new Error(`createChallenge failed: ${error.message}`);
  }

  const message = [
    "Neko event platform sign-in",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`,
  ].join("\n");

  return { message, expiresAt };
}

/**
 * Verifies a signed challenge and, on success, consumes the nonce so it
 * cannot be replayed. Note: this targets the common case of a wallet
 * signing the raw UTF-8 message bytes directly (Freighter's documented
 * `signMessage` behavior) — other wallet adapters wired into
 * `@creit.tech/stellar-wallets-kit` may encode signed messages differently
 * and should be verified against a real wallet before relying on this for
 * anything beyond Freighter.
 */
export async function verifyChallenge(
  walletAddress: string,
  message: string,
  signatureBase64: string,
  db: SupabaseClient = getEventPlatformDb()
): Promise<boolean> {
  const nonceMatch = /Nonce: ([0-9a-f]+)/.exec(message);
  if (!nonceMatch) return false;
  const nonceHash = hashNonce(nonceMatch[1]);

  const { data, error } = await db
    .from("wallet_auth_challenges")
    .select("id, expires_at, consumed_at")
    .eq("wallet_address", walletAddress)
    .eq("nonce_hash", nonceHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  if (data.consumed_at) return false;
  if (new Date(data.expires_at).getTime() < Date.now()) return false;

  let signatureValid: boolean;
  try {
    const keypair = Keypair.fromPublicKey(walletAddress);
    signatureValid = keypair.verify(
      Buffer.from(message, "utf8"),
      Buffer.from(signatureBase64, "base64")
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return false;

  const { error: consumeError } = await db
    .from("wallet_auth_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id);

  return !consumeError;
}
