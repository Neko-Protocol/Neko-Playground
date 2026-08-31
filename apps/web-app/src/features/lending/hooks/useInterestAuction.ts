"use client";

import { useCallback, useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Networks } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import {
  canCreateInterestAuction,
  getAccumulatedInterest,
  createInterestAuctionXdr,
  fillInterestAuctionXdr,
  type FillInterestAuctionParams,
} from "@/lib/helpers/stellar/lending";
import {
  signAndSendTransaction,
  type SignTransactionFn,
} from "@/lib/helpers/stellar/transaction";
import { rpcUrl } from "@/lib/constants/network";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { useLendingPools } from "./useLendingPools";
import { networks } from "@neko/lending";

export interface InterestAuctionAsset {
  assetCode: string;
  contractId: string;
  canCreate: boolean;
  accumulatedInterest: bigint;
  accumulatedInterestFormatted: string;
  decimals: number;
}

export const INTEREST_AUCTION_QUERY_KEY = "interestAuction";

export function useInterestAuction() {
  const queryClient = useQueryClient();
  const { addNotification } = useToast();
  const { address, signTransaction, networkPassphrase } = useWallet();
  const { data: lendingPools = [], refetch: refetchPools } = useLendingPools();

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

  const assetQueries = useQueries({
    queries: lendingPools.map((pool) => ({
      queryKey: [INTEREST_AUCTION_QUERY_KEY, pool.assetCode, pool.contractId],
      queryFn: async (): Promise<InterestAuctionAsset> => {
        const [canCreate, accumulatedInterest] = await Promise.all([
          canCreateInterestAuction(pool.assetCode, pool.contractId),
          getAccumulatedInterest(pool.assetCode, pool.contractId),
        ]);

        const decimals = 7;
        const accumulatedInterestFormatted =
          accumulatedInterest > 0n
            ? fromSmallestUnit(accumulatedInterest.toString(), decimals)
            : "0";

        return {
          assetCode: pool.assetCode,
          contractId: pool.contractId,
          canCreate,
          accumulatedInterest,
          accumulatedInterestFormatted,
          decimals,
        };
      },
      staleTime: 60_000,
      enabled: !!pool.assetCode && !!pool.contractId,
    })),
  });

  const assets: InterestAuctionAsset[] = useMemo(
    () =>
      assetQueries
        .filter((q) => q.data)
        .map((q) => q.data!) as InterestAuctionAsset[],
    [assetQueries]
  );

  const isLoadingAssets = assetQueries.some((q) => q.isLoading);
  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [INTEREST_AUCTION_QUERY_KEY] });
    refetchPools();
  }, [queryClient, refetchPools]);

  const createAuction = useCallback(
    async (assetCode: string, contractId: string) => {
      if (!address) {
        showError("Please connect your wallet first");
        return { success: false as const, auctionId: undefined };
      }

      try {
        const xdr = await createInterestAuctionXdr(
          assetCode,
          address,
          contractId
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

        showSuccess(`Interest auction created for ${assetCode}`);
        invalidateQueries();
        return { success: true as const, auctionId: undefined };
      } catch (err) {
        const friendlyError = extractContractErrorOrNull(err);
        showError(
          typeof friendlyError === "string"
            ? friendlyError
            : "Failed to create interest auction. Please try again."
        );
        return { success: false as const, auctionId: undefined };
      }
    },
    [
      address,
      networkPassphrase,
      signTransaction,
      showError,
      showSuccess,
      invalidateQueries,
    ]
  );

  const fillAuction = useCallback(
    async (params: {
      auctionId: number;
      assetCode: string;
      contractId: string;
      fillPercent: number;
    }) => {
      if (!address) {
        showError("Please connect your wallet first");
        return { success: false as const };
      }

      if (
        params.fillPercent <= 0 ||
        params.fillPercent > 100 ||
        !Number.isFinite(params.fillPercent)
      ) {
        showError("Fill percentage must be between 1 and 100");
        return { success: false as const };
      }

      try {
        const fillParams: FillInterestAuctionParams = {
          auctionId: params.auctionId,
          bidder: address,
          asset: params.assetCode,
          fillPercent: params.fillPercent,
        };

        const xdr = await fillInterestAuctionXdr(fillParams, params.contractId);

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
          `Successfully participated in auction #${params.auctionId} for ${params.assetCode}`
        );
        invalidateQueries();
        return { success: true as const };
      } catch (err) {
        const friendlyError = extractContractErrorOrNull(err);
        showError(
          typeof friendlyError === "string"
            ? friendlyError
            : "Failed to participate in auction. Please try again."
        );
        return { success: false as const };
      }
    },
    [
      address,
      networkPassphrase,
      signTransaction,
      showError,
      showSuccess,
      invalidateQueries,
    ]
  );

  return {
    assets,
    isLoadingAssets,
    hasWallet: !!address,
    createAuction,
    fillAuction,
    poolContractIds: {
      pool1: networks.testnet.pool1ContractId,
      pool2: networks.testnet.pool2ContractId,
    },
  };
}
