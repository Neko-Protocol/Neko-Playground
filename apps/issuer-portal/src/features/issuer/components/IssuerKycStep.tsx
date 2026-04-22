"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useWallet } from "@/hooks/useWallet";
import { startKycSession, useKycStatus } from "@/hooks/useKyc";
import { ISSUER_KYC_LEVEL } from "@/lib/constants";
import type { KycEntry } from "@/types";

interface IssuerKycStepProps {
  onComplete: (kyc: KycEntry) => void;
}

export function IssuerKycStep({ onComplete }: IssuerKycStepProps) {
  const { address } = useWallet();
  const { data: kyc, isLoading } = useKycStatus(address);
  const params = useSearchParams();
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = params.get("kyc") === "pending" && !kyc;

  if (!address) {
    return (
      <Card className="p-8 text-sm text-white/60">
        Connect your wallet to start the accreditation check.
      </Card>
    );
  }

  if (kyc) {
    return (
      <Card className="p-8 space-y-4">
        <div className="flex items-center gap-3">
          <Badge tone="teal">Verified</Badge>
          <span className="text-sm text-white/70">
            {kyc.kycLevel} · {kyc.country}
          </span>
        </div>
        <p className="text-sm text-white/60">
          You are cleared to list an asset on Neko. Continue to link the token
          you want to distribute.
        </p>
        <Button onClick={() => onComplete(kyc)}>Continue</Button>
      </Card>
    );
  }

  if (pending) {
    return (
      <Card className="p-8 space-y-4">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neko-teal border-t-transparent" />
          <span className="text-sm font-medium">
            Waiting for DIDIT decision…
          </span>
        </div>
        <p className="text-sm text-white/60">
          We&apos;re polling for your verification result. This usually resolves
          within a few seconds of completing the review.
        </p>
      </Card>
    );
  }

  const openVerification = async () => {
    setLaunching(true);
    setError(null);
    try {
      const { verificationUrl } = await startKycSession({
        stellarAddress: address,
        kycLevel: ISSUER_KYC_LEVEL,
      });
      console.info("[kyc] redirecting issuer to", verificationUrl);
      window.location.href = verificationUrl;
    } catch (e) {
      console.error("[kyc] create-session failed", e);
      setError((e as Error).message);
      setLaunching(false);
    }
  };

  return (
    <Card className="p-8 space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Issuer accreditation</h3>
        <p className="text-sm text-white/60">
          Complete accredited-investor KYC through DIDIT before listing your
          token for distribution.
        </p>
      </div>

      <div className="rounded-md border border-white/10 bg-white/5 p-4 text-xs text-white/60">
        Required level:{" "}
        <span className="font-medium text-white">accredited</span>
      </div>

      {error ? (
        <p className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <Button onClick={openVerification} loading={launching || isLoading}>
        Start verification
      </Button>

      <p className="text-xs text-white/40">
        You&apos;ll be redirected to DIDIT to complete the verification. After
        approval, DIDIT will send you back here automatically.
      </p>
    </Card>
  );
}
