"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { PageContainer } from "@/components/ui/PageContainer";
import { BannerPage } from "@/components/ui/BannerPage";
import { ConnectWalletModal } from "@/features/wallet/components/ConnectWalletModal";
import PoolStateToggle from "./PoolStateToggle";
import TreasuryFeesTable from "./TreasuryFeesTable";
import CollateralFactorForm from "./CollateralFactorForm";
import InterestRateParamsForm from "./InterestRateParamsForm";
import { clientEnv } from "@/lib/env.client";

const ADMIN_ADDRESS = clientEnv.lendingAdminAddress;

function ConnectWalletPrompt() {
  const [showModal, setShowModal] = React.useState(false);
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <p className="text-white/70 text-center">
        Connect your wallet to access the admin panel.
      </p>
      <button
        onClick={() => setShowModal(true)}
        className="px-6 py-2 rounded-xl bg-[#229EDF] hover:bg-[#1e8bc9] text-white font-medium transition-colors"
      >
        Connect Wallet
      </button>
      <ConnectWalletModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}

export default function AdminPageClient() {
  const { address } = useWallet();
  const router = useRouter();

  // Page NOT exposed: redirect immediately if admin not configured or user is not admin
  useEffect(() => {
    if (!ADMIN_ADDRESS) {
      router.replace("/dashboard");
      return;
    }
    if (address && address !== ADMIN_ADDRESS) {
      router.replace("/dashboard");
    }
  }, [address, router]);

  if (!ADMIN_ADDRESS) return null;
  if (address && address !== ADMIN_ADDRESS) return null;

  // Only show Connect prompt when admin not yet connected (so they can connect)
  if (!address) {
    return (
      <div className="w-full min-w-0 max-w-full min-h-screen overflow-x-hidden">
        <PageContainer maxWidth="7xl" className="space-y-8 sm:space-y-10">
          <BannerPage
            title="Admin"
            subtitle="Lending pool administration"
            badge="Restricted"
          />
          <ConnectWalletPrompt />
        </PageContainer>
      </div>
    );
  }

  // Admin is connected: show full admin UI
  return (
    <div className="w-full min-w-0 max-w-full min-h-screen overflow-x-hidden">
      <PageContainer maxWidth="7xl" className="space-y-8 sm:space-y-10">
        <BannerPage
          title="Admin"
          subtitle="Pool state, treasury fees, collateral factors, interest rates"
          badge="Admin"
        />
        <div className="space-y-10">
          <PoolStateToggle />
          <TreasuryFeesTable />
          <CollateralFactorForm />
          <InterestRateParamsForm />
        </div>
      </PageContainer>
    </div>
  );
}
