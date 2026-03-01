import React from "react";

export type OrderType = "swap" | "limit" | "twap";
export type SwapMode = "stellar" | "evm";

interface OrderTypeTabsProps {
  orderType: OrderType;
  onOrderTypeChange: (type: OrderType) => void;
  swapMode?: SwapMode;
}

export const OrderTypeTabs: React.FC<OrderTypeTabsProps> = ({
  orderType,
  onOrderTypeChange,
  swapMode = "stellar",
}) => {
  // Limit orders are only available for EVM wallets (CoW Swap)
  const isLimitDisabled = swapMode === "stellar";

  return (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => onOrderTypeChange("swap")}
        className={`px-5 py-2.5 text-base font-semibold rounded-lg transition-colors ${
          orderType === "swap"
            ? "text-white bg-[#229EDF]"
            : "text-gray-400 hover:text-gray-300"
        }`}
      >
        Swap
      </button>
      <button
        onClick={() => !isLimitDisabled && onOrderTypeChange("limit")}
        disabled={isLimitDisabled}
        className={`px-5 py-2.5 text-base font-semibold rounded-lg transition-colors ${
          isLimitDisabled
            ? "text-gray-500 cursor-not-allowed opacity-50"
            : orderType === "limit"
              ? "text-white bg-[#229EDF]"
              : "text-gray-400 hover:text-gray-300"
        }`}
        title={isLimitDisabled ? "Limit orders are only available with EVM wallets" : undefined}
      >
        Limit
      </button>
      <button
        disabled
        className="px-5 py-2.5 font-semibold text-gray-500 rounded-lg cursor-not-allowed opacity-50"
        title="TWAP orders coming soon"
      >
        TWAP
      </button>
    </div>
  );
};
