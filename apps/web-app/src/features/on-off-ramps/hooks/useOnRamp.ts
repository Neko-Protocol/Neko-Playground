"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createOnRamp, getOnRampTransaction } from "../utils/rampApi";
import type { AnchorProvider, OnRampTransaction } from "@/lib/anchors/types";
import { TERMINAL_STATUSES } from "../types/ramp";
import type { PollOutcome } from "../types/ramp";
import { useAnchorPolling } from "./useAnchorPolling";

export function useOnRamp(provider: AnchorProvider) {
  const [transaction, setTransaction] = useState<OnRampTransaction | null>(
    null
  );

  const shouldPoll =
    !!transaction && !TERMINAL_STATUSES.has(transaction.status);

  const { outcome: pollOutcome, retry: retryPoll } = useAnchorPolling({
    enabled: shouldPoll,
    queryFn: async (signal) => {
      if (!transaction?.id) return null;
      const updated = await getOnRampTransaction(provider, transaction.id, {
        signal,
      });
      if (updated) {
        setTransaction(updated);
      }
      return updated;
    },
    isTerminal: (tx) => TERMINAL_STATUSES.has(tx.status),
  });

  const { mutateAsync: startOnRamp, isPending: isCreating } = useMutation({
    mutationFn: (data: {
      customerId: string;
      quoteId: string;
      stellarAddress: string;
      fromCurrency: string;
      toCurrency: string;
      amount: string;
      memo?: string;
      bankAccountId?: string;
    }) => createOnRamp(provider, data),
    onSuccess: (tx) => {
      setTransaction(tx);
    },
  });

  const reset = () => {
    setTransaction(null);
  };

  const isPolling = shouldPoll && pollOutcome === "pending";

  return {
    transaction,
    isCreating,
    isPolling,
    pollOutcome: transaction ? pollOutcome : ("pending" as PollOutcome),
    retryPoll,
    startOnRamp,
    reset,
  };
}
