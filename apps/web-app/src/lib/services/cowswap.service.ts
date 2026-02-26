/**
 * CoW Swap Service
 * Handles all CoW Protocol operations including quotes, swaps, and token management
 */

import {
  SupportedChainId,
  TradingSdk,
  OrderKind,
  OrderBookApi,
  OrderQuoteSideKindSell,
  OrderSigningUtils,
} from "@cowprotocol/cow-sdk";
import { ViemAdapter } from "@cowprotocol/sdk-viem-adapter";
import { WalletClient, PublicClient } from "viem";
import { EVM_TOKENS, getTokensForChain } from "../constants/evmConfig";
import {
  CHAIN_ID_MAPPING,
  COW_EXPLORER_BASE_URL,
  NATIVE_TOKEN_ADDRESS,
  NATIVE_TOKEN_SYMBOLS,
  WRAPPED_NATIVE_TOKENS,
  DEFAULT_ADDRESS,
  QUOTE_TIMEOUT_MS,
  COW_APP_CODE,
  ETH_FLOW_CONTRACTS,
  ETH_FLOW_ABI,
} from "../constants/cowswapConfig";
import type { EVMToken } from "../types/evmToken";
import { isUserRejection } from "../helpers/isUserRejection";
import type {
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
  CowOrder,
  CowTrade,
} from "../types/cowswapTypes";

interface CowSdkTradeParameters {
  kind: OrderKind;
  sellToken: string;
  sellTokenDecimals: number;
  buyToken: string;
  buyTokenDecimals: number;
  amount: string;
  receiver: string;
  buyAmount?: string;
}

export class CowSwapService {
  private orderBookApiCache = new Map<SupportedChainId, OrderBookApi>();
  private tradingSdkCache = new Map<
    string,
    { sdk: TradingSdk; adapter: ViemAdapter }
  >();

  /**
   * Get or create cached OrderBookApi instance
   */
  private getOrderBookApi(chainId: SupportedChainId): OrderBookApi {
    let api = this.orderBookApiCache.get(chainId);
    if (!api) {
      api = new OrderBookApi({ chainId });
      this.orderBookApiCache.set(chainId, api);
    }
    return api;
  }

  /**
   * Get EVM token by symbol or address
   */
  private getEVMToken(token: EVMToken | string, chainId: number = 1): EVMToken {
    if (typeof token === "string") {
      const tokens = getTokensForChain(chainId);
      const tokenBySymbol = Object.values(tokens).find(
        (t) =>
          t.symbol === token || t.address.toLowerCase() === token.toLowerCase()
      );
      if (tokenBySymbol) return tokenBySymbol;
      // Fallback to default tokens
      const defaultToken = Object.values(EVM_TOKENS).find(
        (t) =>
          t.symbol === token || t.address.toLowerCase() === token.toLowerCase()
      );
      if (defaultToken) return defaultToken;
      throw new Error(
        `Token not found: ${token}. Please add it to EVM_TOKENS.`
      );
    }
    return token;
  }

  /**
   * Convert chain ID to CoW Protocol supported chain ID
   */
  private getChainIdMapping(chainId: number): SupportedChainId {
    const supportedChainId = CHAIN_ID_MAPPING[chainId];
    if (!supportedChainId) {
      throw new Error(`Chain ID ${chainId} is not supported by CoW Protocol`);
    }
    return supportedChainId;
  }

  /**
   * Check if a token is a native token (ETH, BNB) based on symbol
   */
  private isNativeTokenSymbol(symbol: string, chainId: number): boolean {
    const nativeSymbol = NATIVE_TOKEN_SYMBOLS[chainId];
    return symbol === nativeSymbol || symbol === "ETH" || symbol === "BNB";
  }

  /**
   * Check if address is the native token address
   */
  private isNativeTokenAddress(address: string): boolean {
    const lowerAddress = address.toLowerCase();
    return (
      lowerAddress === "0x0000000000000000000000000000000000000000" ||
      lowerAddress === NATIVE_TOKEN_ADDRESS.toLowerCase()
    );
  }

  /**
   * Normalize token address for CoW Protocol quotes
   * For quotes, we must use WETH/WBNB as the API doesn't support native token address
   */
  private normalizeTokenAddressForQuote(
    address: string,
    chainId: number = 1,
    tokenSymbol?: string
  ): string {
    // If it's a native token address or symbol, use wrapped token for quotes
    if (this.isNativeTokenAddress(address)) {
      return WRAPPED_NATIVE_TOKENS[chainId] || WRAPPED_NATIVE_TOKENS[1];
    }
    if (tokenSymbol && this.isNativeTokenSymbol(tokenSymbol, chainId)) {
      return WRAPPED_NATIVE_TOKENS[chainId] || WRAPPED_NATIVE_TOKENS[1];
    }
    return address;
  }

  /**
   * Normalize token address for CoW Protocol swap execution
   * For execution, we can try native token (ETH Flow) but fallback to wrapped
   */
  private normalizeTokenAddressForSwap(
    address: string,
    chainId: number = 1,
    tokenSymbol?: string
  ): string {
    // For now, use wrapped tokens for swap execution as well
    // ETH Flow requires special handling that may not be available in all cases
    if (this.isNativeTokenAddress(address)) {
      return WRAPPED_NATIVE_TOKENS[chainId] || WRAPPED_NATIVE_TOKENS[1];
    }
    if (tokenSymbol && this.isNativeTokenSymbol(tokenSymbol, chainId)) {
      return WRAPPED_NATIVE_TOKENS[chainId] || WRAPPED_NATIVE_TOKENS[1];
    }
    return address;
  }

  /**
   * Add timeout to a promise to prevent hanging requests
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Quote request timeout")), timeoutMs)
      ),
    ]);
  }

  /**
   * Get or create cached TradingSdk instance
   */
  private getTradingSdk(
    chainId: SupportedChainId,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): TradingSdk {
    const accountAddress = walletClient.account?.address || "";
    const cacheKey = `${chainId}-${accountAddress}`;

    let cached = this.tradingSdkCache.get(cacheKey);

    if (!cached) {
      const adapter = new ViemAdapter({
        provider: publicClient,
        walletClient,
      });

      const sdk = new TradingSdk(
        {
          chainId,
          appCode: COW_APP_CODE,
        },
        {},
        adapter
      );

      cached = { sdk, adapter };
      this.tradingSdkCache.set(cacheKey, cached);
    }

    return cached.sdk;
  }

  /**
   * Check if we should use EthFlow for this swap
   */
  private shouldUseEthFlow(tokenSymbol: string, chainId: number): boolean {
    if (!ETH_FLOW_CONTRACTS[chainId]) return false;
    return tokenSymbol === "ETH";
  }

  /**
   * Execute swap using EthFlow contract for native ETH
   */
  private async executeEthFlowSwap(
    request: CowSwapSwapRequest,
    chainId: number,
    walletClient: WalletClient,
    tokenOut: EVMToken
  ): Promise<CowSwapSwapResponse> {
    const ethFlowAddress = ETH_FLOW_CONTRACTS[chainId] as `0x${string}`;

    // Calculate validTo (30 minutes from now)
    const validTo = Math.floor(Date.now() / 1000) + 30 * 60;

    // Calculate minimum buy amount with 2% slippage for automatic refund eligibility
    const sellAmountBigInt = BigInt(request.amountIn);
    // We use the quote's buyAmount as the minimum (already includes slippage from quote)
    const buyAmount = request.amountOutMinimum || "0";

    // App data hash (can be customized for tracking)
    const appDataHash =
      "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

    const orderData = {
      buyToken: tokenOut.address as `0x${string}`,
      receiver: request.recipient as `0x${string}`,
      sellAmount: sellAmountBigInt,
      buyAmount: BigInt(buyAmount),
      appData: appDataHash,
      feeAmount: BigInt(0),
      validTo,
      partiallyFillable: false,
      quoteId: BigInt(-1),
    };

    try {
      const hash = await walletClient.writeContract({
        address: ethFlowAddress,
        abi: ETH_FLOW_ABI,
        functionName: "createOrder",
        args: [orderData],
        value: sellAmountBigInt,
        chain: walletClient.chain,
        account: walletClient.account!,
      });

      return {
        orderId: hash,
      };
    } catch (error) {
      if (this.isUserRejectionError(error)) {
        throw new Error("USER_REJECTED");
      }
      throw error;
    }
  }

  private isUserRejectionError(error: unknown): boolean {
    return isUserRejection(error);
  }

  /**
   * Get quote for token swap
   */
  async getQuote(
    request: CowSwapQuoteRequest,
    chainId: number,
    _publicClient: PublicClient,
    walletClient?: WalletClient
  ): Promise<CowSwapQuoteResponse> {
    const tokenIn = this.getEVMToken(request.tokenIn, chainId);
    const tokenOut = this.getEVMToken(request.tokenOut, chainId);
    const supportedChainId = this.getChainIdMapping(chainId);
    const orderBookApi = this.getOrderBookApi(supportedChainId);
    const userAddress = walletClient?.account?.address || DEFAULT_ADDRESS;

    const quote = await this.withTimeout(
      orderBookApi.getQuote({
        sellToken: this.normalizeTokenAddressForQuote(
          tokenIn.address,
          chainId,
          tokenIn.symbol
        ),
        buyToken: this.normalizeTokenAddressForQuote(
          tokenOut.address,
          chainId,
          tokenOut.symbol
        ),
        from: userAddress,
        receiver: userAddress,
        sellAmountBeforeFee: request.amountIn,
        kind: OrderQuoteSideKindSell.SELL,
      }),
      QUOTE_TIMEOUT_MS
    );

    const buyAmount = quote.quote?.buyAmount || "0";

    return {
      amountOut: buyAmount,
      amountOutMinimum: buyAmount,
    };
  }

  /**
   * Get CoW Protocol explorer URL for order tracking
   */
  getExplorerUrl(orderId: string, _chainId: number): string {
    return `${COW_EXPLORER_BASE_URL}/${orderId}`;
  }

  /**
   * Execute token swap
   */
  async executeSwap(
    request: CowSwapSwapRequest,
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<CowSwapSwapResponse> {
    const tokenIn = this.getEVMToken(request.tokenIn, chainId);
    const tokenOut = this.getEVMToken(request.tokenOut, chainId);

    // Check if we should use EthFlow for native ETH
    if (this.shouldUseEthFlow(tokenIn.symbol || "", chainId)) {
      return this.executeEthFlowSwap(request, chainId, walletClient, tokenOut);
    }

    // Standard CoW Protocol swap for ERC-20 tokens
    const supportedChainId = this.getChainIdMapping(chainId);
    const sdk = this.getTradingSdk(
      supportedChainId,
      publicClient,
      walletClient
    );

    const parameters: CowSdkTradeParameters = {
      kind: OrderKind.SELL,
      sellToken: this.normalizeTokenAddressForSwap(
        tokenIn.address,
        chainId,
        tokenIn.symbol
      ),
      sellTokenDecimals: tokenIn.decimals,
      buyToken: this.normalizeTokenAddressForSwap(
        tokenOut.address,
        chainId,
        tokenOut.symbol
      ),
      buyTokenDecimals: tokenOut.decimals,
      amount: request.amountIn,
      receiver: request.recipient,
    };

    try {
      const { postSwapOrderFromQuote } = await sdk.getQuote(parameters);
      const orderResult = await postSwapOrderFromQuote();

      return {
        orderId: orderResult.orderId || "",
      };
    } catch (error) {
      if (this.isUserRejectionError(error)) {
        throw new Error("USER_REJECTED");
      }
      throw error;
    }
  }

  /**
   * Cancel an order using CoW Protocol API
   */
  /**
   * Submit order cancellation request to CoW Protocol
   */
  private async submitOrderCancellation(
    orderUids: string[],
    signature: string,
    chainId: number
  ): Promise<boolean> {
    // Use absolute URL for API calls from client-side
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const cancelResponse = await fetch(`${baseUrl}/api/cow/get-orders`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderUids,
        signature,
        signingScheme: "eip712",
        chainId,
      }),
    });

    return cancelResponse.ok;
  }

  /**
   * Cancel an order - handles both on-chain and off-chain cancellation
   */
  async cancelOrder(
    request: CowSwapCancelOrderRequest,
    chainId: number,
    walletClient: WalletClient
  ): Promise<CowSwapCancelOrderResponse> {
    try {
      if (request.onChain) {
        // On-chain cancellation - requires sending a transaction
        // This would require implementing on-chain cancellation logic
        return {
          success: false,
          message: "On-chain cancellation not yet implemented",
        };
      }

      // Off-chain cancellation using API
      const orderUids = [request.orderId];
      const signature = await this.signOrderCancellation(
        orderUids,
        chainId,
        walletClient
      );

      if (!signature) {
        return {
          success: false,
          message: "Failed to sign cancellation message",
        };
      }

      const success = await this.submitOrderCancellation(
        orderUids,
        signature,
        chainId
      );

      return {
        success,
        message: success
          ? "Cancellation request submitted"
          : "Cancellation failed",
      };
    } catch (error) {
      console.error("Error canceling order:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Sign order cancellation message using EIP-712
   */
  private async signOrderCancellation(
    orderUids: string[],
    chainId: number,
    walletClient: WalletClient
  ): Promise<string | null> {
    try {
      // EIP-712 domain
      const domain = {
        name: "Gnosis Protocol",
        version: "v2",
        chainId,
        verifyingContract:
          "0x9008D19f58AAbD9eD0D60971565AA8510560ab41" as `0x${string}`, // GPv2Settlement contract
      };

      // EIP-712 types for OrderCancellations
      const types = {
        OrderCancellations: [{ name: "orderUids", type: "bytes[]" }],
      };

      // Message to sign
      const message = {
        orderUids,
      };

      // Sign using wallet client
      const signature = await walletClient.signTypedData({
        account: walletClient.account!,
        domain,
        types,
        primaryType: "OrderCancellations",
        message,
      });

      return signature;
    } catch (error) {
      console.error("Error signing cancellation:", error);
      return null;
    }
  }

  /**
   * Check if error indicates user rejection
   */
  isUserRejected(error: unknown): boolean {
    return this.isUserRejectionError(error);
  }

  /**
   * Calculate traffic light status based on order parameters
   */
  calculateOrderStatus(
    order: CowOrder,
    _limitPrice: number
  ): "far" | "close" | "executable" | "executing" {
    try {
      const executedSell = BigInt(order.executedSellAmount || "0");
      const totalSell = BigInt(order.sellAmount);

      if (totalSell === 0n) return "far";

      const executionRatio = Number(executedSell) / Number(totalSell);

      if (executionRatio > 0) {
        return "executing";
      }

      const now = Date.now() / 1000;
      const timeRemaining = order.validTo - now;
      const totalDuration =
        order.validTo - new Date(order.creationDate).getTime() / 1000;

      if (totalDuration <= 0) return "far";

      const timeRatio = timeRemaining / totalDuration;

      if (timeRatio < 0.2) {
        return "executable";
      } else if (timeRatio < 0.5) {
        return "close";
      } else {
        return "far";
      }
    } catch (error) {
      console.error("Error calculating order status:", error);
      return "far";
    }
  }

  /**
   * Process raw orders into internal format with business logic
   */
  processOrders(
    rawOrders: CowOrder[],
    _chainId: number
  ): CowSwapOrderWithPrice[] {
    const processedOrders: CowSwapOrderWithPrice[] = [];

    for (const order of rawOrders) {
      if (order.status === "open") {
        const sellAmount = BigInt(order.sellAmount);
        const buyAmount = BigInt(order.buyAmount);
        const limitPrice =
          sellAmount > 0n ? Number(buyAmount) / Number(sellAmount) : 0;

        const progressStatus = this.calculateOrderStatus(order, limitPrice);
        const explorerUrl = `https://explorer.cow.fi/orders/${order.uid}`;

        processedOrders.push({
          orderId: order.uid,
          owner: order.owner,
          sellToken: order.sellToken,
          buyToken: order.buyToken,
          sellAmount: order.sellAmount,
          buyAmount: order.buyAmount,
          executedSellAmount: order.executedSellAmount || "0",
          executedBuyAmount: order.executedBuyAmount || "0",
          executedFeeAmount: order.executedFeeAmount || "0",
          status: order.status,
          creationDate: order.creationDate,
          validTo: order.validTo,
          receiver: order.receiver,
          appData: order.appData,
          kind: order.kind,
          partiallyFillable: order.partiallyFillable,
          explorerUrl,
          limitPrice: limitPrice.toString(),
          executionPrice: limitPrice.toString(),
          progressStatus,
        });
      }
    }

    return processedOrders;
  }

  /**
   * Create a limit order using CoW Protocol
   * Note: CoW Protocol handles limit orders differently than traditional exchanges.
   * Limit orders in CoW Protocol are executed when solvers find matching opportunities.
   */
  async createLimitOrder(
    request: CowSwapLimitOrderRequest,
    chainId: number,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<CowSwapLimitOrderResponse> {
    const tokenIn = this.getEVMToken(request.tokenIn, chainId);
    const tokenOut = this.getEVMToken(request.tokenOut, chainId);
    const supportedChainId = this.getChainIdMapping(chainId);
    const sdk = this.getTradingSdk(
      supportedChainId,
      publicClient,
      walletClient
    );

    // Calculate buy amount based on limit price
    const sellAmount = BigInt(request.amountIn);
    const limitPrice = parseFloat(request.limitPrice);

    // Calculate the minimum buy amount based on limit price
    // This represents the minimum amount the user wants to receive
    const buyAmountMin =
      (sellAmount * BigInt(Math.floor(limitPrice * 1e6))) / BigInt(1e6);

    const parameters: CowSdkTradeParameters = {
      kind: OrderKind.SELL,
      sellToken: this.normalizeTokenAddressForSwap(
        tokenIn.address,
        chainId,
        tokenIn.symbol
      ),
      sellTokenDecimals: tokenIn.decimals,
      buyToken: this.normalizeTokenAddressForSwap(
        tokenOut.address,
        chainId,
        tokenOut.symbol
      ),
      buyTokenDecimals: tokenOut.decimals,
      amount: request.amountIn,
      receiver: request.recipient,
      // For limit orders, we set the buy amount to our limit price target
      buyAmount: buyAmountMin.toString(),
    };

    try {
      // Get quote and create order - CoW Protocol will handle the limit order logic
      const { postSwapOrderFromQuote } = await sdk.getQuote(parameters);
      const orderResult = await postSwapOrderFromQuote();

      return {
        orderId: orderResult.orderId || "",
        explorerUrl: this.getExplorerUrl(orderResult.orderId || "", chainId),
      };
    } catch (error) {
      if (this.isUserRejectionError(error)) {
        throw new Error("USER_REJECTED");
      }
      throw error;
    }
  }

  /**
   * Create a TWAP (Time-Weighted Average Price) order
   * Note: TWAP orders are not yet available in CoW Protocol SDK
   */
  async createTwapOrder(
    request: CowSwapTwapOrderRequest,
    chainId: number,
    _publicClient: PublicClient,
    _walletClient: WalletClient
  ): Promise<CowSwapTwapOrderResponse> {
    // TWAP orders are not yet available in CoW Protocol SDK
    throw new Error(
      "TWAP orders are currently not supported. Please use Swap or Limit orders instead."
    );
  }
}

// Export singleton instance
export const cowSwapService = new CowSwapService();
