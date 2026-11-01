"use client";

import React, { useEffect, useCallback } from "react";
import Image from "next/image";
import { ChevronDown, ArrowLeftRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { getTokenAddress } from "@/lib/helpers/stellar/soroswap";
import {
  getTokens,
  getAvailableTokens,
  type Token,
} from "@/lib/helpers/stellar/soroswap";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { formatSwapAmount } from "@/lib/helpers/tokenUtils";
import { getSpendableXlmAmount } from "../../utils/xlmSpendable";
import { AmountInput } from "@/components/AmountInput";
import { useToast } from "@/hooks/useToast";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import TokenSelectorModal from "../ui/TokenSelectorModal";

import { useSwapState } from "../../hooks/useSwapState";
import { useTokenSelection } from "../../hooks/useTokenSelection";
import { useSwapQuote } from "../../hooks/useSwapQuote";
import { useSwapExecution } from "../../hooks/useSwapExecution";
import { useSwapPrices } from "../../hooks/useSwapPrices";
import { useLimitOrders } from "../../hooks/useLimitOrders";
import { useLimitOrderMonitor } from "../../hooks/useLimitOrderMonitor";

import { SwapButton } from "../ui/SwapButton";
import { TransactionResult } from "../ui/TransactionResult";
import { SwapValueWarning } from "../ui/SwapValueWarning";
import { OrderTypeTabs } from "../ui/OrderTypeTabs";
import { LimitOrderForm } from "../ui/LimitOrderForm";
import { OpenLimitOrdersPanel } from "../ui/OpenLimitOrdersPanel";

import type { LimitOrder } from "../../types/limitOrder";
import type { AddLimitOrderParams } from "../../hooks/useLimitOrders";

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
      className="flex items-center gap-3 bg-[#242424] hover:bg-[#2A2A2A] rounded-xl px-4 py-3 w-full transition-all duration-200 border border-white/5 hover:border-[#229EDF]/30 disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      <div className="relative shrink-0">
        {iconUrl ? (
          <Image
            src={iconUrl}
            alt={tokenId}
            width={28}
            height={28}
            unoptimized
            className="rounded-full object-contain"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-[#229EDF]/20 flex items-center justify-center text-xs font-bold text-[#229EDF]">
            {tokenId[0] || "?"}
          </div>
        )}
      </div>
      <span className="text-white font-semibold text-base truncate">
        {tokenId || "Select token"}
      </span>
      <ChevronDown className="ml-auto h-5 w-5 text-white/30 group-hover:text-[#229EDF] shrink-0 transition-colors" />
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
  <div className="bg-[#242424] rounded-xl p-4 border border-white/5">
    <div className="flex items-center justify-between">
      <span className="text-white/40 text-xs font-medium uppercase tracking-wider">
        Value
      </span>
      {!isReadOnly && (
        <button
          onClick={onMaxClick}
          disabled={!balance || parseFloat(balance) <= 0 || isLoadingBalance}
          className="text-xs font-semibold text-[#229EDF] hover:text-[#4ADE80] transition-colors disabled:text-white/30 disabled:cursor-not-allowed"
        >
          {isLoadingBalance ? "..." : "MAX"}
        </button>
      )}
    </div>
    <div className="text-white font-bold text-2xl mt-1">
      {isLoadingPrice ? (
        <span className="text-white/40 text-sm animate-pulse">Loading…</span>
      ) : (
        <>${usdValue || "0.00"}</>
      )}
    </div>
    <div className="flex items-center gap-1 mt-1">
      <span className="text-white/30 text-xs">Balance:</span>
      <span className="text-white/50 text-xs font-medium">
        {isLoadingBalance ? "..." : formatSwapAmount(balance || "0", 6)}
      </span>
    </div>
  </div>
);

const Swap: React.FC = () => {
  const { address, network, networkPassphrase, refetchBalances } = useWallet();
  const { addNotification } = useToast();
  const queryClient = useQueryClient();

  const availableTokens = getAvailableTokens();
  const tokenCodes = Object.keys(availableTokens);
  const tokens = getTokens();

  const defaultTokenIn =
    availableTokens[tokenCodes[0]]?.contract || tokens.XLM || "";
  const defaultTokenOut =
    availableTokens[tokenCodes[1]]?.contract || tokens.USDC || "";

  const swapState = useSwapState(defaultTokenIn, defaultTokenOut);
  const {
    orderType,
    amountIn,
    amountOut,
    tokenIn,
    tokenOut,
    txHash,
    isLoading,
    setOrderType,
    setAmountIn,
    setTxHash,
    setIsLoading,
    resetSwap,
    swapTokens,
  } = swapState;

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

  const { balance: tokenInBalance, isLoading: isLoadingBalance } =
    useTokenBalance(tokenIn as Token | string | undefined);

  const tokenInAddress = getTokenAddress(
    tokenIn as Parameters<typeof getTokenAddress>[0]
  );
  const isTokenInXlm =
    tokenInAddress === tokens.XLM ||
    (typeof tokenIn !== "string" &&
      (tokenIn as { type?: string })?.type === "native");

  // For XLM: further subtract a fee buffer from the reserve-adjusted balance.
  // For other tokens: the full balance is spendable.
  const spendableBalance = isTokenInXlm
    ? getSpendableXlmAmount(tokenInBalance)
    : tokenInBalance;

  const {
    amountOut: quoteAmountOut,
    isLoadingQuote,
    quoteError,
  } = useSwapQuote(address, amountIn, tokenIn, tokenOut);

  useEffect(() => {
    if (quoteAmountOut) {
      swapState.setAmountOut(quoteAmountOut);
    }
  }, [quoteAmountOut, swapState]);

  const {
    usdValue,
    usdValueOut,
    isLoadingPrice,
    isLoadingOutPrice,
    swapValueAnalysis,
  } = useSwapPrices(amountIn, amountOut, tokenIn, tokenOut);

  const { executeSwap } = useSwapExecution();

  // ── Limit orders ───────────────────────────────────────────────────────────

  const limitOrders = useLimitOrders(address);
  const {
    orders,
    addOrder,
    cancelOrder,
    markFilled,
    markReady,
    markExpired,
    incrementConfirmation,
    resetConfirmation,
    clearOrders,
  } = limitOrders;

  const handleOrderReady = useCallback(
    (order: LimitOrder) => {
      addNotification(`Limit order ready!`, "success", {
        ...TOAST_CONFIG.defaultOpts,
        description: `Your ${order.side} order for ${order.amountIn} ${order.tokenInSymbol} has reached its target price. Tap "Fill now" to execute.`,
      });
    },
    [addNotification]
  );

  useLimitOrderMonitor({
    walletAddress: address,
    orders,
    actions: {
      markReady,
      markExpired,
      incrementConfirmation,
      resetConfirmation,
      clearOrders,
    },
    onOrderReady: handleOrderReady,
  });

  const handleAddLimitOrder = useCallback(
    (params: Omit<AddLimitOrderParams, "walletAddress">) => {
      if (!address) return;
      addOrder({ ...params, walletAddress: address });
      addNotification("Limit order placed", "success", {
        ...TOAST_CONFIG.defaultOpts,
        description: `Monitoring price for ${params.tokenInSymbol} → ${params.tokenOutSymbol}`,
      });
    },
    [address, addOrder, addNotification]
  );

  /**
   * "Fill now" — pre-fills the Swap tab with the order's params and
   * executes the existing market swap pipeline immediately.
   */
  const handleFillNow = useCallback(
    async (order: LimitOrder) => {
      // Switch to swap tab and pre-fill
      setOrderType("swap");
      swapState.setTokenIn(order.tokenIn);
      swapState.setTokenOut(order.tokenOut);
      setAmountIn(order.amountIn);
      setIsLoading(true);

      try {
        const result = await executeSwap({
          amountIn: order.amountIn,
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          address,
          networkPassphrase,
        });

        if (result.orderId) {
          setTxHash(result.orderId);
          markFilled(order.id);
          addNotification("Limit order filled!", "success", {
            ...TOAST_CONFIG.defaultOpts,
            description: "Your limit order was executed successfully.",
          });

          const tokenOutAddress = getTokenAddress(
            order.tokenOut as Parameters<typeof getTokenAddress>[0]
          );
          const tokenInAddress = getTokenAddress(
            order.tokenIn as Parameters<typeof getTokenAddress>[0]
          );

          void refetchBalances();
          void queryClient.invalidateQueries({
            queryKey: ["tokenBalance", tokenOutAddress, address],
          });
          void queryClient.invalidateQueries({
            queryKey: ["tokenBalance", tokenInAddress, address],
          });
          void queryClient.invalidateQueries({
            queryKey: ["stellar-balances", address],
          });
        }
      } catch (err) {
        if (err instanceof Error && err.message === "USER_REJECTED") {
          setIsLoading(false);
          return;
        }
        const contractError = extractContractErrorOrNull(err);
        const errorMessage = contractError
          ? `Contract error: ${contractError}`
          : err instanceof Error
            ? err.message
            : "Failed to fill limit order";
        addNotification("Fill failed", "error", {
          ...TOAST_CONFIG.defaultOpts,
          description: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      address,
      networkPassphrase,
      executeSwap,
      markFilled,
      addNotification,
      setOrderType,
      swapState,
      setAmountIn,
      setIsLoading,
      setTxHash,
      refetchBalances,
      queryClient,
    ]
  );

  // ── Market swap handlers ───────────────────────────────────────────────────

  const handleSwap = async () => {
    if (!amountIn || parseFloat(amountIn) <= 0 || !address) {
      return;
    }

    if (isInsufficientBalance) {
      return;
    }

    setIsLoading(true);

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
        addNotification("Success", "success", {
          ...TOAST_CONFIG.defaultOpts,
          description: "Swap completed successfully",
        });

        const tokenOutAddress = getTokenAddress(
          tokenOut as Parameters<typeof getTokenAddress>[0]
        );
        const tokenInAddressForInvalidation = getTokenAddress(
          tokenIn as Parameters<typeof getTokenAddress>[0]
        );

        // Refresh Horizon balances (covers XLM + classic Stellar assets)
        void refetchBalances();

        // Force-refresh the Soroban contract balance for both tokens so
        // RWA balances update immediately instead of waiting for the poll.
        void queryClient.invalidateQueries({
          queryKey: ["tokenBalance", tokenOutAddress, address],
        });
        void queryClient.invalidateQueries({
          queryKey: ["tokenBalance", tokenInAddressForInvalidation, address],
        });
        // Also invalidate Horizon-sourced balances used by useWallet
        void queryClient.invalidateQueries({
          queryKey: ["stellar-balances", address],
        });

        resetSwap();
        setAmountIn("");
        swapState.setAmountOut("0.0");
      }
    } catch (err) {
      if (err instanceof Error && err.message === "USER_REJECTED") {
        setIsLoading(false);
        return;
      }

      const contractError = extractContractErrorOrNull(err);
      const errorMessage = contractError
        ? `Contract error: ${contractError}`
        : err instanceof Error
          ? err.message
          : "Failed to complete swap";
      addNotification("Swap failed", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: errorMessage,
      });
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
    if (spendableBalance && parseFloat(spendableBalance) > 0) {
      handleAmountChange(spendableBalance);
    }
  };

  const canGetQuote = address && amountIn && parseFloat(amountIn) > 0;

  const isInsufficientBalance =
    !!amountIn &&
    !!spendableBalance &&
    parseFloat(amountIn) > parseFloat(spendableBalance);

  return (
    <PageContainer maxWidth="4xl">
      {}
      <BannerPage
        title="Swap Currency"
        subtitle="Select an option and swap your currencies"
        badge="Conversion"
        imageSrc="/banners/swap.svg"
        imageAlt="Swap illustration"
        className="mb-6"
      />

      {}
      <div className="flex flex-col gap-3 mb-5">
        <OrderTypeTabs orderType={orderType} onOrderTypeChange={setOrderType} />
      </div>

      {}
      {!address && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5 text-center text-white/60 text-sm">
          Connect your wallet to start swapping
        </div>
      )}

      {/* ── Market Swap UI ─────────────────────────────────────────────────── */}
      {orderType === "swap" && (
        <>
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* From Card */}
              <div className="bg-[#1A1A1A] rounded-2xl p-5 flex flex-col gap-4 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-xs font-medium uppercase tracking-wider">
                    From
                  </span>
                  <div className="w-2 h-2 rounded-full bg-[#229EDF] animate-pulse" />
                </div>

                <TokenSelectorBtn
                  token={tokenIn}
                  getTokenId={getTokenId}
                  getTokenIconUrl={getTokenIconUrl}
                  onClick={() => openTokenSelector("from")}
                  disabled={!address || isLoading}
                />

                <div>
                  <span className="text-white/40 text-xs font-medium uppercase tracking-wider block mb-2">
                    Amount
                  </span>
                  <div className="bg-[#242424] rounded-xl px-4 h-16 flex items-center border border-white/5 focus-within:border-[#229EDF]/50 transition-colors">
                    <AmountInput
                      value={amountIn}
                      onChange={handleAmountChange}
                      disabled={!address || isLoading}
                      className="bg-transparent text-white text-3xl font-bold w-full outline-none placeholder:text-white/30 disabled:opacity-50"
                    />
                  </div>
                  {isInsufficientBalance && (
                    <p className="text-[#EF4444] text-xs mt-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                      Insufficient balance
                    </p>
                  )}
                </div>

                <BalanceCard
                  balance={spendableBalance}
                  usdValue={usdValue}
                  isLoadingBalance={isLoadingBalance}
                  isLoadingPrice={isLoadingPrice}
                  onMaxClick={handleMaxClick}
                />
              </div>

              {/* To Card */}
              <div className="bg-[#1A1A1A] rounded-2xl p-5 flex flex-col gap-4 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-xs font-medium uppercase tracking-wider">
                    To
                  </span>
                  <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
                </div>

                <TokenSelectorBtn
                  token={tokenOut}
                  getTokenId={getTokenId}
                  getTokenIconUrl={getTokenIconUrl}
                  onClick={() => openTokenSelector("to")}
                  disabled={!address || isLoading}
                />

                <div>
                  <span className="text-white/40 text-xs font-medium uppercase tracking-wider block mb-2">
                    You Receive
                  </span>
                  <div className="bg-[#242424] rounded-xl px-4 h-16 flex items-center gap-2 border border-white/5">
                    {isLoadingQuote ? (
                      <span className="text-white/40 text-sm animate-pulse">
                        Calculating...
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
                  {quoteError && !isLoadingQuote && (
                    <p className="text-[#EF4444] text-xs mt-2">{quoteError}</p>
                  )}
                </div>

                <BalanceCard
                  usdValue={usdValueOut}
                  isLoadingPrice={isLoadingOutPrice}
                  isReadOnly
                />
              </div>
            </div>

            {/* Swap Button */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <button
                onClick={swapTokens}
                disabled={isLoading}
                aria-label="Swap tokens"
                className="bg-[#229EDF] hover:bg-[#1a8bc7] text-white p-3.5 rounded-xl shadow-xl shadow-[#229EDF]/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
              >
                <ArrowLeftRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {}
          {}
          <div className="mt-5">
            <SwapButton
              address={address}
              canGetQuote={!!canGetQuote}
              isLoading={isLoading}
              txHash={txHash}
              isLoadingQuote={isLoadingQuote}
              orderType={orderType}
              isInsufficientBalance={isInsufficientBalance}
              onClick={handleSwap}
            />
          </div>

          {}
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
              (tokenSelectorType === "from" ? tokenIn : tokenOut) as
                | Token
                | string
            }
          />
        </>
      )}

      {/* ── Limit Order UI ─────────────────────────────────────────────────── */}
      {orderType === "limit" && (
        <>
          {address ? (
            <>
              <LimitOrderForm
                walletAddress={address}
                onSubmit={handleAddLimitOrder}
                disabled={isLoading}
              />
              <OpenLimitOrdersPanel
                orders={orders}
                onCancel={cancelOrder}
                onFillNow={(order) => void handleFillNow(order)}
              />
            </>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white/60 text-sm">
              Connect your wallet to place limit orders
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
};

export default Swap;
