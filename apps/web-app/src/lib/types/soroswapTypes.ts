export interface Token {
  type: "native" | "contract";
  code?: string;
  issuer?: string;
  contract?: string;
}

export interface QuoteRequest {
  assetIn: Token | string;
  assetOut: Token | string;
  amount: string;
  tradeType: "EXACT_IN" | "EXACT_OUT";
  protocols?: string[];
  slippageBps?: number;
  maxHops?: number; // Max intermediate hops for routing (default: 3)
}

export interface QuoteResponse {
  amountOut: string;
  amountIn: string;
  routes?: unknown[];
  priceImpact?: string;
  protocol?: string;
  _sdkQuote?: unknown; // Store full SDK response for build()
}

export interface BuildRequest {
  quote: QuoteResponse;
  from: string;
  to?: string;
}

export interface BuildResponse {
  xdr: string;
}

export interface SendRequest {
  xdr: string;
  launchtube?: boolean;
}

export interface SendResponse {
  txHash: string;
}

export interface AddLiquidityRequest {
  assetA: Token | string;
  assetB: Token | string;
  amountA: string;
  amountB: string;
  to: string;
  slippageBps?: number;
}

export interface AddLiquidityResponse {
  xdr: string;
}

export interface PoolInfo {
  protocol: string;
  address: string;
  tokenA: string;
  tokenB: string;
  reserveA: string;
  reserveB: string;
  ledger: number;
}

export interface GetPoolRequest {
  tokenA: Token | string;
  tokenB: Token | string;
  protocols?: string[];
}
