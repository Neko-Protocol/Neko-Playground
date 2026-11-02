"use client";

import React, { useState } from "react";
import { Wallet } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { ConnectWalletModal } from "@/features/wallet/components/ConnectWalletModalLazy";

export const DashboardHero: React.FC = () => {
  const { address } = useWallet();
  const [showModal, setShowModal] = useState(false);

  if (address) {
    return null;
  }

  return (
    <div className="p-5 rounded-xl bg-[#1A1A1A] border border-white/5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Connect your wallet
          </h2>
          <p className="text-white/50 text-sm mt-1">
            Connect to view your portfolio and start investing
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-lg bg-[#229EDF] hover:bg-[#1a8bc7] text-white text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </button>
      </div>

      <ConnectWalletModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
};
