"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { rpcUrl } from "@/lib/constants/network";
import { isUserCancellationError } from "@/lib/helpers/stellar/contractErrors";
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
        case "supplyCollateral":
          result = await orchestrator.deposit(
            poolId,
            address,
            amount,
            tokenIndex
          );
          break;
        case "withdraw":
        case "withdrawCollateral":
          result = await orchestrator.withdraw(
            poolId,
            address,
            amount,
            tokenIndex
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

      const signed = await signTransaction(result.xdr, {
        networkPassphrase: result.networkPassphrase,
      });

      const signedXdr =
        typeof signed === "string"
          ? signed
          : ((signed as { signedTxXdr?: string }).signedTxXdr ?? "");

      const server = new rpc.Server(rpcUrl, { allowHttp: true });
      const tx = TransactionBuilder.fromXDR(
        signedXdr,
        result.networkPassphrase
      );
      const txResult = await server.sendTransaction(tx);

      if (txResult.status === "ERROR") {
        throw new Error(`Transaction failed: ${txResult.status}`);
      }

      const confirmed = await server.pollTransaction(txResult.hash, {
        attempts: 30,
      });
      if (confirmed.status !== "SUCCESS") {
        throw new Error(
          confirmed.status === "FAILED"
            ? "Transaction failed on-chain"
            : "Transaction confirmation timeout"
        );
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
