import type { PublicClient, WalletClient } from "viem";
import { cowSwapService } from "../../services";
import type {
  CowSwapQuoteRequest,
  CowSwapQuoteResponse,
  CowSwapSwapRequest,
  CowSwapSwapResponse,
  CowSwapLimitOrderRequest,
  CowSwapLimitOrderResponse,
  CowSwapTwapOrderRequest,
  CowSwapTwapOrderResponse,
  CowSwapOrderWithPrice,
  CowSwapCancelOrderRequest,
  CowSwapCancelOrderResponse,
  CowSwapOrderHistoryRequest,
  CowSwapOrderHistoryResponse,
} from "../../types/cowswapTypes";

export { EVM_TOKENS } from "../../constants/evmConfig";
export type {
  CowSwapQuoteRequest,
  CowSwapQuoteResponse,
  CowSwapSwapRequest,
  CowSwapSwapResponse,
  CowSwapLimitOrderRequest,
  CowSwapLimitOrderResponse,
  CowSwapTwapOrderRequest,
  CowSwapTwapOrderResponse,
  CowSwapOrderWithPrice,
  CowSwapCancelOrderRequest,
  CowSwapCancelOrderResponse,
  CowSwapOrderHistoryRequest,
  CowSwapOrderHistoryResponse,
} from "../../types/cowswapTypes";

/**
 * Get CoW Swap quote using the service
 */
export const getCowSwapQuote = async (
  request: CowSwapQuoteRequest,
  chainId: number,
  publicClient: PublicClient,
  walletClient?: WalletClient
): Promise<CowSwapQuoteResponse> => {
  return cowSwapService.getQuote(request, chainId, publicClient, walletClient);
};

/**
 * Get CoW Swap explorer URL using the service
 */
export const getCowSwapExplorerUrl = (
  orderId: string,
  chainId: number
): string => {
  return cowSwapService.getExplorerUrl(orderId, chainId);
};

/**
 * Execute CoW Swap using the service
 */
export const executeCowSwap = async (
  request: CowSwapSwapRequest,
  chainId: number,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<CowSwapSwapResponse> => {
  return cowSwapService.executeSwap(
    request,
    chainId,
    publicClient,
    walletClient
  );
};

/**
 * Check if error is user rejection using the service
 */
export const isUserRejectionError = (error: unknown): boolean => {
  return cowSwapService.isUserRejected(error);
};

/**
 * Create a limit order using the service
 */
export const createCowSwapLimitOrder = async (
  request: CowSwapLimitOrderRequest,
  chainId: number,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<CowSwapLimitOrderResponse> => {
  return cowSwapService.createLimitOrder(
    request,
    chainId,
    publicClient,
    walletClient
  );
};

/**
 * Create a TWAP order using the service
 */
export const createCowSwapTwapOrder = async (
  request: CowSwapTwapOrderRequest,
  chainId: number,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<CowSwapTwapOrderResponse> => {
  return cowSwapService.createTwapOrder(
    request,
    chainId,
    publicClient,
    walletClient
  );
};

/**
 * Get open orders for a user
 */
export const getCowSwapOpenOrders = async (
  owner: string,
  chainId: number
): Promise<CowSwapOrderWithPrice[]> => {
  try {
    // Call API route directly
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const apiUrl = `${baseUrl}/api/cow/get-orders?owner=${owner}&chainId=${chainId}&limit=100`;

    console.log("Fetching orders via Next.js proxy:", apiUrl); // Debug log

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch orders via proxy: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data = await response.json();
    return data.orders || [];
  } catch (error) {
    console.error("Error getting open orders:", error);
    return [];
  }
};

/**
 * Cancel an order
 */
export const cancelCowSwapOrder = async (
  request: CowSwapCancelOrderRequest,
  chainId: number,
  walletClient: WalletClient
): Promise<CowSwapCancelOrderResponse> => {
  return cowSwapService.cancelOrder(request, chainId, walletClient);
};

/**
 * Get order history for a user
 */
export const getCowSwapOrderHistory = async (
  request: CowSwapOrderHistoryRequest,
  chainId: number
): Promise<CowSwapOrderHistoryResponse> => {
  try {
    const limit = request.limit || 50;
    const offset = request.offset || 0;

    // Call API route directly
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(
      `${baseUrl}/api/cow/trades?owner=${request.owner}&chainId=${chainId}&offset=${offset}&limit=${limit}`
    );

    if (!response.ok) {
      console.error("Failed to fetch order history");
      return { orders: [], hasMore: false };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error getting order history:", error);
    return {
      orders: [],
      hasMore: false,
    };
  }
};
