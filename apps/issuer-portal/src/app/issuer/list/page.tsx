"use client";

import { Suspense, useState } from "react";
import { StepIndicator } from "@/features/issuer/components/StepIndicator";
import { IssuerKycStep } from "@/features/issuer/components/IssuerKycStep";
import {
  LinkTokenStep,
  type LinkTokenValues,
} from "@/features/issuer/components/LinkTokenStep";
import { DepositStep } from "@/features/issuer/components/DepositStep";
import { ListingSuccess } from "@/features/issuer/components/ListingSuccess";
import { usePortalStore } from "@/stores/portal.store";

const STEPS = ["Verification", "Link token", "Deposit liquidity"];

interface ListingResult {
  contractId: string;
  listTx: string;
  escrowId: string;
  escrowAddress: string;
  mockEscrow: boolean;
}

function IssuerListPageInner() {
  const [step, setStep] = useState(0);
  const [token, setToken] = useState<LinkTokenValues | null>(null);
  const [result, setResult] = useState<ListingResult | null>(null);
  const addAsset = usePortalStore((s) => s.addAsset);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">
          List an asset for distribution
        </h1>
        <p className="text-sm text-white/60">
          Three steps: verify your identity, link the token you want to
          distribute, then deposit liquidity into a Trustless Work escrow.
        </p>
      </header>

      <StepIndicator steps={STEPS} current={step} />

      {result ? (
        <ListingSuccess
          contractId={result.contractId}
          listTx={result.listTx}
          escrowId={result.escrowId}
          escrowAddress={result.escrowAddress}
          mockEscrow={result.mockEscrow}
        />
      ) : step === 0 ? (
        <IssuerKycStep
          onComplete={() => {
            setStep(1);
          }}
        />
      ) : step === 1 ? (
        <LinkTokenStep
          onLinked={(v) => {
            setToken(v);
            setStep(2);
          }}
        />
      ) : step === 2 && token ? (
        <DepositStep
          token={token}
          onListed={({
            token: t,
            listedAmount,
            pricing,
            listTx,
            escrowId,
            escrowAddress,
            mockEscrow,
            issuerAddress: listingIssuer,
          }) => {
            addAsset({
              id: t.contractId,
              contractId: t.contractId,
              name: t.name,
              symbol: t.symbol,
              decimals: t.decimals,
              pricing,
              listedAmount,
              listedAt: Date.now(),
              issuerAddress: listingIssuer,
              listTx,
              escrowId,
              escrowAddress,
            });
            setResult({
              contractId: t.contractId,
              listTx,
              escrowId,
              escrowAddress,
              mockEscrow,
            });
          }}
        />
      ) : null}
    </div>
  );
}

export default function IssuerListPage() {
  return (
    <Suspense>
      <IssuerListPageInner />
    </Suspense>
  );
}
