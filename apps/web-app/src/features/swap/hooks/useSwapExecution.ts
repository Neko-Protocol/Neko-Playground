import { useCallback } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { parseUnits } from "viem";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import type { EVMToken } from "@/lib/types/evmToken";
import {
  getQuote,
  buildTransaction,
  sendTransaction,
  type QuoteRequest,
} from "@/lib/helpers/stellar/soroswap";
import {
  getCowSwapQuote,
  executeCowSwap,
  createCowSwapLimitOrder,
  type CowSwapQuoteRequest,
  type CowSwapSwapRequest,
  type CowSwapLimitOrderRequest,
} from "@/lib/helpers/evm/cowswap";
import { getTokensForChain } from "@/lib/constants/evmConfig";
import { getEvmTokenSymbol } from "@/lib/helpers/stellar/tokenUtils";
import { useWallet } from "@/hooks/useWallet";
import { isUserRejection } from "@/lib/helpers/isUserRejection";

export interface SwapExecutionParams {
  swapMode: "evm" | "stellar";
  orderType: "swap" | "limit" | "twap";
  amountIn: string;
  tokenIn: Token | string | EVMToken;
  tokenOut: Token | string | EVMToken;
  limitPrice?: string;
  twapParts?: string;
  twapFrequency?: string;
  address: string | undefined;
  evmAddress: string | undefined;
  selectedEvmChainId: number;
  networkPassphrase: string | undefined;
}

export interface SwapExecutionResult {
  orderId: string;
  txHash?: string;
}

export function useSwapExecution() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { signTransaction, networkPassphrase } = useWallet();

  const executeSwap = useCallback(
    async (params: SwapExecutionParams): Promise<SwapExecutionResult> => {
      const {
        swapMode,
        orderType,
        amountIn,
        tokenIn,
        tokenOut,
        limitPrice,
        address,
        evmAddress,
        selectedEvmChainId,
      } = params;

      if (!amountIn || parseFloat(amountIn) <= 0 || !address) {
        throw new Error("Invalid amount or address");
      }

      // Validate order-specific parameters
      if (
        orderType === "limit" &&
        (!limitPrice || parseFloat(limitPrice) <= 0)
      ) {
        throw new Error("Please enter a valid limit price");
      }

      // EVM swap flow (CoW Swap)
      if (
        swapMode === "evm" &&
        walletClient &&
        publicClient &&
        selectedEvmChainId &&
        evmAddress
      ) {
        const EVM_TOKENS = getTokensForChain(selectedEvmChainId);

        const tokenInSymbol = getEvmTokenSymbol(tokenIn, "ETH");
        const tokenOutSymbol = getEvmTokenSymbol(tokenOut, "USDC");

        const tokenInObj = EVM_TOKENS[tokenInSymbol];
        if (!tokenInObj) {
          throw new Error("Token not found");
        }

        const amountInWei = parseUnits(
          amountIn,
          tokenInObj.decimals
        ).toString();

        const quoteRequest: CowSwapQuoteRequest = {
          tokenIn: tokenInSymbol,
          tokenOut: tokenOutSymbol,
          amountIn: amountInWei,
        };

        let quote;
        try {
          quote = await getCowSwapQuote(
            quoteRequest,
            selectedEvmChainId,
            publicClient,
            walletClient
          );
        } catch (quoteError) {
          const errorMessage =
            quoteError instanceof Error
              ? quoteError.message
              : String(quoteError);
          throw new Error(errorMessage);
        }

        let orderId: string;

        if (orderType === "swap") {
          const swapRequest: CowSwapSwapRequest = {
            tokenIn: tokenInSymbol,
            tokenOut: tokenOutSymbol,
            amountIn: amountInWei,
            amountOutMinimum: quote.amountOutMinimum,
            recipient: evmAddress,
          };

          const swapResult = await executeCowSwap(
            swapRequest,
            selectedEvmChainId,
            publicClient,
            walletClient
          );
          orderId = swapResult.orderId;
        } else if (orderType === "limit") {
          if (!limitPrice || parseFloat(limitPrice) <= 0) {
            throw new Error("Please enter a valid limit price");
          }

          const limitOrderRequest: CowSwapLimitOrderRequest = {
            tokenIn: tokenInSymbol,
            tokenOut: tokenOutSymbol,
            amountIn: amountInWei,
            limitPrice,
            recipient: evmAddress,
          };

          const limitResult = await createCowSwapLimitOrder(
            limitOrderRequest,
            selectedEvmChainId,
            publicClient,
            walletClient
          );
          orderId = limitResult.orderId;
        } else if (orderType === "twap") {
          throw new Error("TWAP orders are not yet available");
        } else {
          throw new Error("Unsupported order type");
        }

        return { orderId };
      }

      // Stellar swap flow
      if (swapMode === "stellar" && networkPassphrase) {
        const quoteRequest: QuoteRequest = {
          assetIn: tokenIn as Token | string,
          assetOut: tokenOut as Token | string,
          amount: amountIn,
          tradeType: "EXACT_IN",
        };

        const newQuote = await getQuote(quoteRequest);

        if (!newQuote) {
          throw new Error("Failed to get quote for swap");
        }

        const buildRequest = {
          quote: newQuote,
          from: address,
          to: address,
        };

        const buildResult = await buildTransaction(buildRequest);

        let signedResult;
        try {
          signedResult = await signTransaction(buildResult.xdr, {
            networkPassphrase: networkPassphrase,
            address: address,
          });
        } catch (error) {
          if (isUserRejection(error)) throw new Error("USER_REJECTED");
          throw error;
        }

        const signedXdrString =
          signedResult.signedTxXdr ||
          (typeof signedResult === "string"
            ? signedResult
            : JSON.stringify(signedResult));

        const sendRequest = {
          xdr: signedXdrString,
          launchtube: false,
        };

        const sendResult = await sendTransaction(sendRequest);

        if (sendResult.txHash) {
          return { orderId: sendResult.txHash, txHash: sendResult.txHash };
        }

        throw new Error("Transaction failed");
      }

      throw new Error("Wallet not connected or invalid swap mode");
    },
    [publicClient, walletClient, signTransaction, networkPassphrase]
  );

  return { executeSwap };
}
