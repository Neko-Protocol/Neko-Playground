export type VaultCategory = "lending" | "amm" | "staking" | "rwa";

export type VaultCardVariant = "light" | "dark";

export type VaultStatus = "active" | "paused" | "deprecated";

export interface VaultAsset {
  symbol: string;
  name: string;
  iconSrc: string;
  iconWhiteSrc?: string;
  logoSrc: string;
  network: "Stellar";
}

export interface VaultStrategy {
  protocol: string;
  description: string;
}

export interface VaultContracts {
  vault: string;
  pools: Record<string, string>;
  strategies: Record<string, string>;
}

export interface VaultDetail {
  description: string;
  strategies: VaultStrategy[];
  contracts: VaultContracts;
  liquidity: string;
}

/** Static metadata — defined by the protocol, never changes at runtime. */
export interface VaultConfig {
  id: string;
  name: string;
  description: string;
  category: VaultCategory;
  status: VaultStatus;
  supplyAsset: VaultAsset;
  collateralAssets: VaultAsset[];
  createdBy: string;
  creatorIconSrc?: string;
  variant?: VaultCardVariant;
  featured?: boolean;
  detail?: VaultDetail;
}

/** Dynamic data — fetched from contracts at runtime. */
export interface VaultStats {
  tvl: string;
  apy7d: string;
  utilization: string;
  totalSupply: string;
}

/** View model consumed by UI components: static config merged with live stats. */
export type VaultView = VaultConfig & VaultStats;
