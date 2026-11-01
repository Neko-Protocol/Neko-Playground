"use client";

import React, { useState } from "react";
import { Sparkles, Shield, TrendingUp, Wallet } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { ConnectWalletModal } from "@/features/wallet/components/ConnectWalletModalLazy";

const features = [
  { icon: TrendingUp, text: "Real yields" },
  { icon: Shield, text: "Non-custodial" },
  { icon: Sparkles, text: "From $5" },
];

export const DashboardHero: React.FC = () => {
  const { address } = useWallet();
  const [showModal, setShowModal] = useState(false);

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0D1B2A] via-[#1B2838] to-[#0D1B2A]">
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />

      <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-48 h-48 rounded-full bg-[#229EDF] blur-[80px]" />
        <div className="absolute bottom-1/4 right-1/3 w-32 h-32 rounded-full bg-[#4ADE80] blur-[60px]" />
      </div>

      <div className="relative z-10 px-6 sm:px-10 py-8 sm:py-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-xl">
            {address ? (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#4ADE80]/10 border border-[#4ADE80]/20 mb-4">
                  <Wallet className="h-3.5 w-3.5 text-[#4ADE80]" />
                  <span className="text-[#4ADE80] text-xs font-medium">
                    {truncatedAddress}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight mb-3">
                  Welcome Back
                </h1>
                <p className="text-white/60 text-base sm:text-lg leading-relaxed">
                  Your portfolio overview and protocol activity at a glance.
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4">
                  <div className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
                  <span className="text-white/70 text-xs font-medium">
                    Live on Stellar
                  </span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight mb-3">
                  Invest in{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#229EDF] to-[#4ADE80]">
                    Real-World Assets
                  </span>
                </h1>
                <p className="text-white/60 text-base sm:text-lg leading-relaxed">
                  Access tokenized treasuries, lending pools, and yield vaults.
                  Non-custodial investing powered by Stellar.
                </p>
              </>
            )}

            <div className="flex flex-wrap gap-4 mt-6">
              {features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className="p-1 rounded-md bg-[#229EDF]/10">
                    <feature.icon className="h-3.5 w-3.5 text-[#229EDF]" />
                  </div>
                  <span className="text-white/60 text-xs">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {!address && (
            <div className="shrink-0">
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 rounded-xl bg-[#229EDF] hover:bg-[#1a8bc7] text-white font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-[#229EDF]/25 flex items-center gap-2"
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </button>
            </div>
          )}
        </div>
      </div>

      <ConnectWalletModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
};
