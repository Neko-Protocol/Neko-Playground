"use client";

import { useQuery } from "@tanstack/react-query";
import { getKycStatus, getKycUrl } from "../utils/rampApi";
import type { AnchorProvider, KycStatus } from "@/lib/anchors/types";

export function useAnchorKyc(
  provider: AnchorProvider,
  customerId: string | null,
  bankAccountId?: string,
  /** Presigned URL from initial registration (localStorage). */
  storedOnboardingUrl?: string | null
) {
  const {
    data: kycStatus,
    isLoading: isCheckingKyc,
    refetch: refetchKycStatus,
  } = useQuery<KycStatus>({
    queryKey: ["kyc-status", provider, customerId],
    queryFn: () => getKycStatus(provider, customerId!),
    enabled: !!customerId,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const status = query.state.data;
      return status === "approved" || status === "pending" ? false : 15_000;
    },
  });

  const isKycRequired =
    kycStatus === "not_started" ||
    kycStatus === "rejected" ||
    kycStatus === "update_required";
  const isKycApproved = kycStatus === "approved";
  const isKycPending = kycStatus === "pending";

  const openKycFlow = async () => {
    if (!customerId) return;

    if (storedOnboardingUrl) {
      window.open(storedOnboardingUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const win = window.open("about:blank", "_blank");
    if (!win) return;

    try {
      const url = await getKycUrl(provider, customerId, bankAccountId);
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
