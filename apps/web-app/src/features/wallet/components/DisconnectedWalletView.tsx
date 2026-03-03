"use client";

import React from "react";
import Image from "next/image";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { ModalCloseButton } from "./ModalCloseButton";

interface DisconnectedWalletViewProps {
  onConnectStellar: () => void;
  isConnectingStellar: boolean;
  onClose: () => void;
}

export const DisconnectedWalletView: React.FC<DisconnectedWalletViewProps> = ({
  onConnectStellar,
  isConnectingStellar,
  onClose,
}) => (
  <>
    <div className="flex items-center justify-between p-6 border-b border-gray-300">
      <h2 className="text-xl font-bold text-gray-900">Connect Wallet</h2>
      <ModalCloseButton onClick={onClose} />
    </div>
    <div className="p-6 space-y-4 flex flex-col items-center">
      <HoverBorderGradient
        containerClassName="rounded-full w-[240px]"
        as="button"
        className="dark:bg-black bg-white text-black dark:text-white flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          if (!isConnectingStellar) {
            onConnectStellar();
          }
        }}
        disabled={isConnectingStellar}
      >
        <Image
          src="/crypto/png/stellar-xlm-logo.png"
          alt="Stellar"
          width={24}
          height={24}
          className="shrink-0"
        />
        <span className="whitespace-nowrap">
          {isConnectingStellar ? "Connecting..." : "Connect Stellar Wallet"}
        </span>
      </HoverBorderGradient>
    </div>
  </>
);
