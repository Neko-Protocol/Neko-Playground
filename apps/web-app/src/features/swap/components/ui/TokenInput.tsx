import React from "react";
import { formatSwapAmount } from "@/lib/helpers/swapUtils";
import type { Token } from "@/lib/helpers/soroswap";
import type { EVMToken } from "@/lib/types/evmToken";

export type SwapMode = "evm" | "stellar";

interface TokenInputProps {
  type: "from" | "to";
  label: string;
  amount: string;
  onAmountChange: (amount: string) => void;
  token: Token | string | EVMToken;
  onTokenClick: () => void;
  balance?: string;
  isLoadingBalance?: boolean;
  usdValue?: string;
  isLoadingPrice?: boolean;
  isLoadingQuote?: boolean;
  swapMode: SwapMode;
  chainIcon?: string | null;
  getTokenId: (token: Token | string | EVMToken) => string;
  getTokenIconUrl: (token: Token | string | EVMToken) => string | null;
  onMaxClick?: () => void;
  disabled?: boolean;
  showSwapWarning?: boolean;
  swapWarningComponent?: React.ReactNode;
}

export const TokenInput: React.FC<TokenInputProps> = ({
  type,
  label,
  amount,
  onAmountChange,
  token,
  onTokenClick,
  balance,
  isLoadingBalance,
  usdValue,
  isLoadingPrice,
  isLoadingQuote,
  swapMode,
  chainIcon,
  getTokenId,
  getTokenIconUrl,
  onMaxClick,
  disabled = false,
  showSwapWarning = false,
  swapWarningComponent,
}) => {
  const isFrom = type === "from";

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    const parts = value.split(".");
    const formattedValue =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : value;
    onAmountChange(formattedValue);
  };

  return (
    <div className={isFrom ? "-mb-5" : "-mt-4"}>
      <div
        className={`bg-gray-900/50 border border-gray-700 rounded-xl p-4 ${
          isFrom ? "pb-0 h-32" : "h-32"
        } relative`}
      >
        <label className="text-sm font-semibold text-gray-400 block mb-3">
          {label}
        </label>

        {isFrom ? (
          <div
            className="relative overflow-hidden"
            style={{
              height: "70px",
              marginBottom: "15px",
              marginTop: "-8px",
            }}
          >
            {(!amount || parseFloat(amount) === 0) && (
              <div className="absolute pointer-events-none text-4xl font-semibold leading-tight text-gray-400 top-0 mt-2.5">
                0
              </div>
            )}
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
              className={`w-full bg-transparent border-none outline-none text-white focus:ring-0 p-0 m-0 leading-tight absolute ${
                amount && parseFloat(amount) > 0
                  ? "text-5xl sm:text-6xl font-bold"
                  : "text-4xl font-semibold text-transparent"
              }`}
              style={{
                height: "55px",
                top: "0",
                paddingTop: "4px",
                maxWidth: "calc(100% - 140px)",
                fontSize:
                  amount && amount.length > 12
                    ? "clamp(1.5rem, 4vw, 3rem)"
                    : undefined,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              disabled={disabled}
            />
            {amount && parseFloat(amount) > 0 && (
              <p
                className="text-sm text-gray-400 absolute left-0"
                style={{ top: "38px" }}
              >
                {isLoadingPrice ? "≈ $..." : `≈ $${usdValue || "0.00"}`}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 -mt-2">
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="text-3xl font-bold text-white min-h-12 flex items-center gap-2">
                {isLoadingQuote ? (
                  <span className="text-gray-400 text-sm animate-pulse">
                    Loading...
                  </span>
                ) : amount && amount !== "0.0" ? (
                  <>
                    <span className="truncate">
                      {formatSwapAmount(amount, 6)}
                    </span>
                    {showSwapWarning && swapWarningComponent}
                  </>
                ) : (
                  "0"
                )}
              </div>
              {amount && amount !== "0.0" && (
                <p className="text-sm text-gray-400 -mt-1">
                  {isLoadingPrice ? "≈ $..." : `≈ $${usdValue || "0.00"}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Token Selector Button */}
        <div
          className="flex items-center justify-end absolute right-3"
          style={
            isFrom
              ? { top: "25px" }
              : { top: "50%", transform: "translateY(-50%)" }
          }
        >
          <button
            onClick={onTokenClick}
            disabled={disabled}
            className={`flex items-center gap-2 bg-[#334EAC] hover:bg-[#3351aca5] text-white ${
              isFrom ? "px-4 py-2.5" : "px-5 py-3"
            } rounded-xl font-semibold transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${!isFrom ? "text-sm" : ""}`}
          >
            <div className="relative">
              {getTokenIconUrl(token) ? (
                <img
                  src={getTokenIconUrl(token)!}
                  alt={getTokenId(token)}
                  className={`${isFrom ? "w-5 h-5" : "w-6 h-6"} rounded-full object-contain`}
                />
              ) : (
                <div
                  className={`${isFrom ? "w-5 h-5" : "w-6 h-6"} rounded-full bg-white/20 flex items-center justify-center text-xs font-bold`}
                >
                  {getTokenId(token)[0] || "?"}
                </div>
              )}
              {swapMode === "evm" && chainIcon && (
                <img
                  src={chainIcon}
                  alt="chain"
                  className={`absolute -bottom-0.5 -right-0.5 ${
                    isFrom ? "w-2.5 h-2.5" : "w-3 h-3"
                  } rounded-full border border-[#334EAC] object-contain bg-white`}
                />
              )}
            </div>
            <span>{getTokenId(token) || (isFrom ? "" : "Select token")}</span>
            <svg
              width={isFrom ? "12" : "14"}
              height={isFrom ? "12" : "14"}
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Balance (only for "from" input) */}
        {isFrom && (
          <div
            className="text-xs text-gray-400 text-right absolute right-3"
            style={{ bottom: "25px" }}
          >
            Balance:{" "}
            {isLoadingBalance ? "..." : formatSwapAmount(balance || "0", 6)}{" "}
            {onMaxClick && (
              <button
                onClick={onMaxClick}
                disabled={
                  !balance ||
                  parseFloat(balance) <= 0 ||
                  isLoadingBalance ||
                  disabled
                }
                className="text-[#415ab5] hover:text-[#3351aca5] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Max
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
