"use client";

import { useState, useEffect, useRef } from "react";
import { ConnectButton, useAccountModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { useWallet } from "@/hooks/useWallet";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { Copy, Check } from "lucide-react";

interface WalletSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletSelectorModal: React.FC<WalletSelectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isConnected: isEvmConnected, address: evmAddress } = useAccount();
  const { address: stellarAddress } = useWallet();
  const { connect: connectStellar, disconnect: disconnectStellar } =
    useStellarWallet();
  const { openAccountModal } = useAccountModal();
  const { disconnect: disconnectEvm } = useDisconnect();
  const [isConnectingStellar, setIsConnectingStellar] = useState(false);
  const [copied, setCopied] = useState(false);
  const prevEvmStateRef = useRef(isEvmConnected);
  const prevStellarStateRef = useRef(!!stellarAddress);

  useEffect(() => {
    if (isOpen) {
      prevEvmStateRef.current = isEvmConnected;
      prevStellarStateRef.current = !!stellarAddress;
    } else {
      setIsConnectingStellar(false);
    }
  }, [isOpen, isEvmConnected, stellarAddress]);

  useEffect(() => {
    if (!isOpen) return;

    const newEvmConnection = isEvmConnected && !prevEvmStateRef.current;
    const newStellarConnection =
      !!stellarAddress && !prevStellarStateRef.current;

    if (newEvmConnection || newStellarConnection) {
      prevEvmStateRef.current = isEvmConnected;
      prevStellarStateRef.current = !!stellarAddress;

      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isEvmConnected, stellarAddress, onClose]);

  const handleConnectStellar = async () => {
    if (isEvmConnected) {
      alert(
        "Please disconnect your EVM wallet first before connecting a Stellar wallet."
      );
      return;
    }
    setIsConnectingStellar(true);
    try {
      await connectStellar();
    } catch (error) {
      console.error("Failed to connect Stellar wallet:", error);
      setIsConnectingStellar(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (isEvmConnected) {
        disconnectEvm();
      }
      if (stellarAddress) {
        await disconnectStellar();
      }
      onClose();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      onClose();
    }
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  if (!isOpen) return null;

  if (isEvmConnected || stellarAddress) {
    const connectedAddress = evmAddress || stellarAddress;
    const walletType = isEvmConnected ? "EVM" : "Stellar";
    const indicatorColor = isEvmConnected ? "bg-green-500" : "bg-[#39bfb7]";

    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="relative w-full max-w-md bg-white border border-gray-300 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-300">
              <h2 className="text-xl font-bold text-gray-900">
                Wallet Connected
              </h2>
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 transition-colors p-1.5 rounded-lg hover:bg-gray-200"
                aria-label="Close"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 5L5 15M5 5l10 10" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-300">
                <div className={`w-3 h-3 rounded-full ${indicatorColor}`}></div>
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
                    onClick={() => handleCopyAddress(connectedAddress || "")}
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
                {isEvmConnected && openAccountModal && (
                  <button
                    onClick={() => {
                      openAccountModal();
                      onClose();
                    }}
                    className="flex-1 bg-[#334EAC] hover:bg-[#081F5C] text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
                  >
                    Manage Wallet
                  </button>
                )}
                <button
                  onClick={() => void handleDisconnect()}
                  className={`${
                    isEvmConnected && openAccountModal ? "flex-1" : "w-full"
                  } bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm`}
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md bg-white border border-gray-300 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-300">
          <h2 className="text-xl font-bold text-gray-900">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 transition-colors p-1.5 rounded-lg hover:bg-gray-200"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
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
                void handleConnectStellar();
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
      </div>
    </div>
  );
};
