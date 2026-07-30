"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { getQuote } from "../utils/rampApi";
import type { AnchorProvider, Quote } from "@/lib/anchors/types";
import { RAMP_PROVIDERS } from "../constants/ramp.config";

export function useAnchorQuote(provider: AnchorProvider) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const config = RAMP_PROVIDERS[provider];

  const { mutateAsync: fetchQuote, isPending: isLoadingQuote } = useMutation({
    mutationFn: async (params: {
      fromCurrency: string;
      toCurrency: string;
      fromAmount?: string;
      toAmount?: string;
      customerId?: string;
      resourceId?: string;
    }) => {
      const result = await getQuote(provider, params);
      return result;
    },
    onSuccess: (result) => {
      setQuote(result);
      setIsExpired(false);

      if (config.quoteExpiryMs) {
        const expiry = new Date(result.expiresAt).getTime();
        const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
        setSecondsLeft(remaining);
      }
    },
  });

  // Countdown timer
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft]);

  const clearQuote = useCallback(() => {
    setQuote(null);
    setSecondsLeft(null);
    setIsExpired(false);
  }, []);

  return {
    quote,
    isLoadingQuote,
    isExpired,
    secondsLeft,
    fetchQuote,
    clearQuote,
  };
}
