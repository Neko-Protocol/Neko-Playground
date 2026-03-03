"use client";

import React from "react";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { useWalletType } from "@/hooks/useWalletType";
import { truncateAddress } from "@/lib/utils";

const primaryButton =
  "rounded-full bg-[var(--color-neko-navy)] text-sm font-medium text-[var(--color-neko-cream)] transition-colors hover:bg-[var(--color-neko-border)]";

export const WalletButton: React.FC = () => {
  const { isStellarConnected, stellarAddress } = useWalletType();
  const { connect, disconnect: disconnectStellar } = useStellarWallet();
  const displayAddress = stellarAddress ? truncateAddress(stellarAddress) : "";

  if (isStellarConnected && stellarAddress) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="rounded-full bg-[var(--color-neko-navy)]/10 px-3 py-1.5 text-sm font-medium text-[var(--color-neko-navy)]"
          title={stellarAddress}
        >
          {displayAddress}
        </span>
        <button
          type="button"
          onClick={() => void disconnectStellar()}
          className={`${primaryButton} px-4 py-2`}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void connect()}
      className={`${primaryButton} px-5 py-2.5 shadow-lg`}
    >
      Connect wallet
    </button>
  );
};
