"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  createOffRamp,
  getOffRampTransaction,
  submitSignedXdr,
} from "../utils/rampApi";
import type { AnchorProvider, OffRampTransaction } from "@/lib/anchors/types";
import { TERMINAL_STATUSES } from "../types/ramp";
import type { PollOutcome } from "../types/ramp";
import { useAnchorPolling } from "./useAnchorPolling";

type OffRampPhase =
  | "idle"
  | "creating"
  | "waiting-xdr"
  | "signing"
  | "submitting"
  | "polling"
  | "done"
  | "error";

export function useOffRamp(
  provider: AnchorProvider,
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>
) {
  const [transaction, setTransaction] = useState<OffRampTransaction | null>(
    null
  );
  const [phase, setPhase] = useState<OffRampPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const signedForTxIdRef = useRef<string | null>(null);

  const { mutateAsync: startOffRamp, isPending: isCreating } = useMutation({
    mutationFn: (data: {
      customerId: string;
      quoteId: string;
      stellarAddress: string;
      fromCurrency: string;
      toCurrency: string;
      amount: string;
      fiatAccountId?: string;
      bankAccount?: { clabe: string; beneficiary: string; bankName?: string };
      memo?: string;
    }) => createOffRamp(provider, data),
    onSuccess: (tx) => {
      setTransaction(tx);
      if (TERMINAL_STATUSES.has(tx.status)) {
        setPhase("done");
      } else if (tx.signableTransaction) {
        setPhase("signing");
      } else {
        setPhase("waiting-xdr");
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    },
  });

  const { outcome: xdrPollOutcome, retry: retryXdrPoll } = useAnchorPolling({
    enabled: phase === "waiting-xdr" && !!transaction?.id,
    queryFn: async (signal) => {
      if (!transaction?.id) return null;
      const updated = await getOffRampTransaction(provider, transaction.id, {
        signal,
      });
      if (updated) {
        setTransaction(updated);
        if (TERMINAL_STATUSES.has(updated.status)) {
          setPhase("done");
        } else if (updated.signableTransaction) {
          setPhase("signing");
        }
      }
      return updated;
    },
    isTerminal: (tx) =>
      TERMINAL_STATUSES.has(tx.status) || !!tx.signableTransaction,
  });

  useEffect(() => {
    if (phase !== "signing" || !transaction?.signableTransaction) return;
    if (signedForTxIdRef.current === transaction.id) return;

    signedForTxIdRef.current = transaction.id;

    const sign = async () => {
      try {
        setPhase("submitting");
        const { signedTxXdr } = await signTransaction(
          transaction.signableTransaction!
        );
        await submitSignedXdr(provider, signedTxXdr, transaction.id);
        setPhase("polling");
      } catch (err) {
        if (err instanceof Error && err.message === "USER_REJECTED") {
          signedForTxIdRef.current = null;
          setPhase("waiting-xdr");
        } else {
          setError(err instanceof Error ? err.message : String(err));
          setPhase("error");
        }
      }
    };

    void sign();
  }, [
    phase,
    transaction?.id,
    transaction?.signableTransaction,
    signTransaction,
    provider,
  ]);

  const { outcome: completionPollOutcome, retry: retryCompletionPoll } =
    useAnchorPolling({
      enabled: phase === "polling" && !!transaction?.id,
      queryFn: async (signal) => {
        if (!transaction?.id) return null;
        const updated = await getOffRampTransaction(provider, transaction.id, {
          signal,
        });
        if (updated) {
          setTransaction(updated);
          if (TERMINAL_STATUSES.has(updated.status)) {
            setPhase("done");
          }
        }
        return updated;
      },
      isTerminal: (tx) => TERMINAL_STATUSES.has(tx.status),
    });

  const pollOutcome: PollOutcome =
    phase === "polling"
      ? completionPollOutcome
      : phase === "waiting-xdr"
        ? xdrPollOutcome
        : "pending";

  const retryPoll = () => {
    if (phase === "polling") {
      retryCompletionPoll();
    } else if (phase === "waiting-xdr") {
      retryXdrPoll();
    }
  };

  const reset = () => {
    setTransaction(null);
    setPhase("idle");
    setError(null);
    signedForTxIdRef.current = null;
  };

  const hasPollFailure =
    pollOutcome === "timed-out" || pollOutcome === "unreachable";

  return {
    transaction,
    phase,
    error,
    isCreating,
    isWaitingForXdr: phase === "waiting-xdr" && !hasPollFailure,
    isSigning: phase === "signing" || phase === "submitting",
    isPolling:
      (phase === "polling" || phase === "waiting-xdr") &&
      pollOutcome === "pending",
    isDone: phase === "done",
    isError: phase === "error",
    pollOutcome,
    retryPoll,
    startOffRamp,
    reset,
  };
}
