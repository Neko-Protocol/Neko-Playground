"use client";

import { useState, useCallback } from "react";
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { rpc } from "@stellar/stellar-sdk";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import {
  depositToBackstop,
  initiateBackstopWithdrawal,
  withdrawFromBackstop,
  approveToken,
  getBackstopToken,
  getBackstopDeposit,
  getTokenBalance,
} from "@/lib/helpers/stellar/lending";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { rpcUrl, stellarNetwork } from "@/lib/config/stellar.config";

const WITHDRAWAL_QUEUE_DAYS = 17;
const WITHDRAWAL_QUEUE_SECONDS = BigInt(WITHDRAWAL_QUEUE_DAYS * 24 * 60 * 60);

export function useBackstop(contractId: string) {
  const [isLoading, setIsLoading] = useState(false);

  const { address, signTransaction, networkPassphrase } = useWallet();
  const { addNotification } = useToast();

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

  // Fetch the backstop token address from the contract
  const { data: backstopTokenAddress } = useQuery({
    queryKey: ["backstopToken", contractId],
    queryFn: () => getBackstopToken(contractId),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Fetch the user's wallet balance of the backstop token
  const {
    data: walletBalance,
    isLoading: isLoadingWalletBalance,
    refetch: refetchWalletBalance,
  } = useQuery({
    queryKey: ["backstopWalletBalance", address, backstopTokenAddress],
    queryFn: async () => {
      if (!address || !backstopTokenAddress) return "0";
      const raw = await getTokenBalance(backstopTokenAddress, address);
      return fromSmallestUnit(raw.toString(), 7);
    },
    enabled: !!address && !!backstopTokenAddress,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  // Fetch the user's deposited backstop balance and queue status
  const {
    data: depositInfo,
    isLoading: isLoadingDeposit,
    refetch: refetchDepositInfo,
  } = useQuery({
    queryKey: ["backstopDeposit", address, contractId],
    queryFn: async () => {
      if (!address) return null;
      return getBackstopDeposit(address, contractId);
    },
    enabled: !!address,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchWalletBalance(), refetchDepositInfo()]);
  }, [refetchWalletBalance, refetchDepositInfo]);

  // Deposit to backstop
  const handleDeposit = useCallback(
    async (amount: string) => {
      if (!address || !amount || parseFloat(amount) <= 0) return;
      setIsLoading(true);
      try {
        const passphrase = networkPassphrase || Networks.TESTNET;
        const sorobanServer = new rpc.Server(rpcUrl, {
          allowHttp: stellarNetwork === "LOCAL",
        });

        // Approve backstop token to the lending contract first (if token is configured)
        if (backstopTokenAddress) {
          const approveXdr = await approveToken(
            backstopTokenAddress,
            contractId,
            amount,
            7,
            address
          );
          const signedApprove = await signTransaction(approveXdr as any, {
            networkPassphrase: passphrase,
            address,
          });
          await sorobanServer.sendTransaction(
            TransactionBuilder.fromXDR(signedApprove.signedTxXdr, passphrase)
          );
          await new Promise((r) => setTimeout(r, 2000));
        }

        const depositXdr = await depositToBackstop(amount, address, contractId);
        const signedDeposit = await signTransaction(depositXdr as any, {
          networkPassphrase: passphrase,
          address,
        });
        await sorobanServer.sendTransaction(
          TransactionBuilder.fromXDR(signedDeposit.signedTxXdr, passphrase)
        );

        await new Promise((r) => setTimeout(r, 3000));
        await refetchAll();
        showSuccess(`Successfully deposited ${amount} tokens to backstop`);
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
      backstopTokenAddress,
      networkPassphrase,
      signTransaction,
      refetchAll,
      showError,
      showSuccess,
    ]
  );

  // Enter the 17-day withdrawal queue
  const handleInitiateWithdrawal = useCallback(
    async (amount: string) => {
      if (!address || !amount || parseFloat(amount) <= 0) return;
      setIsLoading(true);
      try {
        const passphrase = networkPassphrase || Networks.TESTNET;
        const sorobanServer = new rpc.Server(rpcUrl, {
          allowHttp: stellarNetwork === "LOCAL",
        });

        const xdr = await initiateBackstopWithdrawal(
          amount,
          address,
          contractId
        );
        const signed = await signTransaction(xdr as any, {
          networkPassphrase: passphrase,
          address,
        });
        await sorobanServer.sendTransaction(
          TransactionBuilder.fromXDR(signed.signedTxXdr, passphrase)
        );

        await new Promise((r) => setTimeout(r, 3000));
        await refetchAll();
        showSuccess(
          `Withdrawal queued. You can withdraw after ${WITHDRAWAL_QUEUE_DAYS} days.`
        );
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
      networkPassphrase,
      signTransaction,
      refetchAll,
      showError,
      showSuccess,
    ]
  );

  // Execute withdrawal after queue period
  const handleWithdraw = useCallback(
    async (amount: string) => {
      if (!address || !amount || parseFloat(amount) <= 0) return;
      setIsLoading(true);
      try {
        const passphrase = networkPassphrase || Networks.TESTNET;
        const sorobanServer = new rpc.Server(rpcUrl, {
          allowHttp: stellarNetwork === "LOCAL",
        });

        const xdr = await withdrawFromBackstop(amount, address, contractId);
        const signed = await signTransaction(xdr as any, {
          networkPassphrase: passphrase,
          address,
        });
        await sorobanServer.sendTransaction(
          TransactionBuilder.fromXDR(signed.signedTxXdr, passphrase)
        );

        await new Promise((r) => setTimeout(r, 3000));
        await refetchAll();
        showSuccess(`Successfully withdrew ${amount} tokens from backstop`);
      } catch (err) {
        const errStr = String(err);
        if (
          errStr.includes("WithdrawalQueueNotExpired") ||
          errStr.includes("#72")
        ) {
          showError(
            `Your withdrawal queue period has not yet expired. Please wait ${WITHDRAWAL_QUEUE_DAYS} days after queuing before withdrawing.`
          );
          return;
        }
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
      networkPassphrase,
      signTransaction,
      refetchAll,
      showError,
      showSuccess,
    ]
  );

  // Derive queue expiry info
  const queueExpiresAt: Date | null =
    depositInfo?.inWithdrawalQueue && depositInfo.queuedAt
      ? new Date(Number(depositInfo.queuedAt + WITHDRAWAL_QUEUE_SECONDS) * 1000)
      : null;

  const queueExpired = queueExpiresAt !== null && new Date() >= queueExpiresAt;

  return {
    isLoading,
    walletBalance: walletBalance ?? "0",
    isLoadingWalletBalance,
    depositedAmount: depositInfo
      ? fromSmallestUnit(depositInfo.amount.toString(), 7)
      : "0",
    isLoadingDeposit,
    inWithdrawalQueue: depositInfo?.inWithdrawalQueue ?? false,
    queueExpiresAt,
    queueExpired,
    backstopTokenConfigured: !!backstopTokenAddress,
    hasWallet: !!address,
    handleDeposit,
    handleInitiateWithdrawal,
    handleWithdraw,
    refetchAll,
  };
}
