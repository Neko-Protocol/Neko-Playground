/**
 * Canonical shape for a position held in any protocol Neko integrates with —
 * the normalization target every per-protocol adapter in `normalize.ts`
 * converts its own raw hook data into, so the portfolio can be aggregated and
 * rendered without the caller knowing which protocol a position came from.
 */
export type ProtocolKind =
  | "wallet"
  | "pools"
  | "lending"
  | "borrowing"
  | "vault"
  | "backstop";

/** Whether a position adds to or subtracts from net portfolio value. */
export type PositionDirection = "asset" | "liability";

export interface UnifiedPosition {
  id: string;
  protocol: ProtocolKind;
  label: string;
  assetCode: string;
  quantity: number;
  /** null when no reliable USD price source exists (e.g. AMM LP shares). */
  valueUsd: number | null;
  direction: PositionDirection;
  apy?: number | null;
  href: string;
}

export interface ProtocolAllocation {
  protocol: ProtocolKind;
  /** Net of liabilities for that protocol (debt lowers the total). */
  valueUsd: number;
  positionCount: number;
}

export interface PortfolioSummary {
  positions: UnifiedPosition[];
  totalValueUsd: number;
  totalAssetsUsd: number;
  totalLiabilitiesUsd: number;
  /** Count of positions with quantity > 0 but no priceable value. */
  unpricedPositionCount: number;
  byProtocol: ProtocolAllocation[];
  isLoading: boolean;
  hasWallet: boolean;
}
