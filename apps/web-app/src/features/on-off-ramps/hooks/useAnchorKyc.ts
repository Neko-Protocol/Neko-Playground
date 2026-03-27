"use client";

import { useQuery } from "@tanstack/react-query";
import { getKycStatus, getKycUrl } from "../utils/rampApi";
import type { AnchorProvider, KycStatus } from "@/lib/anchors/types";

export function useAnchorKyc(
  provider: AnchorProvider,
  customerId: string | null,
  publicKey?: string,
  bankAccountId?: string,
  /** Presigned URL from initial registration (localStorage). */
  storedOnboardingUrl?: string | null
) {
  const {
    data: kycStatus,
    isLoading: isCheckingKyc,
    refetch: refetchKycStatus,
  } = useQuery<KycStatus>({
    queryKey: ["kyc-status", provider, customerId, publicKey],
    queryFn: () => getKycStatus(provider, customerId!, publicKey),
    enabled: !!customerId,
    staleTime: 30_000,
  });

  const isKycRequired =
    kycStatus === "not_started" ||
    kycStatus === "rejected" ||
    kycStatus === "update_required";
  const isKycApproved = kycStatus === "approved";
  const isKycPending = kycStatus === "pending";

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

    // Path 1: stored URL — open directly, no async needed.
    if (storedOnboardingUrl) {
      window.open(storedOnboardingUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // Path 2: no stored URL — claim gesture now, fetch URL, then navigate.
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

  return {
    kycStatus,
    isCheckingKyc,
    isKycRequired,
    isKycApproved,
    isKycPending,
    refetchKycStatus,
    openKycFlow,
  };
}
