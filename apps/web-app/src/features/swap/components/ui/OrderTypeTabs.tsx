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
  const tabClass = (type: OrderType) =>
    `px-5 py-2.5 text-base font-semibold rounded-lg transition-colors ${
      orderType === type
        ? "text-white bg-[#229EDF]"
        : "text-gray-400 hover:text-gray-300"
    }`;

  return (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => onOrderTypeChange("swap")}
        className={tabClass("swap")}
      >
        Swap
      </button>
      <button
        onClick={() => onOrderTypeChange("limit")}
        className={tabClass("limit")}
      >
        Limit
      </button>
      <button
        onClick={() => onOrderTypeChange("twap")}
        className={tabClass("twap")}
      >
        TWAP
      </button>
    </div>
  );
};
