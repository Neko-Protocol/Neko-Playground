/**
 * Pools feature view models.
 * PoolCardData is used for the list/card view; PoolDetailView is the
 * formatted display shape for the pool detail page.
 */

/** Card view model for the pools list page. */
export interface PoolCardData {
  id: string;
  token1: string;
  token2: string;
  fee: string;
  roi: string;
  feeApy: string;
  liquidity: string;
  isActive: boolean;
  type: string;
  /** Used for borrow filter. */
  supportedActions?: string[];
}

/** Formatted display fields for the pool detail page (TVL, APY, labels). */
export interface PoolDetailView {
  token1: string;
  token2: string;
  tvlFormatted: string;
  apyFormatted: string;
  typeLabel: string;
}

/** Filter option for pools list. */
export type PoolTypeFilter = "all" | "lending" | "borrow" | "amm";

/**
 * Returns the display category for a pool type.
 * Used for badges and filtering.
 */
export function getPoolCategory(type: string): "lending" | "borrow" | "amm" {
  if (type === "blend" || type === "neko") return "lending";
  if (type === "soroswap") return "amm";
  return "amm";
}

/**
 * Returns the display label for a pool type (e.g. "Lending", "AMM").
 */
export function getPoolTypeLabel(type: string): string {
  const category = getPoolCategory(type);
  return category.charAt(0).toUpperCase() + category.slice(1);
}
