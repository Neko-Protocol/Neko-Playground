export type KycLevel = "basic" | "accredited" | "institutional";

export type OracleAsset =
  | { kind: "stellar"; address: string }
  | { kind: "other"; symbol: string };

export type PricingMode =
  | { type: "fixed"; priceXlm: number }
  | {
      type: "oracle";
      /** SEP-40 oracle contract address (Reflector or compatible). */
      oracleContract: string;
      method: "lastprice" | "cross";
      base: OracleAsset;
      /** Required when `method === "cross"`. */
      quote?: OracleAsset;
      /** Basis points; +500 = +5%, -300 = -3% discount. */
      premiumBps: number;
      maxStalenessSecs: number;
    };

export interface ListedAsset {
  id: string;
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  pricing: PricingMode;
  /** Amount listed (human units, pre-scaled) */
  listedAmount: string;
  listedAt: number;
  issuerAddress: string;
  listTx: string;
  /** Trustless Work display id (engagement). */
  escrowId: string;
  /** TW custodial address (mock mode = Neko admin pubkey). */
  escrowAddress: string;
}

export interface KycEntry {
  kycLevel: KycLevel;
  country: string;
  approvedAt: number;
}
