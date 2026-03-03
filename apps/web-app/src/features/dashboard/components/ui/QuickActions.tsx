"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Droplets, Compass, Wallet } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { ConnectWalletModal } from "@/features/wallet/components/ConnectWalletModal";

const actions = [
  {
    label: "Swap Tokens",
    description: "Exchange tokens instantly",
    href: "/dashboard/swap",
    icon: ArrowLeftRight,
    color: "from-[#39bfb7] to-[#2bb8d7]",
  },
  {
    label: "Add Liquidity",
    description: "Earn yield in pools",
    href: "/dashboard/pools",
    icon: Droplets,
    color: "from-[#334EAC] to-[#7096D1]",
  },
  {
    label: "Explore Assets",
    description: "Browse RWA tokens & prices",
    href: "/dashboard/stocks",
    icon: Compass,
    color: "from-[#96b2ff] to-[#334EAC]",
  },
] as const;

const QuickActions: React.FC = () => {
  const { address } = useWallet();
  const [showModal, setShowModal] = useState(false);

  if (!address) {
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full rounded-2xl bg-linear-to-r from-neko-teal to-[#2bb8d7] p-6 text-center shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center justify-center gap-3">
            <Wallet className="h-6 w-6 text-white" />
            <span className="text-lg font-bold text-white">
              Connect Wallet to Get Started
            </span>
          </div>
          <p className="mt-2 text-sm text-white/80">
            Swap tokens, provide liquidity, and explore RWA assets
          </p>
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
      <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group rounded-2xl bg-[#1C1C1C] border border-white/5 p-5 transition-all hover:border-white/10 hover:bg-[#222222] hover:-translate-y-0.5"
          >
            <div
              className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-linear-to-br ${action.color} mb-3`}
            >
              <action.icon className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              {action.label}
            </h3>
            <p className="text-xs text-white/40">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
