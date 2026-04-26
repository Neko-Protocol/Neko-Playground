"use client";

import { useState, useCallback } from "react";
import { Networks } from "@stellar/stellar-sdk";
import { useHaptic } from "@/hooks/useHaptic";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { removeCollateral } from "@/lib/helpers/stellar/lending";
import {
  signAndSendTransaction,
  type SignTransactionFn,
} from "@/lib/helpers/stellar/transaction";
import { rpcUrl } from "@/lib/constants/network";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";

export interface RemoveCollateralParams {
  rwaTokenAddress: string;
  amount: string;
  collateralTokenCode: string;
  contractId: string;
  decimals?: number;
}

export function useRemoveCollateral() {
  const { addNotification } = useToast();
  const { trigger } = useHaptic();
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
      addNotification("Collateral Removed", "success", {
        ...TOAST_CONFIG.defaultOpts,
        description: msg,
      }),
    [addNotification]
  );

  const handleRemoveCollateral = useCallback(
    async (params: RemoveCollateralParams) => {
      if (!address) {
        showError("Please connect your wallet first");
        return;
      }

      const {
        rwaTokenAddress,
        amount,
        collateralTokenCode,
        contractId,
        decimals = 7,
      } = params;

      const amountNum = parseFloat(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        showError("Please enter a valid amount");
        return;
      }

      setIsLoading(true);

      const signAndSend = (xdr: string) =>
        signAndSendTransaction(xdr, signTransaction as SignTransactionFn, {
          networkPassphrase: networkPassphrase || Networks.TESTNET,
          rpcUrl,
          address,
          waitForPending: true,
          onConfirmed: () => trigger("success"),
          onError: () => trigger("error"),
        });

      try {
        const removeXdr = await removeCollateral(
          rwaTokenAddress,
          amount,
          decimals,
          address,
          contractId
        );
        await signAndSend(removeXdr);

        showSuccess(
          `Successfully removed ${amount} ${collateralTokenCode} collateral`
        );
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
      showError,
      showSuccess,
      trigger,
    ]
  );

  return {
    handleRemoveCollateral,
    isLoading,
    isWalletConnected: Boolean(address),
  };
}
