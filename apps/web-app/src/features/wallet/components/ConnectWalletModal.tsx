"use client";

import { X } from "lucide-react";
import { useStellarWallet } from "@/hooks/useStellarWallet";

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectWalletModal({
  isOpen,
  onClose,
}: ConnectWalletModalProps) {
  const { connect } = useStellarWallet();

  if (!isOpen) return null;

  const handleStellarConnect = async () => {
    await connect();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white text-xl font-bold">Connect Wallet</h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => void handleStellarConnect()}
            className="w-full flex items-center gap-4 rounded-2xl bg-[#2A2A2A] hover:bg-[#333] border border-white/5 p-4 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-full bg-[#1a2a4a] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Stellar Wallet</p>
              <p className="text-white/40 text-xs">
                Freighter or Stellar Wallets Kit
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
