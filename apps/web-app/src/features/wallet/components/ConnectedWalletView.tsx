"use client";

import React from "react";
import { Copy, Check } from "lucide-react";
import { ModalCloseButton } from "./ModalCloseButton";

interface ConnectedWalletViewProps {
  evmAddress: string | undefined;
  stellarAddress: string | undefined;
  isEvmConnected: boolean;
  onManageWallet: () => void;
  onDisconnect: () => void;
  onCopyAddress: (address: string) => void;
  copied: boolean;
  onClose: () => void;
}

export const ConnectedWalletView: React.FC<ConnectedWalletViewProps> = ({
  evmAddress,
  stellarAddress,
  isEvmConnected,
  onManageWallet,
  onDisconnect,
  onCopyAddress,
  copied,
  onClose,
}) => {
  const connectedAddress = evmAddress || stellarAddress;
  const walletType = isEvmConnected ? "EVM" : "Stellar";
  const indicatorColor = isEvmConnected
    ? "bg-green-500"
    : "bg-[var(--color-neko-teal)]";

  return (
    <>
      <div className="flex items-center justify-between p-6 border-b border-gray-300">
        <h2 className="text-xl font-bold text-gray-900">Wallet Connected</h2>
        <ModalCloseButton onClick={onClose} />
      </div>
      <div className="p-6">
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-300">
          <div
            className={`w-3 h-3 rounded-full ${indicatorColor}`}
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900">
              {walletType} Wallet
            </div>
            <div className="text-xs font-mono text-gray-600 mt-1 break-all">
              {connectedAddress}
            </div>
          </div>
          {stellarAddress && (
            <button
              type="button"
              onClick={() => onCopyAddress(connectedAddress || "")}
              className="shrink-0 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
              title={copied ? "Copied!" : "Copy address"}
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          {isEvmConnected && (
            <button
              type="button"
              onClick={onManageWallet}
              className="flex-1 bg-[var(--color-neko-border)] hover:bg-[var(--color-neko-navy)] text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
            >
              Manage Wallet
            </button>
          )}
          <button
            type="button"
            onClick={() => void onDisconnect()}
            className={`${
              isEvmConnected ? "flex-1" : "w-full"
            } bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm`}
          >
            Disconnect
          </button>
        </div>
      </div>
    </>
  );
};
