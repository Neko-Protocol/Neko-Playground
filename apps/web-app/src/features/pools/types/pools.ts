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
}

/** Formatted display fields for the pool detail page (TVL, APY, labels). */
export interface PoolDetailView {
  token1: string;
  token2: string;
  tvlFormatted: string;
  apyFormatted: string;
  typeLabel: string;
}
