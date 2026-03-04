"use client";

import { useState, useMemo, useCallback } from "react";
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { rpc } from "@stellar/stellar-sdk";
import { sileo } from "sileo";
import { useWallet } from "@/hooks/useWallet";
import { useLendingPools } from "./useLendingPools";
import {
  approveToken,
  depositToPool,
  withdrawFromPool,
  getBTokenBalance,
} from "@/lib/helpers/stellar/lending";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { LENDING_CONTRACT_ID } from "@/lib/constants/contracts";
import { rpcUrl, stellarNetwork } from "@/lib/config/stellar.config";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
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
      };
    });
  }, [lendingPools]);

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

  const openModal = useCallback(
    (pool: PoolData, deposit: boolean) => {
      setSelectedPool(pool);
      setIsDeposit(deposit);
      setError(null);
      setBTokenBalance(null);
      setIsModalOpen(true);
      if (address) void loadBTokenBalance();
    },
    [address, loadBTokenBalance]
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setError(null);
  }, []);

  const handleConfirm = useCallback(
    (amount: string) => {
      if (!selectedPool || !address || !amount || parseFloat(amount) <= 0)
        return;

      setIsLoading(true);
      setError(null);

      const runTx = async () => {
        const availableTokens = getAvailableTokens();
        const token = availableTokens[selectedPool.assetCode];
        if (!token?.contract)
          throw new Error(`Token ${selectedPool.assetCode} not found`);

        const decimals = token.decimals || 7;
        const passphrase = networkPassphrase || Networks.TESTNET;
        const sorobanServer = new rpc.Server(rpcUrl, {
          allowHttp: stellarNetwork === "LOCAL",
        });

        if (isDeposit) {
          const approveXdr = await approveToken(
            token.contract,
            LENDING_CONTRACT_ID,
            amount,
            decimals,
            address
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const signedApprove = await signTransaction(approveXdr as any, {
            networkPassphrase: passphrase,
            address,
          });
          await sorobanServer.sendTransaction(
            TransactionBuilder.fromXDR(signedApprove.signedTxXdr, passphrase)
          );
          await new Promise((r) => setTimeout(r, 2000));

          const depositXdr = await depositToPool(
            selectedPool.assetCode,
            amount,
            decimals,
            address
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const signedDeposit = await signTransaction(depositXdr as any, {
            networkPassphrase: passphrase,
            address,
          });
          await sorobanServer.sendTransaction(
            TransactionBuilder.fromXDR(signedDeposit.signedTxXdr, passphrase)
          );
        } else {
          if (!selectedPool.bTokenRate)
            throw new Error("Unable to calculate bTokens. Please try again.");
          const bTokensAmount = toBTokens(amount, selectedPool.bTokenRate);
          const withdrawXdr = await withdrawFromPool(
            selectedPool.assetCode,
            bTokensAmount,
            decimals,
            address
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const signedWithdraw = await signTransaction(withdrawXdr as any, {
            networkPassphrase: passphrase,
            address,
          });
          await sorobanServer.sendTransaction(
            TransactionBuilder.fromXDR(signedWithdraw.signedTxXdr, passphrase)
          );
        }

        await new Promise((r) => setTimeout(r, 3000));
        await loadBTokenBalance();
        await refetchPools();
        closeModal();
      };

      sileo
        .promise(runTx(), {
          loading: {
            title: isDeposit ? "Depositing…" : "Withdrawing…",
          },
          success: {
            title: isDeposit ? "Deposit successful" : "Withdrawal successful",
          },
          error: (err) => {
            const msg = extractContractErrorOrNull(err);
            const description =
              typeof msg === "string" ? msg : "An unexpected error occurred.";
            setError(description);
            return { title: "Transaction failed", description };
          },
        })
        .finally(() => setIsLoading(false));
    },
    [
      selectedPool,
      address,
      isDeposit,
      networkPassphrase,
      signTransaction,
      loadBTokenBalance,
      refetchPools,
      closeModal,
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
    error,
    bTokenBalance,
    isLoadingBalance,
    hasWallet: !!address,
    openModal,
    closeModal,
    handleConfirm,
    refreshBalance: loadBTokenBalance,
  };
}
