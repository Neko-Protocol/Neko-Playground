import React from "react";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import type { EVMToken } from "@/lib/types/evmToken";

interface LimitOrderFormProps {
  limitPrice: string;
  onLimitPriceChange: (price: string) => void;
  tokenOut: Token | string | EVMToken;
  getTokenId: (token: Token | string | EVMToken) => string;
}

export const LimitOrderForm: React.FC<LimitOrderFormProps> = ({
  limitPrice,
  onLimitPriceChange,
  tokenOut,
  getTokenId,
}) => {
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    const parts = value.split(".");
    const formattedValue =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value;
    onLimitPriceChange(formattedValue);
  };

  return (
    <div className="mt-4">
      <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
        <label className="text-sm font-semibold text-gray-400 block mb-3">
          Limit Price (per {getTokenId(tokenOut)})
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={limitPrice}
          onChange={handlePriceChange}
          placeholder="0.0"
          className="w-full bg-transparent text-white text-2xl font-bold outline-none placeholder-gray-500"
        />
        <div className="text-xs text-gray-400 mt-2">
          Minimum price you're willing to accept
        </div>
      </div>
    </div>
  );
};
