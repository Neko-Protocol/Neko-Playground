import { useState, useEffect, useRef, useCallback } from "react";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import { hasApiKey } from "@/lib/helpers/stellar/soroswap";
import { useStellarQuote } from "./useStellarQuote";
import {
  DEBOUNCE_MS,
  QUOTE_REFRESH_INTERVAL_MS,
} from "@/features/swap/constants/swapConfig";

export interface SwapQuoteState {
  amountOut: string;
  isLoadingQuote: boolean;
  apiKeyConfigured: boolean;
}

export interface SwapQuoteActions {
  fetchLiveQuote: () => Promise<void>;
}

export function useSwapQuote(
  address: string | undefined,
  amountIn: string,
  tokenIn: Token | string,
  tokenOut: Token | string
): SwapQuoteState & SwapQuoteActions {
  const [amountOut, setAmountOut] = useState<string>("0.0");
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean>(false);

  const quoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const quoteIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { fetchStellarQuote, cancelStellarQuote } = useStellarQuote(
    amountIn,
    tokenIn,
    tokenOut,
    apiKeyConfigured
  );

  useEffect(() => {
    setApiKeyConfigured(hasApiKey());
  }, []);

  const fetchLiveQuote = useCallback(async () => {
    const trimmedAmount = amountIn?.trim() || "";
    const parsedAmount = parseFloat(trimmedAmount);

    if (
      !address ||
      !trimmedAmount ||
      trimmedAmount === "0" ||
      trimmedAmount === "0." ||
      isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setAmountOut("0.0");
      setIsLoadingQuote(false);
      return;
    }

    try {
      const result = await fetchStellarQuote();
      setAmountOut(result ?? "0.0");
    } catch {
      setAmountOut("0.0");
    } finally {
      setIsLoadingQuote(false);
    }
  }, [address, amountIn, fetchStellarQuote]);

  // Debounced quote trigger
  useEffect(() => {
    if (quoteTimeoutRef.current) {
      clearTimeout(quoteTimeoutRef.current);
      quoteTimeoutRef.current = null;
    }

    cancelStellarQuote();
    setIsLoadingQuote(false);

    const trimmedAmount = amountIn?.trim() || "";
    const parsedAmount = parseFloat(trimmedAmount);
    const isZero =
      trimmedAmount === "0" ||
      trimmedAmount === "0." ||
      trimmedAmount === "0.0";
    const isValid =
      trimmedAmount !== "" &&
      !isZero &&
      !isNaN(parsedAmount) &&
      parsedAmount > 0;

    if (!isValid || !address) {
      setAmountOut("0.0");
      return;
    }

    if (!apiKeyConfigured) {
      setAmountOut("0.0");
      return;
    }

    setAmountOut("0.0");
    setIsLoadingQuote(true);

    quoteTimeoutRef.current = setTimeout(() => {
      void fetchLiveQuote();
    }, DEBOUNCE_MS);

    return () => {
      if (quoteTimeoutRef.current) {
        clearTimeout(quoteTimeoutRef.current);
        quoteTimeoutRef.current = null;
      }
      cancelStellarQuote();
      setIsLoadingQuote(false);
    };
  }, [
    amountIn,
    tokenIn,
    tokenOut,
    address,
    apiKeyConfigured,
    fetchLiveQuote,
    cancelStellarQuote,
  ]);

  // Auto-refresh quotes every interval while valid inputs exist
  useEffect(() => {
    if (
      address &&
      tokenIn &&
      tokenOut &&
      amountIn &&
      parseFloat(amountIn) > 0
    ) {
      if (quoteIntervalRef.current) {
        clearInterval(quoteIntervalRef.current);
      }
      quoteIntervalRef.current = setInterval(() => {
        void fetchLiveQuote();
      }, QUOTE_REFRESH_INTERVAL_MS);
    } else {
      if (quoteIntervalRef.current) {
        clearInterval(quoteIntervalRef.current);
        quoteIntervalRef.current = null;
      }
    }

    return () => {
      if (quoteIntervalRef.current) {
        clearInterval(quoteIntervalRef.current);
      }
    };
  }, [amountIn, tokenIn, tokenOut, address, apiKeyConfigured, fetchLiveQuote]);

  return {
    amountOut,
    isLoadingQuote,
    apiKeyConfigured,
    fetchLiveQuote,
  };
}
