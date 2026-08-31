"use client";

import { useState, useCallback } from "react";
import { Networks } from "@stellar/stellar-sdk";
import { Client as DefindexVaultClient } from "@neko/defindex-vault";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { executeTransaction } from "@/lib/helpers/stellar/executeTransaction";
import { toSmallestUnit } from "@/lib/helpers/tokenUtils";
import { useVaultBalance } from "./useVaultBalance";
import { useVaultData } from "./useVaultData";
import { useActivityStore } from "@/stores/activityStore";

const VAULT_CONTRACT_ID =
  "CBHGX6TCHHVYJ7P3UZS7WI5TRAAA7GQA2L2Y7P2LCPIXWWD5FKDF2Z5S";

const SLIPPAGE = 0.01;

export function useVaultAction() {
  const [isLoading, setIsLoading] = useState(false);

  const {
    address,
    signTransaction,
    networkPassphrase: walletPassphrase,
  } = useWallet();
  const { addNotification } = useToast();
  const { refetch: refetchBalance } = useVaultBalance();
  const { refetch: refetchVaultData } = useVaultData();

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

  const submitVaultTransaction = useCallback(
    async (xdr: string, passphrase: string): Promise<boolean> => {
      const result = await executeTransaction({
        xdr,
        signTransaction,
        networkPassphrase: passphrase,
        address: address!,
        confirmation: "none",
      });

      if (result.status === "success") return true;
      if (result.status === "user_rejected") return false;

      const msg =
        result.status === "contract_error"
          ? result.error.message
          : result.message;
      showError(msg);
      return false;
    },
    [address, signTransaction, showError]
  );

  const handleDeposit = useCallback(
    async (amount: string) => {
      if (!address || !amount || parseFloat(amount) <= 0) return;
      setIsLoading(true);

      try {
        const passphrase = walletPassphrase || Networks.TESTNET;

        const client = new DefindexVaultClient({
          contractId: VAULT_CONTRACT_ID,
          rpcUrl,
          networkPassphrase,
          publicKey: address,
          ...(allowHttpForSoroban && { allowHttp: true }),
        });

        const amountBigInt = toSmallestUnit(amount, 7);
        const SLIPPAGE_SCALE = 10_000_000n;
        const slippageScaled = toSmallestUnit(String(SLIPPAGE), 7);
        const minAmount =
          amountBigInt - (amountBigInt * slippageScaled) / SLIPPAGE_SCALE;

        const depositTx = await client.deposit({
          amounts_desired: [amountBigInt],
          amounts_min: [minAmount],
          from: address,
          invest: false,
        });

        const submitted = await submitVaultTransaction(
          depositTx.toXDR(),
          passphrase
        );
        if (!submitted) return;

        await new Promise((r) => setTimeout(r, 3000));
        await Promise.all([refetchBalance(), refetchVaultData()]);
        useActivityStore.getState().pushEvent({
          source: "vault",
          type: "deposit",
          timestamp: Date.now(),
          summary: `Deposited ${amount} CETES to vault`,
          link: "/vaults",
        });
        showSuccess(`Successfully deposited ${amount} CETES`);
      } catch (err) {
        const msg = extractContractErrorOrNull(err);
        showError(
          typeof msg === "string" ? msg : "An unexpected error occurred."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      address,
      walletPassphrase,
      submitVaultTransaction,
      refetchBalance,
      refetchVaultData,
      showError,
      showSuccess,
    ]
  );

  const handleWithdraw = useCallback(
    async (shares: string) => {
      if (!address || !shares || parseFloat(shares) <= 0) return;
      setIsLoading(true);

      try {
        const passphrase = walletPassphrase || Networks.TESTNET;

        const client = new DefindexVaultClient({
          contractId: VAULT_CONTRACT_ID,
          rpcUrl,
          networkPassphrase,
          publicKey: address,
          ...(allowHttpForSoroban && { allowHttp: true }),
        });

        const sharesBigInt = toSmallestUnit(shares, 7);

        const withdrawTx = await client.withdraw({
          withdraw_shares: sharesBigInt,
          min_amounts_out: [0n],
          from: address,
        });

        const submitted = await submitVaultTransaction(
          withdrawTx.toXDR(),
          passphrase
        );
        if (!submitted) return;

        await new Promise((r) => setTimeout(r, 3000));
        await Promise.all([refetchBalance(), refetchVaultData()]);
        useActivityStore.getState().pushEvent({
          source: "vault",
          type: "withdraw",
          timestamp: Date.now(),
          summary: `Withdrew ${shares} dfTokens from vault`,
          link: "/vaults",
        });
        showSuccess(`Successfully withdrew ${shares} dfTokens`);
      } catch (err) {
        const msg = extractContractErrorOrNull(err);
        showError(
          typeof msg === "string" ? msg : "An unexpected error occurred."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      address,
      walletPassphrase,
      submitVaultTransaction,
      refetchBalance,
      refetchVaultData,
      showError,
      showSuccess,
    ]
  );

  return {
    isLoading,
    hasWallet: !!address,
    handleDeposit,
    handleWithdraw,
  };
}
