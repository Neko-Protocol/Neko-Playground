"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { startKycSession, useKycStatus } from "@/hooks/useKyc";
import { useWallet } from "@/hooks/useWallet";

interface KycGateProps {
  onApproved: () => void;
}

export function KycGate({ onApproved }: KycGateProps) {
  const { address } = useWallet();
  const { data: kyc, isLoading } = useKycStatus(address);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!address) {
    return (
      <p className="text-sm text-white/60">Connect your wallet to continue.</p>
    );
  }

  if (kyc) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-white/70">
          KYC <span className="text-neko-teal">{kyc.kycLevel}</span> ·{" "}
          <span className="text-neko-teal">{kyc.country}</span> — cleared.
        </p>
        <Button onClick={onApproved}>Continue to purchase</Button>
      </div>
    );
  }

  const begin = async () => {
    setLaunching(true);
    setError(null);
    try {
      const { verificationUrl } = await startKycSession({
        stellarAddress: address,
        kycLevel: "basic",
        returnPath: "/marketplace",
      });
      console.info("[kyc] redirecting buyer to", verificationUrl);
      window.location.href = verificationUrl;
    } catch (e) {
      setError((e as Error).message);
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        KYC required. Verify with DIDIT to purchase.
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <Button onClick={begin} loading={launching || isLoading}>
        Start KYC
      </Button>
      <p className="text-xs text-white/40">
        You&apos;ll be redirected to DIDIT. After approval you&apos;ll land back
        in the marketplace.
      </p>
    </div>
  );
}
