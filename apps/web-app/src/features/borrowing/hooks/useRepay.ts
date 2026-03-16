"use client";

import { useState, useCallback } from "react";
import { Networks } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { repayPool } from "@/lib/helpers/stellar/lending";
import {
  signAndSendTransaction,
  type SignTransactionFn,
} from "@/lib/helpers/stellar/transaction";
import { rpcUrl } from "@/lib/constants/network";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";

export interface RepayParams {
  assetCode: string;
  /** Raw dToken amount from get_d_token_balance (7 decimals) */
  dTokens: bigint;
  contractId: string;
}

export function useRepay() {
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
      addNotification("Repayment Successful", "success", {
        ...TOAST_CONFIG.defaultOpts,
        description: msg,
      }),
    [addNotification]
  );

  const handleRepay = useCallback(
    async (params: RepayParams) => {
      if (!address) {
        showError("Please connect your wallet first");
        return;
      }

      const { assetCode, dTokens, contractId } = params;

      if (dTokens <= 0n) {
        showError("No debt to repay");
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
        // The contract calls token.transfer(borrower, pool, amount) which uses
        // Soroban auth propagation — the prepared tx carries all necessary auth.
        // A separate approve tx is not needed and would cause PoolFrozen (#10).
        const repayXdr = await repayPool(
          assetCode,
          dTokens,
          address,
          contractId
        );
        await signAndSend(repayXdr);

        showSuccess(`Successfully repaid ${assetCode} debt`);
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
    handleRepay,
    isLoading,
    isWalletConnected: Boolean(address),
  };
}
