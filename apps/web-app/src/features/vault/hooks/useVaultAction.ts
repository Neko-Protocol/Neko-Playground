"use client";

import { useState, useCallback } from "react";
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { rpc } from "@stellar/stellar-sdk";
import { Client as DefindexVaultClient } from "@neko/defindex-vault";
import { useWallet } from "@/hooks/useWallet";
import { useHaptic } from "@/hooks/useHaptic";
import { useToast } from "@/hooks/useToast";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import {
  rpcUrl as configRpcUrl,
  stellarNetwork,
} from "@/lib/config/stellar.config";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { toSmallestUnit } from "@/lib/helpers/tokenUtils";
import { useVaultBalance } from "./useVaultBalance";
import { useVaultData } from "./useVaultData";

const VAULT_CONTRACT_ID =
  "CBHGX6TCHHVYJ7P3UZS7WI5TRAAA7GQA2L2Y7P2LCPIXWWD5FKDF2Z5S";

const SLIPPAGE = 0.01;

/**
 * Signs and submits a simulated AssembledTransaction by:
 * 1. Getting the XDR (already includes simulation auth entries)
 * 2. Signing with the user's wallet (Freighter handles Soroban auth in the XDR)
 * 3. Submitting via rpc.Server
 *
 * Bypasses SDK's signAndSend() which crashes on .switch() in some v14 builds.
 */
async function signAndSubmit(
  xdr: string,
  passphrase: string,
  signFn: (
    xdr: string,
    opts: { networkPassphrase: string; address?: string }
  ) => Promise<{ signedTxXdr: string }>,
  address: string
) {
  const server = new rpc.Server(configRpcUrl, {
    allowHttp: stellarNetwork === "LOCAL",
  });
  const signed = await signFn(xdr, { networkPassphrase: passphrase, address });
  return server.sendTransaction(
    TransactionBuilder.fromXDR(signed.signedTxXdr, passphrase)
  );
}

export function useVaultAction() {
  const [isLoading, setIsLoading] = useState(false);

  const {
    address,
    signTransaction,
    networkPassphrase: walletPassphrase,
  } = useWallet();
  const { trigger } = useHaptic();
  const { addNotification } = useToast();
  const { refetch: refetchBalance } = useVaultBalance();
  const { refetch: refetchVaultData } = useVaultData();

  const showError = useCallback(
    (msg: string) => {
      trigger("error");
      addNotification("Something went wrong", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: msg,
      });
    },
    [addNotification, trigger]
  );
  const showSuccess = useCallback(
    (msg: string) => {
      trigger("success");
      addNotification("Success", "success", {
        ...TOAST_CONFIG.defaultOpts,
        description: msg,
      });
    },
    [addNotification, trigger]
  );

  const handleDeposit = useCallback(
    async (amount: string) => {
      if (!address || !amount || parseFloat(amount) <= 0) return;
      setIsLoading(true);

      try {
        const passphrase = walletPassphrase || Networks.TESTNET;

        // Client needs publicKey so simulation uses the real user account
        const client = new DefindexVaultClient({
          contractId: VAULT_CONTRACT_ID,
          rpcUrl,
          networkPassphrase,
          publicKey: address,
          ...(allowHttpForSoroban && { allowHttp: true }),
        });

        const amountBigInt = BigInt(toSmallestUnit(amount, 7));
        const minAmount =
          amountBigInt -
          (amountBigInt * BigInt(Math.floor(SLIPPAGE * 100))) / 100n;

        // Simulate — the resulting XDR already includes Soroban auth entries
        const depositTx = await client.deposit({
          amounts_desired: [amountBigInt],
          amounts_min: [minAmount],
          from: address,
          invest: false,
        });

        // Sign + submit the simulated XDR directly (Freighter handles auth entries)
        await signAndSubmit(
          depositTx.toXDR(),
          passphrase,
          signTransaction,
          address
        );

        await new Promise((r) => setTimeout(r, 3000));
        await Promise.all([refetchBalance(), refetchVaultData()]);
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
      signTransaction,
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

        const sharesBigInt = BigInt(toSmallestUnit(shares, 7));

        const withdrawTx = await client.withdraw({
          withdraw_shares: sharesBigInt,
          min_amounts_out: [0n],
          from: address,
        });

        await signAndSubmit(
          withdrawTx.toXDR(),
          passphrase,
          signTransaction,
          address
        );

        await new Promise((r) => setTimeout(r, 3000));
        await Promise.all([refetchBalance(), refetchVaultData()]);
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
      signTransaction,
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
