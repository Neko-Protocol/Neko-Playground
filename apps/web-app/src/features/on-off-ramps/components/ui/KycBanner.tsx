"use client";

import React from "react";
import { ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import type { KycStatus } from "@/lib/anchors/types";

interface KycBannerProps {
  status: KycStatus | undefined;
  onStartKyc: () => void;
  isLoading?: boolean;
}

export const KycBanner: React.FC<KycBannerProps> = ({
  status,
  onStartKyc,
  isLoading,
}) => {
  if (status === "approved") {
    return (
      <div className="flex items-center gap-3 bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-green-400 shrink-0" />
        <p className="text-green-400 text-sm font-medium">KYC Verified</p>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex items-center gap-3 bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-4 py-3">
        <Clock className="h-5 w-5 text-yellow-400 shrink-0" />
        <p className="text-yellow-400 text-sm font-medium">
          KYC verification in progress. This may take a few minutes.
        </p>
      </div>
    );
  }

  // While loading and no cached status, render nothing to avoid flash.
  if (isLoading && !status) return null;

  if (
    !status ||
    status === "not_started" ||
    status === "rejected" ||
    status === "update_required"
  ) {
    return (
      <div className="flex items-center justify-between gap-3 bg-[#229EDF]/10 border border-[#229EDF]/20 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-[#229EDF] shrink-0" />
          <div>
            <p className="text-white text-sm font-medium">
              {status === "rejected"
                ? "KYC Rejected — Re-verify required"
                : status === "update_required"
                  ? "Additional info required"
                  : "Identity verification required"}
            </p>
            <p className="text-white/40 text-xs">
              Complete KYC to use this provider
            </p>
          </div>
        </div>
        <button
          onClick={onStartKyc}
          className="shrink-0 px-4 py-2 rounded-lg bg-[#229EDF] hover:bg-[#1a8bc7] text-white text-sm font-medium transition-colors"
        >
          Verify
        </button>
      </div>
    );
  }

  return null;
};
