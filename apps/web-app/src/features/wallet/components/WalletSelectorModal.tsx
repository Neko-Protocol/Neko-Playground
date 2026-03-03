"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { useNotification } from "@/hooks/useNotification";
import { ConnectedWalletView } from "./ConnectedWalletView";
import { DisconnectedWalletView } from "./DisconnectedWalletView";

interface WalletSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletSelectorModal: React.FC<WalletSelectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { address: stellarAddress } = useWallet();
  const { connect: connectStellar, disconnect: disconnectStellar } =
    useStellarWallet();
  const { addNotification } = useNotification();
  const [isConnectingStellar, setIsConnectingStellar] = useState(false);
  const [copied, setCopied] = useState(false);
  const prevStellarStateRef = useRef(!!stellarAddress);

  // Snapshot wallet state when the modal opens so the second effect can
  // detect new connections made while the modal was visible.
  useEffect(() => {
    if (isOpen) {
      prevStellarStateRef.current = !!stellarAddress;
    }
  }, [isOpen, stellarAddress]);

  useEffect(() => {
    if (!isOpen) return;

    const newStellarConnection =
      !!stellarAddress && !prevStellarStateRef.current;

    if (newStellarConnection) {
      prevStellarStateRef.current = !!stellarAddress;

      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, stellarAddress, onClose]);

  const handleConnectStellar = async () => {
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
      addNotification("Address copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  if (!isOpen) return null;

  const isConnected = !!stellarAddress;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-md bg-white border border-gray-300 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          isConnected ? "wallet-connected-title" : "connect-wallet-title"
        }
      >
        {isConnected ? (
          <ConnectedWalletView
            stellarAddress={stellarAddress ?? undefined}
            onDisconnect={handleDisconnect}
            onCopyAddress={handleCopyAddress}
            copied={copied}
            onClose={onClose}
          />
        ) : (
          <DisconnectedWalletView
            onConnectStellar={() => void handleConnectStellar()}
            isConnectingStellar={isConnectingStellar}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
};
