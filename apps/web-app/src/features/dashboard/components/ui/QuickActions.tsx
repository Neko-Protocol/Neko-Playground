"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Droplets,
  Compass,
  ArrowRight,
  Gavel,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { ConnectWalletModal } from "@/features/wallet/components/ConnectWalletModalLazy";

const actions = [
  {
    label: "Swap Tokens",
    description: "Exchange tokens instantly",
    href: "/swap",
    icon: ArrowLeftRight,
  },
  {
    label: "Add Liquidity",
    description: "Earn yield in pools",
    href: "/pools",
    icon: Droplets,
  },
  {
    label: "Explore Assets",
    description: "Browse RWA tokens & prices",
    href: "/discover",
    icon: Compass,
  },
  {
    label: "Liquidations",
    description: "Bad debt auctions",
    href: "/borrowing?tab=liquidations",
    icon: Gavel,
  },
] as const;

const QuickActions: React.FC = () => {
  const { address } = useWallet();
  const [showModal, setShowModal] = useState(false);

  if (!address) {
    return (
      <div className="w-full">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
          Get Started
        </h2>
        <p className="text-white/40 text-sm mb-5">
          Connect your wallet to start using the protocol
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-6 w-full text-left hover:border-white/10 hover:bg-[#222222] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-sm">Connect Wallet</p>
              <p className="text-white/40 text-xs mt-1">
                Swap tokens, provide liquidity, and explore RWA assets
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-white/40" />
          </div>
        </button>
        <ConnectWalletModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
        Quick Actions
      </h2>
      <p className="text-white/40 text-sm mb-5">Jump into the protocol</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group rounded-2xl bg-[#1C1C1C] border border-white/5 p-5 transition-all duration-200 hover:border-white/10 hover:bg-[#222222]"
          >
            <div className="p-2 bg-[#2A2A2A] rounded-lg w-fit mb-3 text-white/40 group-hover:text-white transition-colors">
              <action.icon className="h-5 w-5" />
            </div>
            <h3 className="text-white font-semibold text-sm mb-1">
              {action.label}
            </h3>
            <p className="text-white/40 text-xs">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
