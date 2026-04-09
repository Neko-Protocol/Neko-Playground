import { useRef, useCallback } from "react";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import { getQuote, type QuoteRequest } from "@/lib/helpers/stellar/soroswap";
import { formatSwapAmount, fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import {
  DEFAULT_SLIPPAGE_BPS,
  MAX_HOPS,
} from "@/features/swap/constants/swapConfig";

export interface StellarQuoteResult {
  amount: string | null;
  error: string | null;
}

export function useStellarQuote(
  amountIn: string,
  tokenIn: Token | string,
  tokenOut: Token | string,
  apiKeyConfigured: boolean
): {
  fetchStellarQuote: () => Promise<StellarQuoteResult>;
  cancelStellarQuote: () => void;
} {
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelStellarQuote = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const fetchStellarQuote =
    useCallback(async (): Promise<StellarQuoteResult> => {
      const trimmedAmount = amountIn?.trim() || "";
      const parsedAmount = parseFloat(trimmedAmount);

      if (!trimmedAmount || isNaN(parsedAmount) || parsedAmount <= 0)
        return { amount: null, error: null };
      if (!apiKeyConfigured)
        return { amount: null, error: "API key not configured" };

      cancelStellarQuote();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const quoteRequest: QuoteRequest = {
          assetIn: tokenIn as Token | string,
          assetOut: tokenOut as Token | string,
          amount: trimmedAmount,
          tradeType: "EXACT_IN",
          protocols: ["soroswap", "phoenix", "aqua"],
          slippageBps: DEFAULT_SLIPPAGE_BPS,
          maxHops: MAX_HOPS,
        };

        const quote = await getQuote(quoteRequest);

        if (abortController.signal.aborted)
          return { amount: null, error: null };

        if (quote?.amountOut) {
          const amountOutStr = quote.amountOut.toString();
          const amountOutBigInt = BigInt(amountOutStr);
          if (amountOutBigInt > BigInt(0)) {
            return {
              amount: formatSwapAmount(fromSmallestUnit(amountOutStr, 7), 6),
              error: null,
            };
          }
        }

        return {
          amount: null,
          error: "No liquidity found for this pair",
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError")
          return { amount: null, error: null };

        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorWithCode = error as { code?: string } | null;
        const isTimeout =
          errorMessage.includes("timeout") ||
          errorMessage.includes("ECONNABORTED") ||
          errorWithCode?.code === "ECONNABORTED";

        if (isTimeout) {
          return { amount: null, error: "Quote request timed out" };
        }

        return {
          amount: null,
          error: errorMessage || "Failed to get quote",
        };
      }
    }, [amountIn, tokenIn, tokenOut, apiKeyConfigured, cancelStellarQuote]);

  return { fetchStellarQuote, cancelStellarQuote };
}
