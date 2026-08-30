/**
 * There's no session/auth layer anywhere in this app's API routes — every
 * caller identifies itself by passing its own wallet address, the same
 * convention `strategies/route.ts` already uses for other request fields.
 * This just centralizes the "is this a plausible Stellar public key"
 * extraction/validation so every ledger-backed route rejects a missing or
 * malformed wallet the same way.
 */
const STELLAR_PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;

export class MissingWalletAddressError extends Error {
  constructor() {
    super("walletAddress is required");
    this.name = "MissingWalletAddressError";
  }
}

export function requireWalletAddress(value: unknown): string {
  if (typeof value !== "string" || !STELLAR_PUBLIC_KEY_RE.test(value)) {
    throw new MissingWalletAddressError();
  }
  return value;
}
