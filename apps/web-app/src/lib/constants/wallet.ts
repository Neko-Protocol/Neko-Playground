/**
 * Wallet and price-related constants shared across wallet provider and price services.
 */

/** RWA token codes that use the oracle for pricing */
export const RWA_TOKENS = ["USTRY", "TESOURO", "CETES", "USDY", "PYUSD"];

/** LocalStorage keys used by WalletProvider for Stellar wallet state */
export const STORAGE_KEYS = {
  walletId: "walletId",
  walletAddress: "walletAddress",
  walletNetwork: "walletNetwork",
  networkPassphrase: "networkPassphrase",
} as const;

/** Interval (ms) for polling Stellar wallet state in WalletProvider */
export const POLL_INTERVAL = 1000;

/** Delay (ms) before resolving with error when price fetch fails; keeps loading state visible briefly. */
export const PRICE_ERROR_DELAY_MS = 800;
