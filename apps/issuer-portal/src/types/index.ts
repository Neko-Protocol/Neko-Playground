export type KycLevel = "basic" | "accredited" | "institutional";

export interface ListedAsset {
  id: string;
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  /** Price per token in XLM (human, not stroops) */
  priceXlm: number;
  /** Amount deposited into the distributor (human units, pre-scaled) */
  listedAmount: string;
  listedAt: number;
  issuerAddress: string;
  listTx: string;
}

export interface KycEntry {
  kycLevel: KycLevel;
  country: string;
  approvedAt: number;
}
