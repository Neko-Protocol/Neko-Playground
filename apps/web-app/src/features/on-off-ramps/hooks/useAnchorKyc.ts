"use client";

import { useState } from "react";
import { getKycStatus, getKycUrl } from "../utils/rampApi";
import type { AnchorProvider, KycStatus } from "@/lib/anchors/types";
import type { PollOutcome } from "../types/ramp";
import { useAnchorPolling } from "./useAnchorPolling";

export function useAnchorKyc(
  provider: AnchorProvider,
  customerId: string | null,
  publicKey?: string,
  bankAccountId?: string,
  /** Presigned URL from initial registration (localStorage). */
  storedOnboardingUrl?: string | null
) {
  const [kycStatus, setKycStatus] = useState<KycStatus | undefined>();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const { outcome: pollOutcome, retry: retryKycPoll } = useAnchorPolling({
    enabled: !!customerId,
    queryFn: async (signal) => {
      const status = await getKycStatus(provider, customerId!, publicKey, {
        signal,
      });
      setKycStatus(status);
      setIsInitialLoad(false);
      return status;
    },
    isTerminal: (status) => status === "approved" || status === "pending",
  });

  const isCheckingKyc =
    !!customerId && isInitialLoad && pollOutcome === "pending";

  const isKycRequired =
    kycStatus === "not_started" ||
    kycStatus === "rejected" ||
    kycStatus === "update_required";
  const isKycApproved = kycStatus === "approved";
  const isKycPending = kycStatus === "pending";

  const refetchKycStatus = () => {
    retryKycPoll();
  };

  /**
   * Open the Etherfuse Hosted UI in a new tab.
   *
   * Two paths to avoid popup blockers:
   * 1. Stored URL available → window.open(url) directly (synchronous).
   * 2. No stored URL → open "about:blank" synchronously to claim the user
   *    gesture, then navigate it to a freshly-fetched URL.
   *    NOTE: "noopener" is intentionally omitted in path 2 because it causes
   *    window.open() to return null, making the window un-navigable.
   */
  const openKycFlow = async () => {
    if (!customerId) return;

    if (storedOnboardingUrl) {
      window.open(storedOnboardingUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const win = window.open("about:blank", "_blank");
    if (!win) return;

    try {
      const url = await getKycUrl(
        provider,
        customerId,
        publicKey,
        bankAccountId
      );
      win.location.href = url;
    } catch {
      win.close();
    }
  };

  const kycPollOutcome: PollOutcome = customerId ? pollOutcome : "pending";

  return {
    kycStatus,
    isCheckingKyc,
    isKycRequired,
    isKycApproved,
    isKycPending,
    kycPollOutcome,
    refetchKycStatus,
    retryKycPoll,
    openKycFlow,
  };
}
