"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  ArrowLeftRight,
  TrendingUp,
  Droplets,
  Coins,
  Zap,
  X,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";
import { BannerPage } from "@/components/ui/BannerPage";
import { getTokenIcon } from "@/lib/helpers/tokenUtils";
import { useLendingPools } from "@/features/lending/hooks/useLendingPools";
import { useWallet } from "../../../../hooks/useWallet";
import {
  approveToken,
  depositToPool,
  withdrawFromPool,
  getBTokenBalance,
} from "@/lib/helpers/stellar/lending";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { LENDING_CONTRACT_ID } from "@/lib/constants/contracts";
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { rpcUrl, stellarNetwork } from "@/lib/config/stellar.config";
import { rpc } from "@stellar/stellar-sdk";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PoolData {
  id: string;
  name: string;
  token1: string;
  token2: string;
  fee: string;
  roi: string;
  feeApy: string;
  liquidity: string;
  isActive: boolean;
  assetCode: string;
  asset: string;
  bTokenRate?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProtocolCell({ pool }: { pool: PoolData }) {
  const icon = getTokenIcon({ type: "contract", code: pool.token1 });

  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-[#1a2a4a] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
        {icon ? (
          <Image
            src={icon}
            alt={pool.token1}
            width={28}
            height={28}
            unoptimized
          />
        ) : (
          <span className="text-white text-xs font-bold">
            {pool.token1.slice(0, 3).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-white font-medium text-sm">{pool.name}</span>
      <span className="rounded bg-[#2A2A2A] px-1.5 py-0.5 text-[10px] font-semibold text-white/50">
        V2
      </span>
    </div>
  );
}

function ColHeader({
  icon: Icon,
  label,
  centered,
}: {
  icon: React.ElementType;
  label: string;
  centered?: boolean;
}) {
  return (
    <th className={`px-4 py-3 ${centered ? "text-center" : "text-left"}`}>
      <div
        className={`flex items-center gap-1.5 text-white/40 text-xs font-semibold uppercase tracking-wide ${centered ? "justify-center" : ""}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface LendModalProps {
  pool: PoolData;
  isDeposit: boolean;
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  bTokenBalance: string | null;
  isLoadingBalance: boolean;
  onConfirm: (amount: string) => Promise<void>;
  onRefreshBalance: () => void;
  hasWallet: boolean;
}

function LendModal({
  pool,
  isDeposit,
  onClose,
  isLoading,
  error,
  bTokenBalance,
  isLoadingBalance,
  onConfirm,
  onRefreshBalance,
  hasWallet,
}: LendModalProps) {
  const [amount, setAmount] = useState("");

  const bTokensToBurn = useMemo(() => {
    if (
      !amount ||
      parseFloat(amount) <= 0 ||
      !pool.bTokenRate ||
      parseFloat(pool.bTokenRate) <= 0
    )
      return null;
    return (parseFloat(amount) / parseFloat(pool.bTokenRate)).toFixed(7);
  }, [amount, pool.bTokenRate]);

  const canSubmit =
    hasWallet &&
    !!amount &&
    parseFloat(amount) > 0 &&
    (isDeposit ||
      (!!bTokensToBurn &&
        parseFloat(bTokensToBurn) > 0 &&
        (bTokenBalance === null ||
          parseFloat(bTokensToBurn) <= parseFloat(bTokenBalance))));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white text-xl font-bold">
            {isDeposit ? "Deposit" : "Withdraw"} — {pool.name}
          </h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pool stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Supply APY", value: pool.roi },
            { label: "Liquidity", value: pool.liquidity },
            {
              label: "bToken Rate",
              value: pool.bTokenRate
                ? parseFloat(pool.bTokenRate).toFixed(4)
                : "1.0000",
            },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/5 rounded-xl p-3">
              <p className="text-white/40 text-xs mb-0.5">{label}</p>
              <p className="text-white font-semibold text-sm">{value}</p>
            </div>
          ))}
        </div>

        {/* bToken balance (withdraw only) */}
        {!isDeposit && (
          <div className="mb-5 rounded-2xl bg-[#229EDF]/10 border border-[#229EDF]/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-[#229EDF]/70 text-xs">Your bToken Balance</p>
              <p className="text-[#229EDF] font-bold text-lg">
                {isLoadingBalance ? "Loading…" : (bTokenBalance ?? "--")} b
                {pool.token1}
              </p>
            </div>
            <button
              onClick={onRefreshBalance}
              disabled={isLoadingBalance}
              className="text-[#229EDF]/60 hover:text-[#229EDF] transition-colors disabled:opacity-40"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoadingBalance ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        )}

        {/* Amount input */}
        <div className="mb-5">
          <label className="text-white/60 text-sm font-medium block mb-1.5">
            {isDeposit ? "Amount to Deposit" : "Amount to Withdraw"} (
            {pool.token1})
          </label>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isLoading}
            className="w-full bg-[#2A2A2A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 outline-none focus:border-[#229EDF]/50 transition-colors disabled:opacity-50"
          />
          {!isDeposit && amount && bTokensToBurn && (
            <p className="text-white/30 text-xs mt-1 italic">
              You will burn ~{parseFloat(bTokensToBurn).toFixed(4)} bTokens
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-white/10 py-3 text-white/60 font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void onConfirm(amount)}
            disabled={isLoading || !canSubmit}
            className="flex-1 rounded-xl bg-[#229EDF] py-3 text-white font-semibold text-sm hover:bg-[#1a8bc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? "Processing…"
              : !hasWallet
                ? "Connect Wallet"
                : isDeposit
                  ? "Confirm Deposit"
                  : "Confirm Withdraw"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const Lend: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeposit, setIsDeposit] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bTokenBalance, setBTokenBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [selectedPool, setSelectedPool] = useState<PoolData | null>(null);

  const { address, signTransaction, networkPassphrase } = useWallet();

  const {
    data: lendingPools = [],
    isLoading: isLoadingPools,
    error: poolsError,
    refetch: refetchPools,
  } = useLendingPools();

  const pools: PoolData[] = useMemo(() => {
    return lendingPools.map((pool, index) => {
      const apy =
        pool.interestRate > 0 ? `${pool.interestRate.toFixed(2)}%` : "0.00%";
      const balanceNum = parseFloat(pool.poolBalance);
      const liquidity =
        balanceNum >= 1000
          ? `$${(balanceNum / 1000).toFixed(2)}k`
          : `$${balanceNum.toFixed(2)}`;
      return {
        id: `pool-${index}`,
        name: `${pool.assetCode} Pool`,
        token1: pool.assetCode,
        token2: "",
        fee: "0%",
        roi: `${pool.interestRate.toFixed(2)}%`,
        feeApy: apy,
        liquidity,
        isActive: pool.isActive,
        assetCode: pool.assetCode,
        asset: pool.asset,
        bTokenRate: pool.bTokenRate,
      };
    });
  }, [lendingPools]);

  const calculateBTokensFromTokens = (
    tokensAmount: string,
    bTokenRate: string
  ): string => {
    if (
      !tokensAmount ||
      parseFloat(tokensAmount) <= 0 ||
      !bTokenRate ||
      parseFloat(bTokenRate) <= 0
    )
      return "0";
    return (parseFloat(tokensAmount) / parseFloat(bTokenRate)).toFixed(7);
  };

  const loadBTokenBalance = useCallback(async () => {
    if (!selectedPool || !address) {
      setBTokenBalance(null);
      return;
    }
    setIsLoadingBalance(true);
    try {
      const balance = await getBTokenBalance(selectedPool.assetCode, address);
      setBTokenBalance(balance);
    } catch {
      setBTokenBalance("0");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [selectedPool, address]);

  React.useEffect(() => {
    if (selectedPool && address) void loadBTokenBalance();
    else setBTokenBalance(null);
  }, [selectedPool, address, loadBTokenBalance]);

  const openModal = (pool: PoolData, deposit: boolean) => {
    setSelectedPool(pool);
    setIsDeposit(deposit);
    setError(null);
    setBTokenBalance(null);
    setIsModalOpen(true);
    if (address) void loadBTokenBalance();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setError(null);
  };

  const handleConfirm = async (amount: string) => {
    if (!selectedPool || !address || !amount || parseFloat(amount) <= 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const availableTokens = getAvailableTokens();
      const token = availableTokens[selectedPool.assetCode];
      if (!token?.contract)
        throw new Error(`Token ${selectedPool.assetCode} not found`);

      const decimals = token.decimals || 7;
      const lendingContractId = LENDING_CONTRACT_ID;
      const sorobanServer = new rpc.Server(rpcUrl, {
        allowHttp: stellarNetwork === "LOCAL",
      });

      if (isDeposit) {
        const approveXdr = await approveToken(
          token.contract,
          lendingContractId,
          amount,
          decimals,
          address
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const signedApprove = await signTransaction(approveXdr as any, {
          networkPassphrase: networkPassphrase || Networks.TESTNET,
          address,
        });
        const approveTx = TransactionBuilder.fromXDR(
          signedApprove.signedTxXdr,
          networkPassphrase || Networks.TESTNET
        );
        await sorobanServer.sendTransaction(approveTx);
        await new Promise((r) => setTimeout(r, 2000));

        const depositXdr = await depositToPool(
          selectedPool.assetCode,
          amount,
          decimals,
          address
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const signedDeposit = await signTransaction(depositXdr as any, {
          networkPassphrase: networkPassphrase || Networks.TESTNET,
          address,
        });
        const depositTx = TransactionBuilder.fromXDR(
          signedDeposit.signedTxXdr,
          networkPassphrase || Networks.TESTNET
        );
        await sorobanServer.sendTransaction(depositTx);
      } else {
        if (!selectedPool.bTokenRate)
          throw new Error("Unable to calculate bTokens. Please try again.");
        const bTokensAmount = calculateBTokensFromTokens(
          amount,
          selectedPool.bTokenRate
        );
        const withdrawXdr = await withdrawFromPool(
          selectedPool.assetCode,
          bTokensAmount,
          decimals,
          address
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const signedWithdraw = await signTransaction(withdrawXdr as any, {
          networkPassphrase: networkPassphrase || Networks.TESTNET,
          address,
        });
        const withdrawTx = TransactionBuilder.fromXDR(
          signedWithdraw.signedTxXdr,
          networkPassphrase || Networks.TESTNET
        );
        await sorobanServer.sendTransaction(withdrawTx);
      }

      await new Promise((r) => setTimeout(r, 3000));
      await loadBTokenBalance();
      await refetchPools();
      handleCloseModal();
    } catch (err) {
      const msg = extractContractErrorOrNull(err);
      if (msg)
        setError(
          typeof msg === "string" ? msg : "An unexpected error occurred."
        );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-8">
      <BannerPage
        title="Lend to Pools"
        subtitle="Supply liquidity to pools and earn interest on your assets"
        badge="Use your actives"
        imageSrc="/banners/lend.svg"
        imageAlt="Lend illustration"
        className="mb-8"
      />

      <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <ColHeader icon={ArrowLeftRight} label="Protocol" />
              <ColHeader icon={TrendingUp} label="Supply APY" centered />
              <ColHeader icon={Droplets} label="Total liquidity" centered />
              <ColHeader icon={Coins} label="bToken Rate" centered />
              <ColHeader icon={Zap} label="Actions" centered />
            </tr>
          </thead>
          <tbody>
            {isLoadingPools ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-white/40 text-sm"
                >
                  Loading pools…
                </td>
              </tr>
            ) : poolsError ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-red-400 text-sm"
                >
                  Error loading pools: {String(poolsError)}
                </td>
              </tr>
            ) : pools.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-white/40 text-sm"
                >
                  No active pools available
                </td>
              </tr>
            ) : (
              pools.map((pool) => (
                <tr
                  key={pool.id}
                  className="border-b border-white/5 hover:bg-white/2 transition-colors"
                >
                  <td className="px-4 py-4 align-middle">
                    <ProtocolCell pool={pool} />
                  </td>
                  <td className="px-4 py-4 align-middle text-center text-white text-sm">
                    {pool.roi}
                  </td>
                  <td className="px-4 py-4 align-middle text-center text-white text-sm">
                    {pool.liquidity}
                  </td>
                  <td className="px-4 py-4 align-middle text-center text-white text-sm">
                    {pool.bTokenRate
                      ? parseFloat(pool.bTokenRate).toFixed(4)
                      : "1.0000"}
                  </td>
                  <td className="px-4 py-4 align-middle text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openModal(pool, true)}
                        className="rounded-lg bg-[#2A2A2A] hover:bg-[#333] px-4 py-1.5 text-white/70 hover:text-white text-xs font-semibold transition-colors"
                      >
                        Deposit
                      </button>
                      <button
                        onClick={() => openModal(pool, false)}
                        className="rounded-lg bg-[#229EDF] hover:bg-[#1a8bc7] px-4 py-1.5 text-white text-xs font-semibold transition-colors"
                      >
                        Withdraw
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedPool && (
        <LendModal
          pool={selectedPool}
          isDeposit={isDeposit}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          isLoading={isLoading}
          error={error}
          bTokenBalance={bTokenBalance}
          isLoadingBalance={isLoadingBalance}
          onConfirm={handleConfirm}
          onRefreshBalance={() => void loadBTokenBalance()}
          hasWallet={!!address}
        />
      )}
    </div>
  );
};

export default Lend;
