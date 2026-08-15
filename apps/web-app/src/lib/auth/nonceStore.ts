import { NONCE_TTL_SECONDS } from "./constants";
import { redisGetDel, redisSet } from "./redis";

export interface NonceRecord {
  publicKey: string;
  message: string;
  expiresAt: number;
}

function nonceKey(nonce: string): string {
  return `nonce:${nonce}`;
}

export async function putNonce(
  nonce: string,
  record: Omit<NonceRecord, "expiresAt"> & { expiresAt?: number }
): Promise<void> {
  const payload: NonceRecord = {
    ...record,
    expiresAt: record.expiresAt ?? Date.now() + NONCE_TTL_SECONDS * 1000,
  };
  await redisSet(nonceKey(nonce), JSON.stringify(payload), NONCE_TTL_SECONDS);
}

export async function takeNonce(nonce: string): Promise<NonceRecord | null> {
  const raw = await redisGetDel(nonceKey(nonce));
  if (!raw) return null;

  try {
    const record = JSON.parse(raw) as NonceRecord;
    if (record.expiresAt < Date.now()) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}
