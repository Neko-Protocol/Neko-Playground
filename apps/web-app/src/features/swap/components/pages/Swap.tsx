"use client";

import React, { useEffect, useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useEVMTokenBalance } from "@/hooks/useEVMTokenBalance";
import { useGasCheck } from "@/hooks/useGasCheck";
import { useWalletType } from "@/hooks/useWalletType";
import { useWalletClient, useChainId } from "wagmi";
import {
  getTokens,
  getAvailableTokens,
  type Token,
} from "@/lib/helpers/soroswap";
import type { EVMToken } from "@/lib/types/evmToken";
import { SUPPORTED_CHAINS } from "@/lib/constants/evmConfig";
import { StellarContractError } from "@/lib/helpers/contractErrorsStellarV2";
import { OrderManagement } from "../ui/OrderManagement";
import TokenSelectorModal from "../ui/TokenSelectorModal";

// Hooks
import { useSwapState } from "../../hooks/useSwapState";
import { useTokenSelection } from "../../hooks/useTokenSelection";
import { useSwapQuote } from "../../hooks/useSwapQuote";
import { useSwapExecution } from "../../hooks/useSwapExecution";
import { useSwapPrices } from "../../hooks/useSwapPrices";

// UI Components
import { OrderTypeTabs } from "../ui/OrderTypeTabs";
import { WalletTypeSelector } from "../ui/WalletTypeSelector";
import { TokenInput } from "../ui/TokenInput";
import { SwapButton } from "../ui/SwapButton";
import { TransactionResult } from "../ui/TransactionResult";
import { LimitOrderForm } from "../ui/LimitOrderForm";
import { TWAPOrderForm } from "../ui/TWAPOrderForm";
import { SwapValueWarning } from "../ui/SwapValueWarning";

const Swap: React.FC = () => {
  // Wallet detection
  const { walletType, isEvmConnected, isStellarConnected, evmAddress } =
    useWalletType();
  const {
    address: stellarWalletAddress,
    network,
    networkPassphrase,
  } = useWallet();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  // Use the appropriate address based on wallet type
  const address = walletType === "evm" ? evmAddress : stellarWalletAddress;

  // Get available tokens for current network (Stellar only)
  const availableTokens = getAvailableTokens();
  const tokenCodes = Object.keys(availableTokens);
  const tokens = getTokens();

  // Tokens are now strings (contract addresses) - initialize with first available tokens
  const defaultTokenIn =
    availableTokens[tokenCodes[0]]?.contract || tokens.XLM || "";
  const defaultTokenOut =
    availableTokens[tokenCodes[1]]?.contract || tokens.USDC || "";

  // Swap state management
  const swapState = useSwapState(defaultTokenIn, defaultTokenOut);
  const {
    swapMode,
    orderType,
    amountIn,
    amountOut,
    tokenIn,
    tokenOut,
    limitPrice,
    twapParts,
    twapFrequency,
    txHash,
    error,
    isLoading,
    setSwapMode,
    setOrderType,
    setAmountIn,
    setLimitPrice,
    setTwapParts,
    setTwapFrequency,
    setTxHash,
    setError,
    setIsLoading,
    resetSwap,
    swapTokens,
  } = swapState;

  // Token selection management
  const tokenSelection = useTokenSelection(
    swapMode,
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
    selectedEvmChainId,
    openTokenSelector,
    closeTokenSelector,
    selectToken,
    changeChain,
    getTokenId,
    getTokenIconUrl,
  } = tokenSelection;

  // Update swap mode based on connected wallet (only when walletType changes)
  useEffect(() => {
    if (walletType === "evm") {
      setSwapMode("evm");
      swapState.setTokenIn("ETH");
      swapState.setTokenOut("USDC");
    } else if (walletType === "stellar") {
      setSwapMode("stellar");
      swapState.setTokenIn(defaultTokenIn);
      swapState.setTokenOut(defaultTokenOut);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletType]); // Only run when walletType changes, not when swapState changes

  // Sync selectedEvmChainId with wallet chain when it changes
  useEffect(() => {
    if (chainId && chainId !== selectedEvmChainId && swapMode === "evm") {
      tokenSelection.changeChain(chainId).catch(() => {
        // Silently handle chain switch errors
      });
    }
  }, [chainId, swapMode, selectedEvmChainId, tokenSelection]);

  // Get chain icon for badge display
  const currentChainIcon = useMemo(() => {
    const chain = SUPPORTED_CHAINS.find((c) => c.id === selectedEvmChainId);
    return chain?.icon || null;
  }, [selectedEvmChainId]);

  // Get token balance for "from" token - Stellar
  const { balance: stellarTokenInBalance, isLoading: isLoadingStellarBalance } =
    useTokenBalance(
      swapMode === "stellar"
        ? (tokenIn as Token | string | undefined)
        : undefined
    );

  // Get token symbol for EVM balance lookup
  const evmTokenSymbol = useMemo(() => {
    if (swapMode !== "evm") return undefined;
    if (typeof tokenIn === "string") return tokenIn;
    if (typeof tokenIn === "object" && "symbol" in tokenIn) {
      return (tokenIn as EVMToken).symbol;
    }
    return undefined;
  }, [swapMode, tokenIn]);

  // Get token balance for "from" token - EVM
  const { balance: evmTokenInBalance, isLoading: isLoadingEvmBalance } =
    useEVMTokenBalance(evmTokenSymbol, selectedEvmChainId);

  // Combined balance based on swap mode
  const tokenInBalance =
    swapMode === "evm" ? evmTokenInBalance : stellarTokenInBalance;
  const isLoadingBalance =
    swapMode === "evm" ? isLoadingEvmBalance : isLoadingStellarBalance;

  // Check if selling native ETH (uses EthFlow)
  const isSellingNativeETH = useMemo(() => {
    if (swapMode !== "evm") return false;
    const symbol =
      typeof tokenIn === "string" ? tokenIn : (tokenIn as EVMToken)?.symbol;
    return symbol === "ETH" && selectedEvmChainId === 1;
  }, [swapMode, tokenIn, selectedEvmChainId]);

  // Gas check for EVM swaps
  const {
    hasEnoughGas,
    nativeSymbol: gasSymbol,
    isLoading: isLoadingGas,
  } = useGasCheck(
    isSellingNativeETH,
    false, // needsApproval - we'd need to check this dynamically
    swapMode === "evm" ? selectedEvmChainId : undefined
  );

  // Swap quote management
  const { amountOut: quoteAmountOut, isLoadingQuote } = useSwapQuote(
    swapMode,
    address,
    amountIn,
    tokenIn,
    tokenOut,
    selectedEvmChainId
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
  } = useSwapPrices(swapMode, amountIn, amountOut, tokenIn, tokenOut);

  // Swap execution
  const { executeSwap } = useSwapExecution();

  // Handle swap execution
  const handleSwap = async () => {
    if (!amountIn || parseFloat(amountIn) <= 0 || !address) {
      return;
    }

    // Validate order-specific parameters
    if (orderType === "limit" && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      setError("Please enter a valid limit price");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await executeSwap({
        swapMode,
        orderType,
        amountIn,
        tokenIn,
        tokenOut,
        limitPrice,
        twapParts,
        twapFrequency,
        address,
        evmAddress,
        selectedEvmChainId,
        networkPassphrase,
      });

      if (result.orderId) {
        setTxHash(result.orderId);
        resetSwap();
        setAmountIn("");
        swapState.setAmountOut("0.0");
        setLimitPrice("");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "USER_REJECTED") {
        setIsLoading(false);
        return;
      }

      // Try to extract contract error for Stellar swaps
      const errorMessage =
        swapMode === "stellar"
          ? new StellarContractError(error, "rwa-perps").messageOrNull() ||
            (error instanceof Error ? error.message : "Failed to complete swap")
          : error instanceof Error
            ? error.message
            : "Failed to complete swap";
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
    <div
      className={`w-full mx-auto px-4 py-8 mt-4 ${
        orderType === "limit" ? "max-w-6xl" : "max-w-lg"
      }`}
    >
      <div
        className={`grid gap-8 ${
          orderType === "limit" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {/* Left Column - Swap Interface */}
        <div>
          {/* Order Type Tabs */}
          <OrderTypeTabs
            orderType={orderType}
            onOrderTypeChange={setOrderType}
          />

          {/* Wallet Type Selector */}
          <WalletTypeSelector
            swapMode={swapMode}
            onSwapModeChange={setSwapMode}
            isEvmConnected={isEvmConnected}
            isStellarConnected={isStellarConnected}
          />

          {/* Wallet Connection Messages */}
          {!address && (
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 mb-6">
              <p className="text-gray-300 text-center">
                Please connect your wallet to start swapping
              </p>
            </div>
          )}

          {address && swapMode === "evm" && !walletClient && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-6">
              <p className="text-yellow-800 text-center text-sm">
                Wallet client not available. Please ensure your EVM wallet is
                properly connected.
              </p>
            </div>
          )}

          {/* Swap Interface */}
          <div className="bg-gray-700 border border-gray-700 rounded-2xl p-6 shadow-xl">
            {/* From Token Section */}
            <TokenInput
              type="from"
              label="From"
              amount={amountIn}
              onAmountChange={handleAmountChange}
              token={tokenIn}
              onTokenClick={() => openTokenSelector("from")}
              balance={tokenInBalance}
              isLoadingBalance={isLoadingBalance}
              usdValue={usdValue}
              isLoadingPrice={isLoadingPrice}
              swapMode={swapMode}
              chainIcon={currentChainIcon}
              getTokenId={getTokenId}
              getTokenIconUrl={getTokenIconUrl}
              onMaxClick={handleMaxClick}
              disabled={!address || isLoading}
            />

            {/* Swap Arrow Button */}
            <div className="flex justify-center my-2 relative z-10">
              <button
                onClick={swapTokens}
                disabled={isLoading}
                className="bg-[#334EAC] hover:bg-[#081F5C] text-white p-2.5 rounded-lg transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Swap tokens"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 7.5l5 5 5-5" />
                </svg>
              </button>
            </div>

            {/* To Token Section */}
            <TokenInput
              type="to"
              label="To"
              amount={amountOut}
              onAmountChange={() => {}} // Read-only
              token={tokenOut}
              onTokenClick={() => openTokenSelector("to")}
              usdValue={usdValueOut}
              isLoadingPrice={isLoadingOutPrice}
              isLoadingQuote={isLoadingQuote}
              swapMode={swapMode}
              chainIcon={currentChainIcon}
              getTokenId={getTokenId}
              getTokenIconUrl={getTokenIconUrl}
              disabled={!address || isLoading}
              showSwapWarning={!!swapValueAnalysis?.isSuspiciouslyLow}
              swapWarningComponent={
                swapValueAnalysis ? (
                  <SwapValueWarning
                    analysis={swapValueAnalysis}
                    isLoadingPrice={isLoadingOutPrice}
                  />
                ) : undefined
              }
            />

            {/* Order-specific parameters */}
            {orderType === "limit" && (
              <LimitOrderForm
                limitPrice={limitPrice}
                onLimitPriceChange={setLimitPrice}
                tokenOut={tokenOut}
                getTokenId={getTokenId}
              />
            )}

            {orderType === "twap" && (
              <TWAPOrderForm
                twapParts={twapParts}
                onTwapPartsChange={setTwapParts}
                twapFrequency={twapFrequency}
                onTwapFrequencyChange={setTwapFrequency}
              />
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 mt-5 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8">
              <SwapButton
                address={address}
                canGetQuote={!!canGetQuote}
                swapMode={swapMode}
                hasEnoughGas={hasEnoughGas}
                isLoadingGas={isLoadingGas}
                gasSymbol={gasSymbol}
                isLoading={isLoading}
                txHash={txHash}
                isLoadingQuote={isLoadingQuote}
                orderType={orderType}
                onClick={handleSwap}
              />
            </div>

            {/* Transaction Hash */}
            {txHash && (
              <TransactionResult
                txHash={txHash}
                swapMode={swapMode}
                network={network}
                selectedEvmChainId={selectedEvmChainId}
                orderType={orderType}
              />
            )}
          </div>
        </div>

        {/* Right Column - Order Management (only for limit orders) */}
        {orderType === "limit" && (
          <div>
            <div className="bg-gray-700 border border-gray-700 rounded-2xl p-6 mt-16">
              <h3 className="text-lg font-semibold text-white mb-4">
                Order Management
              </h3>
              <OrderManagement />
            </div>
          </div>
        )}
      </div>

      <TokenSelectorModal
        isOpen={tokenSelectorOpen}
        onClose={closeTokenSelector}
        onSelectToken={selectToken}
        selectedToken={
          (tokenSelectorType === "from" ? tokenIn : tokenOut) as Token | string
        }
        swapMode={swapMode}
        selectedChainId={selectedEvmChainId}
        onChainChange={changeChain}
      />
    </div>
  );
};

export default Swap;
