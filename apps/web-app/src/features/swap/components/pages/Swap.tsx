"use client";

import React, { useEffect, useMemo } from "react";
import Image from "next/image";
import { ChevronDown, ArrowLeftRight } from "lucide-react";
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
} from "@/lib/helpers/stellar/soroswap";
import type { EVMToken } from "@/lib/types/evmToken";
import { SUPPORTED_CHAINS } from "@/lib/constants/evmConfig";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import {
  sanitizeAmountInput,
  formatSwapAmount,
} from "@/lib/helpers/tokenUtils";
import { BannerPage } from "@/components/ui/BannerPage";
import { OrderManagement } from "../ui/OrderManagement";
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
import { LimitOrderForm } from "../ui/LimitOrderForm";
import { TWAPOrderForm } from "../ui/TWAPOrderForm";
import { SwapValueWarning } from "../ui/SwapValueWarning";
import { OrderTypeTabs } from "../ui/OrderTypeTabs";
import { WalletTypeSelector } from "../ui/WalletTypeSelector";


interface TokenSelectorBtnProps {
  token: Token | string | EVMToken;
  getTokenId: (t: Token | string | EVMToken) => string;
  getTokenIconUrl: (t: Token | string | EVMToken) => string | null;
  chainIcon?: string | null;
  swapMode: "evm" | "stellar";
  onClick: () => void;
  disabled?: boolean;
}

const TokenSelectorBtn: React.FC<TokenSelectorBtnProps> = ({
  token,
  getTokenId,
  getTokenIconUrl,
  chainIcon,
  swapMode,
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
        {swapMode === "evm" && chainIcon && (
          <Image
            src={chainIcon}
            alt="chain"
            width={10}
            height={10}
            unoptimized
            className="absolute -bottom-0.5 -right-0.5 rounded-full border border-[#2A2A2A] object-contain bg-white"
          />
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
        {isLoadingBalance ? "..." : `${formatSwapAmount(balance || "0", 6)} Max`}
      </button>
    </div>
  </div>
);

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
          ? extractContractErrorOrNull(error, "rwa-perps") ||
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

      {/* Order type + wallet type controls */}
      <div className="flex flex-col gap-3 mb-5">
        <OrderTypeTabs orderType={orderType} onOrderTypeChange={setOrderType} />
        <WalletTypeSelector
          swapMode={swapMode}
          onSwapModeChange={setSwapMode}
          isEvmConnected={isEvmConnected}
          isStellarConnected={isStellarConnected}
        />
      </div>

      {/* Wallet alerts */}
      {!address && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5 text-center text-white/60 text-sm">
          Connect your wallet to start swapping
        </div>
      )}
      {address && swapMode === "evm" && !walletClient && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 mb-5 text-center text-yellow-400 text-sm">
          Wallet client not available. Please ensure your EVM wallet is properly
          connected.
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
              chainIcon={currentChainIcon}
              swapMode={swapMode}
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
              chainIcon={currentChainIcon}
              swapMode={swapMode}
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

      {/* Order-specific forms */}
      {orderType === "limit" && (
        <div className="mt-4">
          <LimitOrderForm
            limitPrice={limitPrice}
            onLimitPriceChange={setLimitPrice}
            tokenOut={tokenOut}
            getTokenId={getTokenId}
          />
        </div>
      )}
      {orderType === "twap" && (
        <div className="mt-4">
          <TWAPOrderForm
            twapParts={twapParts}
            onTwapPartsChange={setTwapParts}
            twapFrequency={twapFrequency}
            onTwapFrequencyChange={setTwapFrequency}
          />
        </div>
      )}

      {/* Order management (limit orders only) */}
      {orderType === "limit" && (
        <div className="bg-[#1C1C1C] rounded-[20px] p-5 mt-4">
          <h3 className="text-base font-semibold text-white mb-4">
            Order Management
          </h3>
          <OrderManagement />
        </div>
      )}

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

      {/* Transaction result */}
      {txHash && (
        <TransactionResult
          txHash={txHash}
          swapMode={swapMode}
          network={network}
          selectedEvmChainId={selectedEvmChainId}
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
        swapMode={swapMode}
        selectedChainId={selectedEvmChainId}
        onChainChange={changeChain}
      />
    </div>
  );
};

export default Swap;
