"use client";

import React, { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDisconnect } from "wagmi";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { useWalletType } from "@/hooks/useWalletType";
import { ConnectWalletModal } from "./ConnectWalletModal";

function truncateAddress(value: string, start = 4, end = 4): string {
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

export const WalletButton: React.FC = () => {
  const {
    walletType,
    isEvmConnected,
    isStellarConnected,
    evmAddress,
    stellarAddress,
  } = useWalletType();
  const { disconnect: disconnectStellar } = useStellarWallet();
  const { disconnect: disconnectEvm } = useDisconnect();
  const [showModal, setShowModal] = useState(false);
  const address = walletType === "evm" ? evmAddress : stellarAddress;
  const displayAddress = address ? truncateAddress(address) : "";

  const handleDisconnect = () => {
    if (walletType === "evm") {
      disconnectEvm();
    } else {
      void disconnectStellar();
    }
  };

  // EVM connected: use RainbowKit ConnectButton
  if (isEvmConnected && evmAddress) {
    return (
      <div className="flex items-center gap-2">
        <ConnectButton chainStatus="icon" showBalance={false} />
      </div>
    );
  }

  // Stellar connected: only address + Disconnect (no Fund Account, no Testnet pill)
  if (isStellarConnected && stellarAddress) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="rounded-full bg-[#081F5C]/10 px-3 py-1.5 text-sm font-medium text-[#081F5C]"
          title={stellarAddress}
        >
          {displayAddress}
        </span>
        <button
          type="button"
          onClick={handleDisconnect}
          className="rounded-full bg-[#081F5C] px-4 py-2 text-sm font-medium text-[#FFF9F0] transition-colors hover:bg-[#334EAC]"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Not connected: single "Connect wallet" button → opens modal to choose EVM or Stellar
  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="rounded-full bg-[#081F5C] px-5 py-2.5 text-sm font-medium text-[#FFF9F0] shadow-lg transition-colors hover:bg-[#334EAC]"
      >
        Connect wallet
      </button>
      <ConnectWalletModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
};
