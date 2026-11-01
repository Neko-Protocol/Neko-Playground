"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, Shield, TrendingUp } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { ConnectWalletModal } from "@/features/wallet/components/ConnectWalletModalLazy";

const features = [
  { icon: TrendingUp, text: "Real yields from real assets" },
  { icon: Shield, text: "Non-custodial & secure" },
  { icon: Sparkles, text: "Start from $5" },
];

export const Hero: React.FC = () => {
  const { address } = useWallet();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D1B2A] via-[#1B2838] to-[#0D1B2A]">
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />

      <div className="absolute top-0 right-0 w-1/2 h-full opacity-20">
        <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full bg-[#229EDF] blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/3 w-48 h-48 rounded-full bg-[#4ADE80] blur-[80px]" />
      </div>

      <div className="relative z-10 px-6 sm:px-10 py-12 sm:py-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
            <span className="text-white/70 text-sm font-medium">
              Live on Stellar Mainnet
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight mb-4">
            Invest in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#229EDF] to-[#4ADE80]">
              Real-World Assets
            </span>
            <br />
            on the Blockchain
          </h1>

          <p className="text-white/60 text-lg sm:text-xl leading-relaxed mb-8 max-w-xl">
            Access tokenized treasuries, lending pools, and yield vaults.
            Non-custodial investing powered by Stellar, starting from just $5.
          </p>

          <div className="flex flex-wrap gap-4 mb-10">
            {!address ? (
              <button
                onClick={() => setShowModal(true)}
                className="px-8 py-4 rounded-xl bg-[#229EDF] hover:bg-[#1a8bc7] text-white font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-[#229EDF]/25"
              >
                Connect Wallet
              </button>
            ) : (
              <Link
                href="/dashboard"
                className="px-8 py-4 rounded-xl bg-[#229EDF] hover:bg-[#1a8bc7] text-white font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-[#229EDF]/25"
              >
                Go to Dashboard
              </Link>
            )}
            <Link
              href="/discover"
              className="px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold border border-white/10 transition-all duration-200"
            >
              Explore Assets
            </Link>
          </div>

          <div className="flex flex-wrap gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#229EDF]/10">
                  <feature.icon className="h-4 w-4 text-[#229EDF]" />
                </div>
                <span className="text-white/70 text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConnectWalletModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
};
