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
  risks: string[];
}

export interface VaultData {
  id: string;
  name: string;
  description: string;
  category: VaultCategory;
  status: VaultStatus;
  supplyAsset: VaultAsset;
  createdBy: string;
  creatorIconSrc?: string;
  tvl: string;
  apy7d: string;
  totalSupply: string;
  utilization: string;
  collateralAssets: VaultAsset[];
  riskLevel: "low" | "medium" | "high";
  minDeposit: string;
  featured?: boolean;
  variant?: VaultCardVariant;
  detail?: VaultDetail;
}
