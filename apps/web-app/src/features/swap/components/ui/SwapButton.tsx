import React from "react";

export type OrderType = "swap" | "limit" | "twap";

interface SwapButtonProps {
  address: string | undefined;
  canGetQuote: boolean;
  isLoading: boolean;
  txHash: string | null;
  isLoadingQuote: boolean;
  orderType: OrderType;
  onClick: () => void;
}

const baseClass =
  "w-full font-bold py-4 text-base rounded-2xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

export const SwapButton: React.FC<SwapButtonProps> = ({
  address,
  canGetQuote,
  isLoading,
  txHash,
  isLoadingQuote,
  orderType,
  onClick,
}) => {
  if (!address) {
    return (
      <button disabled className={`${baseClass} bg-white/10 text-white/40`}>
        Connect Wallet
      </button>
    );
  }

  if (orderType !== "swap") {
    return (
      <button disabled className={`${baseClass} bg-white/10 text-white/40`}>
        Coming soon
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

  const label = txHash
    ? "Swap Completed!"
    : isLoading
      ? "Processing..."
      : "Swap";

  return (
    <button
      onClick={onClick}
      disabled={isLoading || !!txHash || isLoadingQuote}
      className={`${baseClass} bg-[#229EDF] hover:bg-[#1a8bc7] text-white shadow-lg shadow-[#229EDF]/20`}
    >
      {label}
    </button>
  );
};
