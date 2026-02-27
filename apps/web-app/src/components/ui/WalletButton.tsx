"use client";

import React, { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDisconnect } from "wagmi";
import { useStellarWallet, useWalletType } from "@/hooks";
import { ConnectWalletModal } from "@/features/wallet/components/ConnectWalletModal";
import { truncateAddress } from "@/lib/utils";

const primaryButton =
  "rounded-full bg-[#081F5C] text-sm font-medium text-[#FFF9F0] transition-colors hover:bg-[#334EAC]";

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
  const displayAddress = stellarAddress ? truncateAddress(stellarAddress) : "";

  const handleDisconnect = () => {
    if (walletType === "evm") {
      disconnectEvm();
    } else {
      void disconnectStellar();
    }
  };

  if (isEvmConnected && evmAddress) {
    return (
      <div className="flex items-center gap-2">
        <ConnectButton chainStatus="icon" showBalance={false} />
      </div>
    );
  }

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
          className={`${primaryButton} px-4 py-2`}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={`${primaryButton} px-5 py-2.5 shadow-lg`}
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
