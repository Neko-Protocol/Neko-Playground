"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { isUserCancellationError } from "@/lib/helpers/stellar/contractErrors";
import { executeTransaction } from "@/lib/helpers/stellar/executeTransaction";
import { orchestrator } from "../core/Orchestrator";
import { POOLS_QUERY_KEY } from "./usePools";
import type { PoolAction, TransactionResult } from "../types/pool.types";

interface PoolActionParams {
  poolId: string;
  action: PoolAction;
  amount: bigint;
  tokenIndex?: number;
}

export function usePoolAction() {
  const { address, signTransaction } = useWallet();
  const { addNotification } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: PoolActionParams): Promise<string> => {
      const { poolId, action, amount, tokenIndex } = params;

      if (!address) throw new Error("Wallet not connected");

      let result: TransactionResult;

      switch (action) {
        case "deposit":
          result = await orchestrator.deposit(
            poolId,
            address,
            amount,
            tokenIndex
          );
          break;
        case "supplyCollateral":
          result = await orchestrator.supplyCollateral(poolId, address, amount);
          break;
        case "withdraw":
          result = await orchestrator.withdraw(
            poolId,
            address,
            amount,
            tokenIndex
          );
          break;
        case "withdrawCollateral":
          result = await orchestrator.withdrawCollateral(
            poolId,
            address,
            amount
          );
          break;
        case "borrow":
          result = await orchestrator.borrow(poolId, address, amount);
          break;
        case "repay":
          result = await orchestrator.repay(poolId, address, amount);
          break;
        case "claimRewards":
          result = await orchestrator.claimRewards(poolId, address);
          break;
        default:
          throw new Error(`Unsupported action: ${action}`);
      }

      const txResult = await executeTransaction({
        xdr: result.xdr,
        signTransaction,
        networkPassphrase: result.networkPassphrase,
        address,
        confirmation: "poll",
        pollOptions: { attempts: 30 },
      });

      if (txResult.status === "user_rejected") {
        throw new Error("Transaction cancelled");
      }
      if (txResult.status === "contract_error") {
        throw new Error(txResult.error.message);
      }
      if (txResult.status === "network_error") {
        throw new Error(txResult.message);
      }

      return txResult.hash;
    },

    onSuccess: (_hash, params) => {
      addNotification(`${capitalise(params.action)} successful`, "success");
      queryClient.invalidateQueries({ queryKey: [...POOLS_QUERY_KEY] });
    },

    onError: (error: unknown, params) => {
      if (isUserCancellationError(error)) return;
      const msg = error instanceof Error ? error.message : "Transaction failed";
      addNotification(`${capitalise(params.action)} failed: ${msg}`, "error");
    },
  });
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
