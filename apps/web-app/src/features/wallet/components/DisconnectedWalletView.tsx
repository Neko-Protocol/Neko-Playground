"use client";

import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { ModalCloseButton } from "./ModalCloseButton";

interface DisconnectedWalletViewProps {
  onConnectEVM: () => void;
  onConnectStellar: () => void;
  isConnectingStellar: boolean;
  isEvmConnected: boolean;
  stellarAddress: string | undefined;
  onClose: () => void;
}

export const DisconnectedWalletView: React.FC<DisconnectedWalletViewProps> = ({
  onConnectEVM,
  onConnectStellar,
  isConnectingStellar,
  isEvmConnected,
  stellarAddress,
  onClose,
}) => (
  <>
    <div className="flex items-center justify-between p-6 border-b border-gray-300">
      <h2 className="text-xl font-bold text-gray-900">Connect Wallet</h2>
      <ModalCloseButton onClick={onClose} />
    </div>
    <div className="p-6 space-y-4 flex flex-col items-center">
      <ConnectButton.Custom>
        {({ openConnectModal, mounted }) => {
          const ready = mounted;
          const isDisabled = !ready || !!stellarAddress;
          return (
            <HoverBorderGradient
              containerClassName="rounded-full w-[240px]"
              as="button"
              className="dark:bg-black bg-white text-black dark:text-white flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                if (!isDisabled) {
                  openConnectModal();
                }
              }}
              disabled={isDisabled}
            >
              <img
                src="/crypto/png/ethereum-eth-logo.png"
                alt="Ethereum"
                className="w-6 h-6 shrink-0"
              />
              <span className="whitespace-nowrap">Connect EVM Wallet</span>
            </HoverBorderGradient>
          );
        }}
      </ConnectButton.Custom>

      <HoverBorderGradient
        containerClassName="rounded-full w-[240px]"
        as="button"
        className="dark:bg-black bg-white text-black dark:text-white flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          if (!isConnectingStellar && !isEvmConnected) {
            onConnectStellar();
          }
        }}
        disabled={isConnectingStellar || isEvmConnected}
      >
        <img
          src="/crypto/png/stellar-xlm-logo.png"
          alt="Stellar"
          className="w-6 h-6 shrink-0"
        />
        <span className="whitespace-nowrap">
          {isConnectingStellar ? "Connecting..." : "Connect Stellar Wallet"}
        </span>
      </HoverBorderGradient>
    </div>
  </>
);
