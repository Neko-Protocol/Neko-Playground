import type { EVMToken } from "./evmToken";

export interface CowSwapQuoteRequest {
  tokenIn: EVMToken | string;
  tokenOut: EVMToken | string;
  amountIn: string;
}

export interface CowSwapQuoteResponse {
  amountOut: string;
  amountOutMinimum: string;
  orderId?: string;
}

export interface CowSwapSwapRequest {
  tokenIn: EVMToken | string;
  tokenOut: EVMToken | string;
  amountIn: string;
  amountOutMinimum: string;
  recipient: string;
}

export interface CowSwapSwapResponse {
  orderId: string;
}

// Limit Order Types
export interface CowSwapLimitOrderRequest {
  tokenIn: EVMToken | string;
  tokenOut: EVMToken | string;
  amountIn: string;
  limitPrice: string; // Price in terms of tokenOut per tokenIn
  recipient: string;
  deadline?: number;
}

export interface CowSwapLimitOrderResponse {
  orderId: string;
  explorerUrl: string;
}

// TWAP Order Types
export interface CowSwapTwapOrderRequest {
  tokenIn: EVMToken | string;
  tokenOut: EVMToken | string;
  amountIn: string;
  totalParts: number; // Number of parts to split the order into
  partFrequency: number; // Frequency in seconds between parts
  span: number; // Total time span in seconds
  recipient: string;
  deadline?: number;
}

export interface CowSwapTwapOrderResponse {
  orderId: string;
  explorerUrl: string;
  totalParts: number;
  partFrequency: number;
}

// Internal API response types (used by services)
export interface CowOrder {
  creationDate: string;
  owner: string;
  uid: string;
  availableBalance?: string;
  executedBuyAmount: string;
  executedSellAmount: string;
  executedFeeAmount: string;
  invalidated: boolean;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  appData: string;
  feeAmount: string;
  kind: "sell" | "buy";
  partiallyFillable: boolean;
  signature: string;
  receiver: string;
  status: "open" | "fulfilled" | "cancelled" | "expired";
}

export interface CowTrade {
  blockNumber: number;
  logIndex: number;
  orderUid: string;
  owner: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  sellAmountBeforeFees: string;
  txHash: string;
}

// Order Management Types
export interface CowSwapOrder {
  orderId: string;
  owner: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  executedSellAmount: string;
  executedBuyAmount: string;
  executedFeeAmount: string;
  status: "open" | "filled" | "cancelled" | "expired";
  creationDate: string;
  validTo: number;
  receiver: string;
  appData: string;
  kind: "sell" | "buy";
  partiallyFillable: boolean;
  explorerUrl: string;
}

export interface CowSwapOrderWithPrice extends CowSwapOrder {
  limitPrice: string;
  executionPrice?: string;
  marketPrice?: string;
  progressStatus: "far" | "close" | "executable" | "executing";
}

export interface CowSwapCancelOrderRequest {
  orderId: string;
  onChain?: boolean; // false = off-chain (default), true = on-chain
}

export interface CowSwapCancelOrderResponse {
  success: boolean;
  transactionHash?: string;
  message?: string;
}

export interface CowSwapOrderHistoryRequest {
  owner: string;
  offset?: number;
  limit?: number;
}

export interface CowSwapOrderHistoryResponse {
  orders: CowSwapOrder[];
  hasMore: boolean;
}

// API Route Response Types
export interface CowOrdersResponse {
  orders: CowOrder[];
  meta?: {
    total: number;
    hasMore: boolean;
  };
}

export interface CowTradesResponse {
  trades: CowTrade[];
  meta?: {
    total: number;
    hasMore: boolean;
  };
}

export interface CowOrderStatus {
  uid: string;
  status: "open" | "fulfilled" | "cancelled" | "expired";
  creationDate: string;
  owner: string;
  executedBuyAmount: string;
  executedSellAmount: string;
  executedFeeAmount: string;
}
