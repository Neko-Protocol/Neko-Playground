"use client";

import { useState, useMemo, useCallback } from "react";
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { rpc } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import { useLendingPools } from "./useLendingPools";
import {
  depositToPool,
  withdrawFromPool,
  getBTokenBalance,
} from "@/lib/helpers/stellar/lending";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { rpcUrl, stellarNetwork } from "@/lib/config/stellar.config";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { waitForTransaction } from "@/lib/helpers/stellar/waitForTransaction";
import { usePools, usePoolAction } from "@/lib/orchestrator";
import type { PoolInfo } from "@/lib/orchestrator";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { formatLiquidity } from "@/lib/helpers/formatUtils";
import type { PoolData } from "../types/lending";

function toBTokens(tokensAmount: string, bTokenRate: string): string {
  if (
    !tokensAmount ||
    parseFloat(tokensAmount) <= 0 ||
    !bTokenRate ||
    parseFloat(bTokenRate) <= 0
  )
    return "0";
  return (parseFloat(tokensAmount) / parseFloat(bTokenRate)).toFixed(7);
}

export function useLend() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeposit, setIsDeposit] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [bTokenBalance, setBTokenBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [selectedPool, setSelectedPool] = useState<PoolData | null>(null);

  const { address, signTransaction, networkPassphrase } = useWallet();
  const { addNotification } = useToast();

  const showError = useCallback(
    (msg: string) =>
      addNotification("Something went wrong", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: msg,
      }),
    [addNotification]
  );
  const showSuccess = useCallback(
    (msg: string) =>
      addNotification("Success", "success", {
        ...TOAST_CONFIG.defaultOpts,
        description: msg,
      }),
    [addNotification]
  );

  const {
    data: lendingPools = [],
    isLoading: isLoadingNekoPools,
    error: nekoPoolsError,
    refetch: refetchPools,
  } = useLendingPools();

  const {
    data: orchestratorPools = [],
    isLoading: isLoadingOrchestratorPools,
    error: orchestratorPoolsError,
  } = usePools();

  const { mutateAsync: executePoolAction } = usePoolAction();

  const isLoadingPools = isLoadingNekoPools || isLoadingOrchestratorPools;
  const poolsError = nekoPoolsError || orchestratorPoolsError;

  const pools: PoolData[] = useMemo(() => {
    const nekoPools: PoolData[] = lendingPools.map((pool, index) => {
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
        feeApy: `${pool.interestRate.toFixed(2)}%`,
        liquidity,
        isActive: pool.isActive,
        assetCode: pool.assetCode,
        asset: pool.asset,
        bTokenRate: pool.bTokenRate,
        contractId: pool.contractId,
      };
    });

    const aggregated: PoolData[] = orchestratorPools
      .filter(
        (p: PoolInfo) =>
          p.type !== "neko" && p.supportedActions.includes("deposit")
      )
      .map((p: PoolInfo) => {
        const token = p.tokens[0];
        const decimals = token?.decimals ?? 7;
        const liquidity = formatLiquidity(
          fromSmallestUnit(p.tvl.toString(), decimals)
        );
        const contractId = p.id.split(":")[1] ?? p.id;
        return {
          id: `agg-${p.id}`,
          name: p.name,
          token1: token?.code ?? "?",
          token2: "Lending",
          fee: "0%",
          roi: p.apy > 0 ? `${p.apy.toFixed(2)}%` : "0.00%",
          feeApy: p.apy > 0 ? `${p.apy.toFixed(2)}%` : "0.00%",
          liquidity,
          isActive: p.state === "active",
          assetCode: token?.code ?? "?",
          asset: token?.address ?? "",
          bTokenRate: undefined,
          contractId,
          isAggregated: true,
          orchestratorId: p.id,
        };
      });

    return [...nekoPools, ...aggregated];
  }, [lendingPools, orchestratorPools]);

  const loadBTokenBalance = useCallback(async () => {
    if (!selectedPool || !address) {
      setBTokenBalance(null);
      return;
    }
    if (selectedPool.isAggregated) {
      setBTokenBalance(null);
      return;
    }
    setIsLoadingBalance(true);
    try {
      const balance = await getBTokenBalance(
        selectedPool.assetCode,
        address,
        7,
        selectedPool.contractId
      );
      setBTokenBalance(balance);
    } catch {
      setBTokenBalance("0");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [selectedPool, address]);

  const openModal = useCallback(
    (pool: PoolData, deposit: boolean) => {
      setSelectedPool(pool);
      setIsDeposit(deposit);
      setBTokenBalance(null);
      setIsModalOpen(true);
      if (address) void loadBTokenBalance();
    },
    [address, loadBTokenBalance]
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleConfirm = useCallback(
    async (amount: string) => {
      if (!selectedPool || !address || !amount || parseFloat(amount) <= 0)
        return;

      setIsLoading(true);

      try {
        if (selectedPool.isAggregated && selectedPool.orchestratorId) {
          const decimals = 7;
          const rawAmount = BigInt(
            Math.floor(parseFloat(amount) * 10 ** decimals)
          );

          await executePoolAction({
            poolId: selectedPool.orchestratorId,
            action: isDeposit ? "deposit" : "withdraw",
            amount: rawAmount,
          });

          await refetchPools();
          showSuccess(
            isDeposit
              ? `Successfully deposited ${amount} ${selectedPool.assetCode}`
              : `Successfully withdrew ${amount} ${selectedPool.assetCode}`
          );
          closeModal();
          return;
        }

        const availableTokens = getAvailableTokens();
        const token = availableTokens[selectedPool.assetCode];
        if (!token?.contract)
          throw new Error(`Token ${selectedPool.assetCode} not found`);

        const decimals = token.decimals || 7;
        const passphrase = networkPassphrase || Networks.TESTNET;
        const sorobanServer = new rpc.Server(rpcUrl, {
          allowHttp: stellarNetwork === "LOCAL",
        });

        const lendingContractId = selectedPool.contractId;

        if (isDeposit) {
          const depositXdr = await depositToPool(
            selectedPool.assetCode,
            amount,
            decimals,
            address,
            lendingContractId
          );

          const signedDeposit = await signTransaction(depositXdr as any, {
            networkPassphrase: passphrase,
            address,
          });
          const sendResult = await sorobanServer.sendTransaction(
            TransactionBuilder.fromXDR(signedDeposit.signedTxXdr, passphrase)
          );
          await waitForTransaction(sendResult.hash, sorobanServer);
        } else {
          if (!selectedPool.bTokenRate)
            throw new Error("Unable to calculate bTokens. Please try again.");
          const bTokensAmount = toBTokens(amount, selectedPool.bTokenRate);
          const withdrawXdr = await withdrawFromPool(
            selectedPool.assetCode,
            bTokensAmount,
            decimals,
            address,
            lendingContractId
          );

          const signedWithdraw = await signTransaction(withdrawXdr as any, {
            networkPassphrase: passphrase,
            address,
          });
          const sendResult = await sorobanServer.sendTransaction(
            TransactionBuilder.fromXDR(signedWithdraw.signedTxXdr, passphrase)
          );
          await waitForTransaction(sendResult.hash, sorobanServer);
        }

        await loadBTokenBalance();
        await refetchPools();
        showSuccess(
          isDeposit
            ? `Successfully deposited ${amount} ${selectedPool.assetCode}`
            : `Successfully withdrew ${amount} ${selectedPool.assetCode}`
        );
        closeModal();
      } catch (err) {
        const msg = extractContractErrorOrNull(err);
        showError(
          typeof msg === "string" ? msg : "An unexpected error occurred."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      selectedPool,
      address,
      isDeposit,
      networkPassphrase,
      signTransaction,
      executePoolAction,
      loadBTokenBalance,
      refetchPools,
      closeModal,
      showError,
      showSuccess,
    ]
  );

  return {
    pools,
    isLoadingPools,
    poolsError,
    selectedPool,
    isModalOpen,
    isDeposit,
    isLoading,
    bTokenBalance,
    isLoadingBalance,
    hasWallet: !!address,
    openModal,
    closeModal,
    handleConfirm,
    refreshBalance: loadBTokenBalance,
  };
}
