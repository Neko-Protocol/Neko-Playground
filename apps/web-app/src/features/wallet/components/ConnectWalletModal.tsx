"use client";

import React from "react";
import Image from "next/image";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useStellarWallet } from "@/hooks";

const EVM_ICON = "/crypto/svg/ethereum-eth-logo.svg";
const STELLAR_ICON = "/crypto/svg/stellar-xlm-logo.svg";

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { openConnectModal } = useConnectModal();
  const { connect: connectStellar } = useStellarWallet();

  const handleEVM = () => {
    onClose();
    openConnectModal?.();
  };

  const handleStellar = () => {
    onClose();
    void connectStellar();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-wallet-title"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2
            id="connect-wallet-title"
            className="text-lg font-bold text-zinc-900"
          >
            Connect Wallet
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-3 p-6">
          <button
            type="button"
            onClick={handleEVM}
            className="flex items-center gap-3 rounded-xl border-2 border-[#334EAC] bg-white px-4 py-3.5 text-left font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            <Image
              src={EVM_ICON}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0"
              aria-hidden
            />
            Connect EVM Wallet
          </button>
          <button
            type="button"
            onClick={handleStellar}
            className="flex items-center gap-3 rounded-xl border-2 border-[#334EAC] bg-white px-4 py-3.5 text-left font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            <Image
              src={STELLAR_ICON}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0"
              aria-hidden
            />
            Connect Stellar Wallet
          </button>
        </div>
      </div>
    </>
  );
};
