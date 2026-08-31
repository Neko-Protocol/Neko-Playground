"use client";

import { useState, useCallback } from "react";
import { Networks } from "@stellar/stellar-sdk";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { useCountdown } from "@/hooks/useCountdown";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import {
  depositToBackstop,
  initiateBackstopWithdrawal,
  withdrawFromBackstop,
  getBackstopToken,
  getBackstopDeposit,
  getTokenBalance,
} from "@/lib/helpers/stellar/lending";
import { executeTransaction } from "@/lib/helpers/stellar/executeTransaction";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import {
  BACKSTOP_TOKEN_DECIMALS,
  BACKSTOP_WITHDRAWAL_QUEUE_DAYS,
} from "../const/backstop";
import { validateBackstopAmount } from "../utils/validateBackstopAmount";

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

  const { data: backstopTokenAddress } = useQuery({
    queryKey: ["backstopToken", contractId],
    queryFn: () => getBackstopToken(contractId),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: walletBalance,
    isLoading: isLoadingWalletBalance,
    refetch: refetchWalletBalance,
  } = useQuery({
    queryKey: ["backstopWalletBalance", address, backstopTokenAddress],
    queryFn: async () => {
      if (!address || !backstopTokenAddress) return "0";
      const raw = await getTokenBalance(backstopTokenAddress, address);
      return fromSmallestUnit(raw.toString(), BACKSTOP_TOKEN_DECIMALS);
    },
    enabled: !!address && !!backstopTokenAddress,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

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

  const walletBalanceValue = walletBalance ?? "0";
  const depositedAmount = depositInfo
    ? fromSmallestUnit(depositInfo.amount.toString(), BACKSTOP_TOKEN_DECIMALS)
    : "0";
  const activeDepositAmount = depositInfo
    ? fromSmallestUnit(
        depositInfo.activeAmount.toString(),
        BACKSTOP_TOKEN_DECIMALS
      )
    : "0";
  const queuedDepositAmount = depositInfo
    ? fromSmallestUnit(
        depositInfo.queuedAmount.toString(),
        BACKSTOP_TOKEN_DECIMALS
      )
    : "0";

  const queueExpiresAt: Date | null =
    depositInfo?.inWithdrawalQueue && depositInfo.queuedAt
      ? new Date(Number(depositInfo.queuedAt) * 1000)
      : null;

  const { expired: countdownExpired } = useCountdown(queueExpiresAt);
  const queueExpired = queueExpiresAt !== null && countdownExpired;

  const resolveTxErrorMessage = useCallback(
    (
      result: Exclude<
        Awaited<ReturnType<typeof executeTransaction>>,
        { status: "success" }
      >
    ) => {
      if (result.status === "user_rejected") return null;
      if (result.status === "contract_error") {
        if (result.error.kind === "withdrawal_queue_not_expired") {
          return `Your withdrawal queue period has not yet expired. Please wait ${BACKSTOP_WITHDRAWAL_QUEUE_DAYS} days after queuing before withdrawing.`;
        }
        return result.error.message;
      }
      return result.message;
    },
    []
  );

  const runBackstopTransaction = useCallback(
    async (
      amount: string,
      action: "deposit" | "queue" | "withdraw",
      buildXdr: () => Promise<string>,
      successMessage: string
    ): Promise<boolean> => {
      if (!address) return false;

      const validation = validateBackstopAmount({
        action,
        amount,
        walletBalance: walletBalanceValue,
        activeDepositAmount,
        queuedDepositAmount,
      });
      if (!validation.valid) {
        showError(validation.message);
        return false;
      }

      setIsLoading(true);
      try {
        const passphrase = networkPassphrase || Networks.TESTNET;
        const xdr = await buildXdr();
        const result = await executeTransaction({
          xdr,
          signTransaction,
          networkPassphrase: passphrase,
          address,
          contractName: "rwa-lending",
          confirmation: "wait",
        });

        if (result.status !== "success") {
          const msg = resolveTxErrorMessage(result);
          if (msg) showError(msg);
          return false;
        }

        await refetchAll();
        showSuccess(successMessage);
        return true;
      } catch (err) {
        showError("An unexpected error occurred.");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [
      address,
      walletBalanceValue,
      activeDepositAmount,
      queuedDepositAmount,
      networkPassphrase,
      signTransaction,
      refetchAll,
      showError,
      showSuccess,
      resolveTxErrorMessage,
    ]
  );

  const handleDeposit = useCallback(
    (amount: string) =>
      runBackstopTransaction(
        amount,
        "deposit",
        () => depositToBackstop(amount, address!, contractId),
        `Successfully deposited ${amount} tokens to backstop`
      ),
    [runBackstopTransaction, address, contractId]
  );

  const handleInitiateWithdrawal = useCallback(
    (amount: string) =>
      runBackstopTransaction(
        amount,
        "queue",
        () => initiateBackstopWithdrawal(amount, address!, contractId),
        `Withdrawal queued. You can withdraw after ${BACKSTOP_WITHDRAWAL_QUEUE_DAYS} days.`
      ),
    [runBackstopTransaction, address, contractId]
  );

  const handleWithdraw = useCallback(
    (amount: string) =>
      runBackstopTransaction(
        amount,
        "withdraw",
        () => withdrawFromBackstop(amount, address!, contractId),
        `Successfully withdrew ${amount} tokens from backstop`
      ),
    [runBackstopTransaction, address, contractId]
  );

  return {
    isLoading,
    walletBalance: walletBalanceValue,
    isLoadingWalletBalance,
    depositedAmount,
    activeDepositAmount,
    queuedDepositAmount,
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
