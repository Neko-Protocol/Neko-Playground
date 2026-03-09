"use client";

import { useState, useCallback } from "react";
import { Networks } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import {
  approveToken,
  addCollateral,
  borrowFromPool,
} from "@/lib/helpers/stellar/lending";
import {
  signAndSendTransaction,
  type SignTransactionFn,
} from "@/lib/helpers/stellar/transaction";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { rpcUrl } from "@/lib/constants/network";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import type { BorrowExecutionParams } from "../types/borrowing";

export function useBorrowExecution() {
  const { addNotification } = useToast();
  const { address, signTransaction, networkPassphrase } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

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

  const handleBorrow = useCallback(
    async (params: BorrowExecutionParams) => {
      if (!address) {
        showError("Please connect your wallet first");
        return;
      }

      const {
        collateralTokenCode,
        assetCode,
        collateralAmount,
        borrowAmount,
        collateralDecimals = 7,
        borrowDecimals = 7,
      } = params;

      const collateralNum = parseFloat(collateralAmount);
      const borrowNum = parseFloat(borrowAmount);
      if (
        !Number.isFinite(collateralNum) ||
        collateralNum <= 0 ||
        !Number.isFinite(borrowNum) ||
        borrowNum <= 0
      ) {
        showError("Please enter valid collateral and borrow amounts");
        return;
      }

      const availableTokens = getAvailableTokens();
      const collateralToken = availableTokens[collateralTokenCode];
      const lendingContractId = params.contractId;

      if (!collateralToken?.contract) {
        showError(`Collateral token ${collateralTokenCode} not found`);
        return;
      }

      setIsLoading(true);

      const signAndSend = (xdr: string) =>
        signAndSendTransaction(xdr, signTransaction as SignTransactionFn, {
          networkPassphrase: networkPassphrase || Networks.TESTNET,
          rpcUrl,
          address,
          waitForPending: true,
        });

      try {
        const approveXdr = await approveToken(
          collateralToken.contract,
          lendingContractId,
          collateralAmount,
          collateralDecimals,
          address
        );
        await signAndSend(approveXdr);

        const addCollateralXdr = await addCollateral(
          collateralToken.contract,
          collateralAmount,
          collateralDecimals,
          address,
          lendingContractId
        );
        await signAndSend(addCollateralXdr);

        const borrowXdr = await borrowFromPool(
          assetCode,
          borrowAmount,
          borrowDecimals,
          address,
          lendingContractId
        );
        await signAndSend(borrowXdr);

        showSuccess(`Successfully borrowed ${borrowNum} ${assetCode}`);
        return { success: true as const };
      } catch (err) {
        const friendlyError = extractContractErrorOrNull(err);
        showError(
          typeof friendlyError === "string"
            ? friendlyError
            : "An unexpected error occurred. Please try again."
        );
        return { success: false as const, error: err };
      } finally {
        setIsLoading(false);
      }
    },
    [address, networkPassphrase, signTransaction, showError, showSuccess]
  );

  return {
    handleBorrow,
    isLoading,
    isWalletConnected: Boolean(address),
  };
}
