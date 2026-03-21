import { useCallback } from "react";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import {
  getQuote,
  buildTransaction,
  sendTransaction,
  type QuoteRequest,
} from "@/lib/helpers/stellar/soroswap";
import {
  DEFAULT_SLIPPAGE_BPS,
  MAX_HOPS,
} from "@/features/swap/constants/swapConfig";
import { useWallet } from "@/hooks/useWallet";

export interface SwapExecutionParams {
  amountIn: string;
  tokenIn: Token | string;
  tokenOut: Token | string;
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
      const { amountIn, tokenIn, tokenOut, address } = params;

      if (!amountIn || parseFloat(amountIn) <= 0 || !address) {
        throw new Error("Invalid amount or address");
      }

      if (!networkPassphrase) {
        throw new Error("Wallet not connected");
      }

      const quoteRequest: QuoteRequest = {
        assetIn: tokenIn as Token | string,
        assetOut: tokenOut as Token | string,
        amount: amountIn,
        tradeType: "EXACT_IN",
        protocols: ["soroswap", "phoenix", "aqua"],
        slippageBps: DEFAULT_SLIPPAGE_BPS,
        maxHops: MAX_HOPS,
      };

      const newQuote = await getQuote(quoteRequest);

      if (!newQuote) {
        throw new Error("Failed to get quote for swap");
      }

      const buildResult = await buildTransaction({
        quote: newQuote,
        from: address,
        to: address,
      });

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

      const sendResult = await sendTransaction({
        xdr: signedXdrString,
        launchtube: false,
      });

      if (sendResult.txHash) {
        return { orderId: sendResult.txHash, txHash: sendResult.txHash };
      }

      throw new Error("Transaction failed");
    },
    [signTransaction, networkPassphrase]
  );

  return { executeSwap };
}
