import { getRwaTokenCodes } from "./assets.config";

export const RWA_TOKENS = getRwaTokenCodes();
export const STABLECOIN_FALLBACK_USD = 1;

export const STORAGE_KEYS = {
  walletId: "walletId",
  walletAddress: "walletAddress",
  walletNetwork: "walletNetwork",
  networkPassphrase: "networkPassphrase",
} as const;

export const POLL_INTERVAL = 1000;
export const PRICE_ERROR_DELAY_MS = 800;
