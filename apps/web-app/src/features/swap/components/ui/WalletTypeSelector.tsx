import React from "react";

export type SwapMode = "evm" | "stellar";

interface WalletTypeSelectorProps {
  swapMode: SwapMode;
  onSwapModeChange: (mode: SwapMode) => void;
  isEvmConnected: boolean;
  isStellarConnected: boolean;
}

export const WalletTypeSelector: React.FC<WalletTypeSelectorProps> = ({
  swapMode,
  onSwapModeChange,
  isEvmConnected,
  isStellarConnected,
}) => {
  // Only show if both wallet types are available
  if (!isEvmConnected && !isStellarConnected) {
    return null;
  }

  return (
    <div className="flex gap-2 mb-4 p-1 bg-gray-800 rounded-lg">
      <button
        onClick={() => onSwapModeChange("stellar")}
        disabled={!isStellarConnected}
        className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
          swapMode === "stellar"
            ? "bg-[#229EDF] text-white"
            : "text-gray-400 hover:text-gray-300"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        Stellar
      </button>
      <button
        onClick={() => onSwapModeChange("evm")}
        disabled={!isEvmConnected}
        className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
          swapMode === "evm"
            ? "bg-[#229EDF] text-white"
            : "text-gray-400 hover:text-gray-300"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        EVM
      </button>
    </div>
  );
};
