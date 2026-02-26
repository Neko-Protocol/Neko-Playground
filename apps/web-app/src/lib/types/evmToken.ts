/**
 * Used for EVM chain tokens in swap, CoW Swap, and price services.
 */
export interface EVMToken {
  chainId: number;
  address: string;
  decimals: number;
  symbol: string;
  name?: string;
}

export function createEVMToken(
  chainId: number,
  address: string,
  decimals: number,
  symbol: string,
  name?: string
): EVMToken {
  return { chainId, address, decimals, symbol, name };
}

export function isEVMToken(t: unknown): t is EVMToken {
  return (
    typeof t === "object" &&
    t !== null &&
    "chainId" in t &&
    "address" in t &&
    "decimals" in t &&
    "symbol" in t
  );
}

/** Chain IDs used in the app (aligned with Uniswap ChainId for compatibility). */
export const ChainId = {
  MAINNET: 1,
  BNB: 56,
} as const;
