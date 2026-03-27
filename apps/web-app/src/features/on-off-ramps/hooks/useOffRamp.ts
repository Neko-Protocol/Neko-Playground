"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  createOffRamp,
  getOffRampTransaction,
  submitSignedXdr,
} from "../utils/rampApi";
import type { AnchorProvider, OffRampTransaction } from "@/lib/anchors/types";
import {
  POLL_INTERVAL_MS,
  MAX_POLL_DURATION_MS,
} from "../constants/ramp.config";
import { TERMINAL_STATUSES } from "../types/ramp";

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
        // XDR already available (rare for Etherfuse, may happen for Alfred Pay)
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

  // Phase 1: Poll for signableTransaction (Etherfuse deferred signing)
  useEffect(() => {
    if (phase !== "waiting-xdr" || !transaction?.id) return;

    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        setPhase("error");
        setError("Timed out waiting for transaction to sign");
        return;
      }

      try {
        const updated = await getOffRampTransaction(provider, transaction.id);
        if (updated) {
          setTransaction(updated);
          if (TERMINAL_STATUSES.has(updated.status)) {
            setPhase("done");
            return;
          }
          if (updated.signableTransaction) {
            setPhase("signing");
            return;
          }
        }
      } catch {
        // retry
      }

      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    return () => clearTimeout(timeoutId);
  }, [phase, transaction?.id, provider]);

  // Phase 2: Auto-sign when XDR is ready
  useEffect(() => {
    if (phase !== "signing" || !transaction?.signableTransaction) return;

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
          // User rejected: go back to waiting so they can retry
          setPhase("waiting-xdr");
        } else {
          setError(err instanceof Error ? err.message : String(err));
          setPhase("error");
        }
      }
    };

    sign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Phase 3: Poll for completion after signing
  useEffect(() => {
    if (phase !== "polling" || !transaction?.id) return;

    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        setPhase("done"); // best effort
        return;
      }

      try {
        const updated = await getOffRampTransaction(provider, transaction.id);
        if (updated) {
          setTransaction(updated);
          if (TERMINAL_STATUSES.has(updated.status)) {
            setPhase("done");
            return;
          }
        }
      } catch {
        // retry
      }

      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    return () => clearTimeout(timeoutId);
  }, [phase, transaction?.id, provider]);

  const reset = () => {
    setTransaction(null);
    setPhase("idle");
    setError(null);
  };

  return {
    transaction,
    phase,
    error,
    isCreating,
    isWaitingForXdr: phase === "waiting-xdr",
    isSigning: phase === "signing" || phase === "submitting",
    isPolling: phase === "polling",
    isDone: phase === "done",
    isError: phase === "error",
    startOffRamp,
    reset,
  };
}
