import { useCallback } from "react";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import {
  getQuote,
  buildTransaction,
  sendTransaction,
  type QuoteRequest,
} from "@/lib/helpers/stellar/soroswap";
import { useWallet } from "@/hooks/useWallet";

export interface SwapExecutionParams {
  orderType: "swap" | "limit" | "twap";
  amountIn: string;
  tokenIn: Token | string;
  tokenOut: Token | string;
  limitPrice?: string;
  twapParts?: string;
  twapFrequency?: string;
  address: string | undefined;
  networkPassphrase: string | undefined;
}

export interface SwapExecutionResult {
  orderId: string;
  txHash?: string;
}

export function useSwapExecution() {
  const { signTransaction, networkPassphrase } = useWallet();

  const executeSwap = useCallback(
    async (params: SwapExecutionParams): Promise<SwapExecutionResult> => {
      const { orderType, amountIn, tokenIn, tokenOut, limitPrice, address } =
        params;

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

      if (!networkPassphrase) {
        throw new Error("Wallet not connected");
      }

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
        if (
          error instanceof Error &&
          (error.message?.includes("rejected") ||
            error.message?.includes("denied") ||
            error.message?.includes("User rejected"))
        ) {
          throw new Error("USER_REJECTED");
        }
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
    },
    [signTransaction, networkPassphrase]
  );

  return { executeSwap };
}
