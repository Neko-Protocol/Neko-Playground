"use client";

import { useState, useCallback } from "react";
import { Networks } from "@stellar/stellar-sdk";
import { sileo } from "sileo";
import { useWallet } from "@/hooks/useWallet";
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
import { networks } from "@neko/lending";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import type { BorrowExecutionParams } from "../types/borrowing";

export function useBorrowExecution() {
  const { address, signTransaction, networkPassphrase } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBorrow = useCallback(
    async (params: BorrowExecutionParams) => {
      if (!address) {
        setError("Please connect your wallet first");
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
        setError("Please enter valid collateral and borrow amounts");
        return;
      }

      const availableTokens = getAvailableTokens();
      const collateralToken = availableTokens[collateralTokenCode];
      const lendingContractId = networks.testnet.contractId;

      if (!collateralToken?.contract) {
        setError(`Collateral token ${collateralTokenCode} not found`);
        return;
      }

      setIsLoading(true);
      setError(null);

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
          address
        );
        await signAndSend(addCollateralXdr);

        const borrowXdr = await borrowFromPool(
          assetCode,
          borrowAmount,
          borrowDecimals,
          address
        );
        await signAndSend(borrowXdr);

        const message = `Successfully borrowed ${borrowNum} ${assetCode} using ${collateralNum} ${collateralTokenCode} as collateral`;
        sileo.success({ title: message });
        return {
          success: true as const,
          message,
        };
      } catch (err) {
        const friendlyError = extractContractErrorOrNull(err);
        const description =
          typeof friendlyError === "string"
            ? friendlyError
            : "An unexpected error occurred. Please try again.";
        if (friendlyError) setError(description);
        sileo.error({ title: "Borrow failed", description });
        return { success: false as const, error: err };
      } finally {
        setIsLoading(false);
      }
    },
    [address, networkPassphrase, signTransaction]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    handleBorrow,
    isLoading,
    error,
    clearError,
    isWalletConnected: Boolean(address),
  };
}
