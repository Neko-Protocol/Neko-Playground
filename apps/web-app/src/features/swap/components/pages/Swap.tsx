"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { ChevronDown, ArrowLeftRight } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import {
  getTokens,
  getAvailableTokens,
  type Token,
} from "@/lib/helpers/stellar/soroswap";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import {
  sanitizeAmountInput,
  formatSwapAmount,
} from "@/lib/helpers/tokenUtils";
import { BannerPage } from "@/components/ui/BannerPage";
import TokenSelectorModal from "../ui/TokenSelectorModal";

// Hooks
import { useSwapState } from "../../hooks/useSwapState";
import { useTokenSelection } from "../../hooks/useTokenSelection";
import { useSwapQuote } from "../../hooks/useSwapQuote";
import { useSwapExecution } from "../../hooks/useSwapExecution";
import { useSwapPrices } from "../../hooks/useSwapPrices";

// UI Components
import { SwapButton } from "../ui/SwapButton";
import { TransactionResult } from "../ui/TransactionResult";
import { SwapValueWarning } from "../ui/SwapValueWarning";
import { OrderTypeTabs } from "../ui/OrderTypeTabs";

interface TokenSelectorBtnProps {
  token: Token | string;
  getTokenId: (t: Token | string) => string;
  getTokenIconUrl: (t: Token | string) => string | null;
  onClick: () => void;
  disabled?: boolean;
}

const TokenSelectorBtn: React.FC<TokenSelectorBtnProps> = ({
  token,
  getTokenId,
  getTokenIconUrl,
  onClick,
  disabled,
}) => {
  const iconUrl = getTokenIconUrl(token);
  const tokenId = getTokenId(token);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2.5 bg-[#2A2A2A] hover:bg-[#333] rounded-xl px-3.5 py-2.5 w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="relative shrink-0">
        {iconUrl ? (
          <Image
            src={iconUrl}
            alt={tokenId}
            width={22}
            height={22}
            unoptimized
            className="rounded-full object-contain"
          />
        ) : (
          <div className="w-[22px] h-[22px] rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">
            {tokenId[0] || "?"}
          </div>
        )}
      </div>
      <span className="text-white font-medium text-sm truncate">
        {tokenId || "Select token"}
      </span>
      <ChevronDown className="ml-auto h-4 w-4 text-white/40 shrink-0" />
    </button>
  );
};

interface BalanceCardProps {
  balance?: string;
  usdValue?: string;
  isLoadingBalance?: boolean;
  isLoadingPrice?: boolean;
  onMaxClick?: () => void;
  isReadOnly?: boolean;
}

const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  usdValue,
  isLoadingBalance,
  isLoadingPrice,
  onMaxClick,
  isReadOnly,
}) => (
  <div className="bg-[#252525] rounded-xl p-3.5">
    <div className="text-white font-bold text-xl">
      {isLoadingPrice ? (
        <span className="text-white/40 text-sm animate-pulse">Loading…</span>
      ) : (
        <>
          {usdValue || "0.00"}{" "}
          <span className="text-white/40 text-xs font-normal">USD</span>
        </>
      )}
    </div>
    <div className="flex items-center justify-between mt-1">
      <span className="text-white/40 text-xs">Your balance</span>
      <button
        onClick={isReadOnly ? undefined : onMaxClick}
        disabled={
          isReadOnly || !balance || parseFloat(balance) <= 0 || isLoadingBalance
        }
        className={`text-xs transition-colors ${
          isReadOnly
            ? "invisible"
            : "text-white/40 hover:text-white/70 disabled:cursor-not-allowed"
        }`}
      >
        {isLoadingBalance
          ? "..."
          : `${formatSwapAmount(balance || "0", 6)} Max`}
      </button>
    </div>
  </div>
);

const Swap: React.FC = () => {
  const { address, network, networkPassphrase } = useWallet();

  // Get available tokens for current network
  const availableTokens = getAvailableTokens();
  const tokenCodes = Object.keys(availableTokens);
  const tokens = getTokens();

  // Initialize with first available tokens
  const defaultTokenIn =
    availableTokens[tokenCodes[0]]?.contract || tokens.XLM || "";
  const defaultTokenOut =
    availableTokens[tokenCodes[1]]?.contract || tokens.USDC || "";

  // Swap state management
  const swapState = useSwapState(defaultTokenIn, defaultTokenOut);
  const {
    orderType,
    amountIn,
    amountOut,
    tokenIn,
    tokenOut,
    txHash,
    error,
    isLoading,
    setOrderType,
    setAmountIn,
    setTxHash,
    setError,
    setIsLoading,
    resetSwap,
    swapTokens,
  } = swapState;

  // Token selection management
  const tokenSelection = useTokenSelection(
    tokenIn,
    tokenOut,
    swapState.setTokenIn,
    swapState.setTokenOut,
    resetSwap,
    setTxHash
  );
  const {
    tokenSelectorOpen,
    tokenSelectorType,
    openTokenSelector,
    closeTokenSelector,
    selectToken,
    getTokenId,
    getTokenIconUrl,
  } = tokenSelection;

  // Get token balance for "from" token
  const { balance: tokenInBalance, isLoading: isLoadingBalance } =
    useTokenBalance(tokenIn as Token | string | undefined);

  // Swap quote management
  const { amountOut: quoteAmountOut, isLoadingQuote } = useSwapQuote(
    address,
    amountIn,
    tokenIn,
    tokenOut
  );

  // Update amountOut from quote
  useEffect(() => {
    if (quoteAmountOut) {
      swapState.setAmountOut(quoteAmountOut);
    }
  }, [quoteAmountOut, swapState]);

  // Prices and USD values
  const {
    usdValue,
    usdValueOut,
    isLoadingPrice,
    isLoadingOutPrice,
    swapValueAnalysis,
  } = useSwapPrices(amountIn, amountOut, tokenIn, tokenOut);

  // Swap execution
  const { executeSwap } = useSwapExecution();

  // Handle swap execution
  const handleSwap = async () => {
    if (!amountIn || parseFloat(amountIn) <= 0 || !address) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await executeSwap({
        amountIn,
        tokenIn,
        tokenOut,
        address,
        networkPassphrase,
      });

      if (result.orderId) {
        setTxHash(result.orderId);
        resetSwap();
        setAmountIn("");
        swapState.setAmountOut("0.0");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "USER_REJECTED") {
        setIsLoading(false);
        return;
      }

      const errorMessage =
        extractContractErrorOrNull(error, "rwa-perps") ||
        (error instanceof Error ? error.message : "Failed to complete swap");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAmountChange = (value: string) => {
    setAmountIn(value);
    resetSwap();
    setTxHash(null);
  };

  const handleMaxClick = () => {
    if (tokenInBalance && parseFloat(tokenInBalance) > 0) {
      setAmountIn(tokenInBalance);
    }
  };

  const canGetQuote = address && amountIn && parseFloat(amountIn) > 0;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Banner */}
      <BannerPage
        title="Swap Currency"
        subtitle="Select an option and swap your currencies"
        badge="Conversion"
        imageSrc="/banners/swap.svg"
        imageAlt="Swap illustration"
        className="mb-6"
      />

      {/* Order type controls */}
      <div className="flex flex-col gap-3 mb-5">
        <OrderTypeTabs orderType={orderType} onOrderTypeChange={setOrderType} />
      </div>

      {/* Wallet alert */}
      {!address && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5 text-center text-white/60 text-sm">
          Connect your wallet to start swapping
        </div>
      )}

      {/* Two-panel swap interface */}
      <div className="relative">
        <div className="grid grid-cols-2 gap-4">
          {/* From panel */}
          <div className="bg-[#1C1C1C] rounded-[20px] p-5 flex flex-col gap-4">
            <span className="text-white/50 text-sm font-medium">From</span>

            <TokenSelectorBtn
              token={tokenIn}
              getTokenId={getTokenId}
              getTokenIconUrl={getTokenIconUrl}
              onClick={() => openTokenSelector("from")}
              disabled={!address || isLoading}
            />

            <div>
              <span className="text-white/50 text-sm font-semibold block mb-2">
                Amount
              </span>
              <div className="bg-[#2A2A2A] rounded-xl px-4 h-14 flex items-center">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountIn}
                  onChange={(e) =>
                    handleAmountChange(sanitizeAmountInput(e.target.value))
                  }
                  placeholder="0.00"
                  disabled={!address || isLoading}
                  className="bg-transparent text-white text-3xl font-bold w-full outline-none placeholder:text-white/30 disabled:opacity-50"
                />
              </div>
            </div>

            <BalanceCard
              balance={tokenInBalance}
              usdValue={usdValue}
              isLoadingBalance={isLoadingBalance}
              isLoadingPrice={isLoadingPrice}
              onMaxClick={handleMaxClick}
            />
          </div>

          {/* To panel */}
          <div className="bg-[#1C1C1C] rounded-[20px] p-5 flex flex-col gap-4">
            <span className="text-white/50 text-sm font-medium">To</span>

            <TokenSelectorBtn
              token={tokenOut}
              getTokenId={getTokenId}
              getTokenIconUrl={getTokenIconUrl}
              onClick={() => openTokenSelector("to")}
              disabled={!address || isLoading}
            />

            <div>
              <span className="text-white/50 text-sm font-semibold block mb-2">
                Amount
              </span>
              <div className="bg-[#2A2A2A] rounded-xl px-4 h-14 flex items-center gap-2">
                {isLoadingQuote ? (
                  <span className="text-white/40 text-sm animate-pulse">
                    Loading…
                  </span>
                ) : (
                  <span className="text-white text-3xl font-bold">
                    {amountOut && amountOut !== "0.0"
                      ? formatSwapAmount(amountOut, 6)
                      : "0.00"}
                  </span>
                )}
                {swapValueAnalysis?.isSuspiciouslyLow && (
                  <SwapValueWarning
                    analysis={swapValueAnalysis}
                    isLoadingPrice={isLoadingOutPrice}
                  />
                )}
              </div>
            </div>

            <BalanceCard
              usdValue={usdValueOut}
              isLoadingPrice={isLoadingOutPrice}
              isReadOnly
            />
          </div>
        </div>

        {/* Centered swap direction button */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <button
            onClick={swapTokens}
            disabled={isLoading}
            aria-label="Swap tokens"
            className="bg-[#229EDF] hover:bg-[#1a8bc7] text-white p-3 rounded-full shadow-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeftRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Primary CTA */}
      <div className="mt-5">
        <SwapButton
          address={address}
          canGetQuote={!!canGetQuote}
          isLoading={isLoading}
          txHash={txHash}
          isLoadingQuote={isLoadingQuote}
          orderType={orderType}
          onClick={handleSwap}
        />
      </div>

      {/* Transaction result */}
      {txHash && (
        <TransactionResult
          txHash={txHash}
          network={network}
          orderType={orderType}
        />
      )}

      <TokenSelectorModal
        isOpen={tokenSelectorOpen}
        onClose={closeTokenSelector}
        onSelectToken={selectToken}
        selectedToken={
          (tokenSelectorType === "from" ? tokenIn : tokenOut) as Token | string
        }
      />
    </div>
  );
};

export default Swap;
