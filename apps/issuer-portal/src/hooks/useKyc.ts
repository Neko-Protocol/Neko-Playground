"use client";

import { useQuery } from "@tanstack/react-query";
import type { KycEntry, KycLevel } from "@/types";

interface StatusResponse {
  entry: {
    sessionId: string;
    stellarAddress: string;
    status: "pending" | "approved" | "rejected";
    kycLevel: KycLevel;
    country?: string;
    approvedAt?: number;
  } | null;
}

export function useKycStatus(address: string | undefined) {
  return useQuery({
    queryKey: ["kyc-status", address],
    enabled: Boolean(address),
    refetchInterval: 2500,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<KycEntry | null> => {
      const res = await fetch(
        `/api/kyc/status?address=${encodeURIComponent(address!)}`
      );
      const data = (await res.json()) as StatusResponse;
      if (!data.entry || data.entry.status !== "approved") return null;
      return {
        kycLevel: data.entry.kycLevel,
        country: data.entry.country ?? "US",
        approvedAt: data.entry.approvedAt ?? Date.now(),
      };
    },
  });
}

export async function startKycSession(input: {
  stellarAddress: string;
  kycLevel: KycLevel;
}): Promise<{ sessionId: string; verificationUrl: string }> {
  const res = await fetch("/api/kyc/create-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const { error } = (await res.json()) as { error?: string };
    throw new Error(error ?? "Failed to create KYC session");
  }
  return res.json();
}
