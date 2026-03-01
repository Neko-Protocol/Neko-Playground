"use client";

import { useState, useCallback } from "react";
import { Networks } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import {
  approveToken,
  depositToPool,
  withdrawFromPool,
} from "@/lib/helpers/stellar/lending";
import {
  signAndSendTransaction,
  type SignTransactionFn,
} from "@/lib/helpers/stellar/transaction";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { rpcUrl } from "@/lib/constants/network";
import { LENDING_CONTRACT_ID } from "@/lib/constants/contracts";
import { LENDING_CONFIG } from "@/lib/constants/lending";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import type { PoolData } from "@/features/lending/types/lending";

export interface ExecuteDepositParams {
  pool: PoolData;
  amount: string;
  decimals: number;
}

export interface ExecuteWithdrawParams {
  pool: PoolData;
  amount: string;
  bTokensToBurn: string;
  decimals: number;
}

export interface UseLendingExecutionResult {
  executeDeposit: (
    params: ExecuteDepositParams,
    onSuccess?: () => void | Promise<void>
  ) => Promise<{ success: boolean; error?: string }>;
  executeWithdraw: (
    params: ExecuteWithdrawParams,
    onSuccess?: () => void | Promise<void>
  ) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useLendingExecution(): UseLendingExecutionResult {
  const { address, signTransaction, networkPassphrase } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const signAndSend = useCallback(
    (xdr: string) =>
      signAndSendTransaction(xdr, signTransaction as SignTransactionFn, {
        networkPassphrase: networkPassphrase || Networks.TESTNET,
        rpcUrl,
        address: address ?? undefined,
        waitForPending: true,
      }),
    [signTransaction, networkPassphrase, address]
  );

  const executeDeposit = useCallback(
    async (
      { pool, amount, decimals }: ExecuteDepositParams,
      onSuccess?: () => void | Promise<void>
    ): Promise<{ success: boolean; error?: string }> => {
      if (!address) {
        const msg = "Wallet not connected";
        setError(msg);
        return { success: false, error: msg };
      }

      const availableTokens = getAvailableTokens();
      const token = availableTokens[pool.assetCode];
      if (!token?.contract) {
        const msg = `Token ${pool.assetCode} not found`;
        setError(msg);
        return { success: false, error: msg };
      }

      setIsLoading(true);
      setError(null);

      try {
        const approveXdr = await approveToken(
          token.contract,
          LENDING_CONTRACT_ID,
          amount,
          decimals,
          address
        );
        await signAndSend(approveXdr);
        await new Promise((r) => setTimeout(r, LENDING_CONFIG.approveDelayMs));

        const depositXdr = await depositToPool(
          pool.assetCode,
          amount,
          decimals,
          address
        );
        await signAndSend(depositXdr);
        await new Promise((r) => setTimeout(r, LENDING_CONFIG.postTxDelayMs));

        await onSuccess?.();
        return { success: true };
      } catch (err) {
        const errorMessage = extractContractErrorOrNull(err);
        const errorString =
          typeof errorMessage === "string"
            ? errorMessage
            : "An unexpected error occurred. Please try again.";
        setError(errorString);
        return { success: false, error: errorString };
      } finally {
        setIsLoading(false);
      }
    },
    [address, signAndSend]
  );

  const executeWithdraw = useCallback(
    async (
      { pool, amount, bTokensToBurn, decimals }: ExecuteWithdrawParams,
      onSuccess?: () => void | Promise<void>
    ): Promise<{ success: boolean; error?: string }> => {
      if (!address) {
        const msg = "Wallet not connected";
        setError(msg);
        return { success: false, error: msg };
      }

      if (
        !pool.bTokenRate ||
        !bTokensToBurn ||
        parseFloat(bTokensToBurn) <= 0
      ) {
        const msg = "Unable to calculate bTokens. Please try again.";
        setError(msg);
        return { success: false, error: msg };
      }

      setIsLoading(true);
      setError(null);

      try {
        const withdrawXdr = await withdrawFromPool(
          pool.assetCode,
          bTokensToBurn,
          decimals,
          address
        );
        await signAndSend(withdrawXdr);
        await new Promise((r) => setTimeout(r, LENDING_CONFIG.postTxDelayMs));

        await onSuccess?.();
        return { success: true };
      } catch (err) {
        const errorMessage = extractContractErrorOrNull(err);
        const errorString =
          typeof errorMessage === "string"
            ? errorMessage
            : "An unexpected error occurred. Please try again.";
        setError(errorString);
        return { success: false, error: errorString };
      } finally {
        setIsLoading(false);
      }
    },
    [address, signAndSend]
  );

  return {
    executeDeposit,
    executeWithdraw,
    isLoading,
    error,
    clearError,
  };
}
