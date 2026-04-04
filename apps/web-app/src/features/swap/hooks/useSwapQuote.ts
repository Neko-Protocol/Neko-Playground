import { useState, useEffect, useRef, useCallback } from "react";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import { hasApiKey } from "@/lib/helpers/stellar/soroswap";
import { useStellarQuote } from "./useStellarQuote";
import {
  DEBOUNCE_MS,
  QUOTE_REFRESH_INTERVAL_MS,
} from "@/features/swap/constants/swapConfig";

const MAX_CONSECUTIVE_FAILURES = 3;

export interface SwapQuoteState {
  amountOut: string;
  isLoadingQuote: boolean;
  apiKeyConfigured: boolean;
  quoteError: string | null;
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
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const quoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const quoteIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const failureCountRef = useRef<number>(0);

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
      setQuoteError(null);
      return;
    }

    try {
      const result = await fetchStellarQuote();

      if (result.amount !== null) {
        setAmountOut(result.amount);
        setIsLoadingQuote(false);
        setQuoteError(null);
        failureCountRef.current = 0;
        return;
      }

      if (result.error) {
        failureCountRef.current += 1;
        if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
          setIsLoadingQuote(false);
          setQuoteError(result.error);
          if (quoteIntervalRef.current) {
            clearInterval(quoteIntervalRef.current);
            quoteIntervalRef.current = null;
          }
        }
      }
    } catch {
      failureCountRef.current += 1;
      if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
        setIsLoadingQuote(false);
        setQuoteError("Failed to get quote — try again");
        if (quoteIntervalRef.current) {
          clearInterval(quoteIntervalRef.current);
          quoteIntervalRef.current = null;
        }
      }
    }
  }, [address, amountIn, fetchStellarQuote]);

  useEffect(() => {
    if (quoteTimeoutRef.current) {
      clearTimeout(quoteTimeoutRef.current);
      quoteTimeoutRef.current = null;
    }

    cancelStellarQuote();

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
      setQuoteError(null);
      return;
    }

    if (!apiKeyConfigured) {
      setAmountOut("0.0");
      setQuoteError(null);
      return;
    }

    setAmountOut("0.0");
    setIsLoadingQuote(true);
    setQuoteError(null);
    failureCountRef.current = 0;

    quoteTimeoutRef.current = setTimeout(() => {
      void fetchLiveQuote();
    }, DEBOUNCE_MS);

    return () => {
      if (quoteTimeoutRef.current) {
        clearTimeout(quoteTimeoutRef.current);
        quoteTimeoutRef.current = null;
      }
      cancelStellarQuote();
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
    quoteError,
    fetchLiveQuote,
  };
}
