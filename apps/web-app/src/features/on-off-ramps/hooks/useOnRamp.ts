"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { createOnRamp, getOnRampTransaction } from "../utils/rampApi";
import type { AnchorProvider, OnRampTransaction } from "@/lib/anchors/types";
import {
  POLL_INTERVAL_MS,
  MAX_POLL_DURATION_MS,
} from "../constants/ramp.config";
import { TERMINAL_STATUSES } from "../types/ramp";

export function useOnRamp(provider: AnchorProvider) {
  const [transaction, setTransaction] = useState<OnRampTransaction | null>(
    null
  );
  const [isPolling, setIsPolling] = useState(false);

  const { mutateAsync: startOnRamp, isPending: isCreating } = useMutation({
    mutationFn: (data: {
      customerId: string;
      quoteId: string;
      fromCurrency: string;
      toCurrency: string;
      amount: string;
      memo?: string;
      bankAccountId?: string;
    }) => createOnRamp(provider, data),
    onSuccess: (tx) => {
      setTransaction(tx);
      if (!TERMINAL_STATUSES.has(tx.status)) {
        setIsPolling(true);
      }
    },
  });

  // Polling loop
  useEffect(() => {
    if (!isPolling || !transaction?.id) return;

    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        setIsPolling(false);
        return;
      }

      try {
        const updated = await getOnRampTransaction(provider, transaction.id);
        if (updated) {
          setTransaction(updated);
          if (TERMINAL_STATUSES.has(updated.status)) {
            setIsPolling(false);
            return;
          }
        }
      } catch {
        // Retry on next interval
      }

      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    return () => clearTimeout(timeoutId);
  }, [isPolling, transaction?.id, provider]);

  const reset = () => {
    setTransaction(null);
    setIsPolling(false);
  };

  return {
    transaction,
    isCreating,
    isPolling,
    startOnRamp,
    reset,
  };
}
