"use client";

import { useState, useCallback } from "react";
import { Networks } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { removeCollateral } from "@/lib/helpers/stellar/lending";
import {
  signAndSendTransaction,
  type SignTransactionFn,
} from "@/lib/helpers/stellar/transaction";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { rpcUrl } from "@/lib/constants/network";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import type { BorrowPosition } from "./useUserBorrowPositions";

export function useRemoveCollateral() {
  const { addNotification } = useToast();
  const { address, signTransaction, networkPassphrase } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPosition, setSelectedPosition] =
    useState<BorrowPosition | null>(null);

  const openModal = useCallback((position: BorrowPosition) => {
    setSelectedPosition(position);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedPosition(null);
  }, []);

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

  const handleRemoveCollateral = useCallback(
    async (amount: string) => {
      if (!address || !selectedPosition) return;

      const amountNum = parseFloat(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        showError("Please enter a valid amount");
        return;
      }

      const availableTokens = getAvailableTokens();
      const collateralToken =
        availableTokens[selectedPosition.collateralTokenCode];

      if (!collateralToken?.contract) {
        showError(
          `Collateral token ${selectedPosition.collateralTokenCode} not found`
        );
        return;
      }

      setIsLoading(true);
      try {
        const xdr = await removeCollateral(
          collateralToken.contract,
          amount,
          7,
          address,
          selectedPosition.contractId
        );

        await signAndSendTransaction(
          xdr,
          signTransaction as SignTransactionFn,
          {
            networkPassphrase: networkPassphrase || Networks.TESTNET,
            rpcUrl,
            address,
            waitForPending: true,
          }
        );

        showSuccess(
          `Successfully removed ${amountNum} ${selectedPosition.collateralTokenCode} from collateral`
        );
        closeModal();
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
    [
      address,
      networkPassphrase,
      signTransaction,
      selectedPosition,
      showError,
      showSuccess,
      closeModal,
    ]
  );

  return {
    selectedPosition,
    isLoading,
    isWalletConnected: Boolean(address),
    openModal,
    closeModal,
    handleRemoveCollateral,
  };
}
