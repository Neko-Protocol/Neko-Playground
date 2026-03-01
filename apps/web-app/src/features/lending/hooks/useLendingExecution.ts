"use client";

import { useState, useCallback } from "react";
import { Networks } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { lendingService } from "@/lib/services";
import {
  signAndSendTransaction,
  type SignTransactionFn,
} from "@/lib/helpers/stellar/transaction";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { rpcUrl } from "@/lib/constants/network";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { LENDING_DELAYS } from "../constants";
import type { DepositParams, WithdrawParams } from "../types/lending";

export function useLendingExecution() {
  const { address, signTransaction, networkPassphrase } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signAndSend = useCallback(
    (xdr: string) =>
      signAndSendTransaction(xdr, signTransaction as SignTransactionFn, {
        networkPassphrase: networkPassphrase || Networks.TESTNET,
        rpcUrl,
        address,
        waitForPending: true,
      }),
    [address, networkPassphrase, signTransaction]
  );

  const handleDeposit = useCallback(
    async (params: DepositParams) => {
      if (!address) {
        setError("Please connect your wallet first");
        return;
      }

      const { pool, amount } = params;
      const availableTokens = getAvailableTokens();
      const token = availableTokens[pool.assetCode];

      if (!token?.contract) {
        setError(`Token ${pool.assetCode} not found`);
        return;
      }

      const decimals = token.decimals || 7;
      setIsLoading(true);
      setError(null);

      try {
        const {
          approveXdr,
          depositXdr,
          error: buildError,
        } = await lendingService.depositWithApprove(
          token.contract,
          pool.assetCode,
          amount,
          decimals,
          address
        );

        if (buildError) throw new Error(buildError);

        await signAndSend(approveXdr);
        await new Promise((resolve) =>
          setTimeout(resolve, LENDING_DELAYS.afterApprove)
        );
        await signAndSend(depositXdr);

        return { success: true as const };
      } catch (err) {
        const friendlyError = extractContractErrorOrNull(err);
        if (friendlyError) {
          setError(
            typeof friendlyError === "string"
              ? friendlyError
              : "An unexpected error occurred. Please try again."
          );
        }
        return { success: false as const, error: err };
      } finally {
        setIsLoading(false);
      }
    },
    [address, signAndSend]
  );

  const handleWithdraw = useCallback(
    async (params: WithdrawParams) => {
      if (!address) {
        setError("Please connect your wallet first");
        return;
      }

      const { pool, bTokensToBurn } = params;
      const availableTokens = getAvailableTokens();
      const token = availableTokens[pool.assetCode];
      const decimals = token?.decimals || 7;

      setIsLoading(true);
      setError(null);

      try {
        const { xdr: withdrawXdr, error: buildError } =
          await lendingService.withdrawFromPool(
            pool.assetCode,
            bTokensToBurn,
            decimals,
            address
          );

        if (buildError) throw new Error(buildError);

        await signAndSend(withdrawXdr);

        return { success: true as const };
      } catch (err) {
        const friendlyError = extractContractErrorOrNull(err);
        if (friendlyError) {
          setError(
            typeof friendlyError === "string"
              ? friendlyError
              : "An unexpected error occurred. Please try again."
          );
        }
        return { success: false as const, error: err };
      } finally {
        setIsLoading(false);
      }
    },
    [address, signAndSend]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    handleDeposit,
    handleWithdraw,
    isLoading,
    error,
    clearError,
    isWalletConnected: Boolean(address),
  };
}
