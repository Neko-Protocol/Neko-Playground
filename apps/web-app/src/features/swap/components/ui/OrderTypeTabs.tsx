import React from "react";

export type OrderType = "swap" | "limit" | "twap";

interface OrderTypeTabsProps {
  orderType: OrderType;
  onOrderTypeChange: (type: OrderType) => void;
}

export const OrderTypeTabs: React.FC<OrderTypeTabsProps> = ({
  orderType,
  onOrderTypeChange,
}) => {
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
        disabled
        className="px-5 py-2.5 text-base font-semibold rounded-lg text-gray-600 cursor-not-allowed opacity-40"
        title="Coming soon"
      >
        Limit
      </button>
      <button
        disabled
        className="px-5 py-2.5 text-base font-semibold rounded-lg text-gray-600 cursor-not-allowed opacity-40"
        title="Coming soon"
      >
        TWAP
      </button>
    </div>
  );
};
