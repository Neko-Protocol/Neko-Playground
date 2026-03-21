"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Networks } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import {
  buildFillBadDebtAuctionXdr,
  getActiveBadDebtAuctions,
  type ActiveBadDebtAuction,
} from "@/lib/helpers/stellar/lending";
import {
  signAndSendTransaction,
  type SignTransactionFn,
} from "@/lib/helpers/stellar/transaction";
import { rpcUrl } from "@/lib/constants/network";
import { networks } from "@neko/lending";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";

export type { ActiveBadDebtAuction };

export function useBadDebt() {
  const { addNotification } = useToast();
  const { address, signTransaction, networkPassphrase } = useWallet();
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
    data: activeAuctions = [],
    isLoading: isLoadingAuctions,
    refetch: refetchAuctions,
  } = useQuery({
    queryKey: ["bad-debt-auctions", networks.testnet.contractId],
    queryFn: () => getActiveBadDebtAuctions(networks.testnet.contractId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

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
          "Successfully filled bad debt auction. You received backstop tokens at a discount."
        );
        await refetchAuctions();
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
    [
      address,
      networkPassphrase,
      signTransaction,
      showError,
      showSuccess,
      refetchAuctions,
    ]
  );

  return {
    activeAuctions,
    isLoadingAuctions,
    refetchAuctions,
    fillAuction,
    isFilling,
    isWalletConnected: Boolean(address),
  };
}
