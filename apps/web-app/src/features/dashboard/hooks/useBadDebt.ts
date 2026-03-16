"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Networks } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import {
  hasBadDebt,
  createBadDebtAuction,
  buildFillBadDebtAuctionXdr,
} from "@/lib/helpers/stellar/lending";
import {
  signAndSendTransaction,
  type SignTransactionFn,
} from "@/lib/helpers/stellar/transaction";
import { rpcUrl } from "@/lib/constants/network";
import { networks } from "@neko/lending";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";

export function useBadDebt() {
  const { addNotification } = useToast();
  const { address, signTransaction, networkPassphrase } = useWallet();
  const [checkTrigger, setCheckTrigger] = useState<{
    borrower: string;
    ts: number;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

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
    data: hasBadDebtResult,
    isLoading: isCheckingBadDebt,
    error: checkError,
    refetch: refetchBadDebt,
  } = useQuery({
    queryKey: ["bad-debt", checkTrigger?.borrower, checkTrigger?.ts],
    queryFn: () =>
      hasBadDebt(checkTrigger!.borrower, networks.testnet.contractId),
    enabled: !!checkTrigger?.borrower,
  });

  const checkBadDebt = useCallback((borrower: string) => {
    setCheckTrigger({ borrower, ts: Date.now() });
  }, []);

  const createAuction = useCallback(
    async (borrower: string, debtAsset: string) => {
      if (!address) {
        showError("Please connect your wallet first");
        return {
          success: false as const,
          error: new Error("Wallet not connected"),
        };
      }

      setIsCreating(true);

      const signAndSend = (xdr: string) =>
        signAndSendTransaction(xdr, signTransaction as SignTransactionFn, {
          networkPassphrase: networkPassphrase || Networks.TESTNET,
          rpcUrl,
          address,
          waitForPending: true,
        });

      try {
        const xdr = await createBadDebtAuction(
          borrower,
          debtAsset,
          address,
          networks.testnet.contractId
        );
        const { hash } = await signAndSend(xdr);

        showSuccess(
          `Bad debt auction created. Transaction: ${hash}. Check the explorer for auction_id.`
        );
        return { success: true as const, txHash: hash };
      } catch (err) {
        const friendlyError = extractContractErrorOrNull(err);
        showError(
          typeof friendlyError === "string"
            ? friendlyError
            : "An unexpected error occurred. Please try again."
        );
        return { success: false as const, error: err };
      } finally {
        setIsCreating(false);
      }
    },
    [address, networkPassphrase, signTransaction, showError, showSuccess]
  );

  const fillAuction = useCallback(
    async (auctionId: number, amount: string, debtAsset: string) => {
      if (!address) {
        showError("Please connect your wallet first");
        return {
          success: false as const,
          error: new Error("Wallet not connected"),
        };
      }

      const amountNum = parseFloat(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        showError("Please enter a valid amount");
        return { success: false as const, error: new Error("Invalid amount") };
      }

      setIsFilling(true);

      const signAndSend = (xdr: string) =>
        signAndSendTransaction(xdr, signTransaction as SignTransactionFn, {
          networkPassphrase: networkPassphrase || Networks.TESTNET,
          rpcUrl,
          address,
          waitForPending: true,
        });

      try {
        const { approveXdr, fillXdr } = await buildFillBadDebtAuctionXdr(
          auctionId,
          address,
          amount,
          debtAsset,
          7,
          address,
          networks.testnet.contractId
        );

        await signAndSend(approveXdr);
        await signAndSend(fillXdr);

        showSuccess(
          `Successfully filled bad debt auction. You received backstop tokens at a discount.`
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
        setIsFilling(false);
      }
    },
    [address, networkPassphrase, signTransaction, showError, showSuccess]
  );

  return {
    checkBadDebt,
    borrowerChecked: checkTrigger?.borrower ?? null,
    hasBadDebtResult: hasBadDebtResult ?? null,
    isCheckingBadDebt,
    checkError,
    refetchBadDebt,
    createAuction,
    isCreating,
    fillAuction,
    isFilling,
    isWalletConnected: Boolean(address),
  };
}
