import React from "react";
import { Warning } from "@mui/icons-material";

export type OrderType = "swap" | "limit" | "twap";

interface SwapButtonProps {
  address: string | undefined;
  canGetQuote: boolean;
  swapMode: "evm" | "stellar";
  hasEnoughGas: boolean;
  isLoadingGas: boolean;
  gasSymbol: string;
  isLoading: boolean;
  txHash: string | null;
  isLoadingQuote: boolean;
  orderType: OrderType;
  onClick: () => void;
}

export const SwapButton: React.FC<SwapButtonProps> = ({
  address,
  canGetQuote,
  swapMode,
  hasEnoughGas,
  isLoadingGas,
  gasSymbol,
  isLoading,
  txHash,
  isLoadingQuote,
  orderType,
  onClick,
}) => {
  const baseClass =
    "w-full font-bold py-4 text-base rounded-2xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

  if (!address) {
    return (
      <button disabled className={`${baseClass} bg-white/10 text-white/40`}>
        Connect Wallet
      </button>
    );
  }

  if (!canGetQuote) {
    return (
      <button disabled className={`${baseClass} bg-[#229EDF]/40 text-white/60`}>
        Enter Amount
      </button>
    );
  }

  if (swapMode === "evm" && !hasEnoughGas && !isLoadingGas) {
    return (
      <button
        disabled
        className={`${baseClass} bg-red-500/20 text-red-400 border border-red-500/30`}
      >
        <Warning className="w-5 h-5" />
        Insufficient {gasSymbol} for Gas
      </button>
    );
  }

  const getButtonText = () => {
    if (txHash) {
      return `${orderType === "swap" ? "Swap" : "Limit Order"} Completed!`;
    }
    if (isLoading) return "Processing...";
    if (orderType === "swap") return "Swap";
    return "Place Limit Order";
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading || !!txHash || isLoadingQuote}
      className={`${baseClass} bg-[#229EDF] hover:bg-[#1a8bc7] text-white shadow-lg shadow-[#229EDF]/20`}
    >
      {getButtonText()}
    </button>
  );
};
