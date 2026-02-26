import { useRef, useCallback } from "react";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import { getQuote, type QuoteRequest } from "@/lib/helpers/stellar/soroswap";
import { type EVMToken } from "@/lib/types/evmToken";
import {
  formatSwapAmount,
  fromSmallestUnit,
} from "@/lib/helpers/stellar/swapUtils";
import {
  DEFAULT_SLIPPAGE_BPS,
  MAX_HOPS,
} from "@/features/swap/constants/swapConfig";

/**
 * Fetches a Soroswap quote for a Stellar swap.
 * Manages its own AbortController to cancel in-flight requests.
 * Returns `null` when a quote cannot be obtained.
 */
export function useStellarQuote(
  amountIn: string,
  tokenIn: Token | string | EVMToken,
  tokenOut: Token | string | EVMToken,
  apiKeyConfigured: boolean
): {
  fetchStellarQuote: () => Promise<string | null>;
  cancelStellarQuote: () => void;
} {
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelStellarQuote = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const fetchStellarQuote = useCallback(async (): Promise<string | null> => {
    const trimmedAmount = amountIn?.trim() || "";
    const parsedAmount = parseFloat(trimmedAmount);

    if (!trimmedAmount || isNaN(parsedAmount) || parsedAmount <= 0) return null;
    if (!apiKeyConfigured) return null;

    cancelStellarQuote();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const quoteRequest: QuoteRequest = {
        assetIn: tokenIn as Token | string,
        assetOut: tokenOut as Token | string,
        amount: trimmedAmount,
        tradeType: "EXACT_IN",
        protocols: ["soroswap"],
        slippageBps: DEFAULT_SLIPPAGE_BPS,
        maxHops: MAX_HOPS,
      };

      const quote = await getQuote(quoteRequest);

      if (abortController.signal.aborted) return null;

      if (quote?.amountOut) {
        const amountOutStr = quote.amountOut.toString();
        const amountOutBigInt = BigInt(amountOutStr);
        if (amountOutBigInt > BigInt(0)) {
          return formatSwapAmount(fromSmallestUnit(amountOutStr, 7), 6);
        }
      }

      return null;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return null;

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorWithCode = error as { code?: string } | null;
      const isTimeout =
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNABORTED") ||
        errorWithCode?.code === "ECONNABORTED";

      if (isTimeout) return null;
      return null;
    }
  }, [amountIn, tokenIn, tokenOut, apiKeyConfigured, cancelStellarQuote]);

  return { fetchStellarQuote, cancelStellarQuote };
}
