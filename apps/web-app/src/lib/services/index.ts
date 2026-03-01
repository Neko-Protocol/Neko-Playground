/**
 * Services Index
 * Centralized exports for all service classes
 */

// CoW Swap Service
export { cowSwapService } from "./cowswap.service";
export type {
  CowSwapQuoteRequest,
  CowSwapQuoteResponse,
  CowSwapSwapRequest,
  CowSwapSwapResponse,
  CowSwapLimitOrderRequest,
  CowSwapLimitOrderResponse,
  CowSwapTwapOrderRequest,
  CowSwapTwapOrderResponse,
  CowSwapOrder,
  CowSwapOrderWithPrice,
  CowSwapCancelOrderRequest,
  CowSwapCancelOrderResponse,
  CowSwapOrderHistoryRequest,
  CowSwapOrderHistoryResponse,
} from "../types/cowswapTypes";

// Lending Service
export { lendingService } from "./lending.service";
export type {
  LendingOperationResult,
  CollateralOperationResult,
  BorrowWithCollateralResult,
  DepositWithApproveResult,
} from "../types/lendingTypes";

// Price Service
export { priceService } from "./price.service";
export type { TokenPriceResult, PriceFetchOptions } from "../types/priceTypes";

// Stellar Price Service
export { stellarPriceService } from "./stellar-price.service";

// Token Service
export { tokenService } from "./token.service";
export type { TokenBalanceResult, TokenInfo } from "../types/tokenTypes";
