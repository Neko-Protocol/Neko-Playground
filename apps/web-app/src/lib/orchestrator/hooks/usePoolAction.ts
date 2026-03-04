"use client";

/**
 * usePoolAction — React Query mutation hook for pool write operations
 * (deposit, withdraw, claimRewards).
 *
 * Integrates with WalletProvider for transaction signing and
 * Sileo toasts for user feedback.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { sileo } from "sileo";
import { useWallet } from "@/hooks/useWallet";
import { rpcUrl, stellarNetwork } from "@/lib/constants/network";
import { isUserCancellationError } from "@/lib/helpers/stellar/contractErrors";
import { getExplorerUrl } from "@/lib/helpers/tokenUtils";
import { orchestrator } from "../core/Orchestrator";
import { POOLS_QUERY_KEY } from "./usePools";
import type { PoolAction, TransactionResult } from "../types/pool.types";

interface PoolActionParams {
  poolId: string;
  action: PoolAction;
  amount: bigint;
  tokenIndex?: number;
}

/**
 * Generic mutation that:
 *  1. Calls the orchestrator to build the unsigned XDR.
 *  2. Signs via `WalletProvider.signTransaction`.
 *  3. Submits the signed tx to Soroban RPC.
 *  4. Invalidates pool queries so data refreshes.
 */
export function usePoolAction() {
  const { address, signTransaction } = useWallet();
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

      // Wait for on-chain confirmation so refetch gets fresh data
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

    onSuccess: (hash, params) => {
      const actionLabel = capitalise(params.action);
      sileo.success({
        title: `${actionLabel} successful`,
        button: {
          title: "View tx",
          onClick: () =>
            window.open(getExplorerUrl(hash, stellarNetwork), "_blank"),
        },
      });
      queryClient.invalidateQueries({ queryKey: [...POOLS_QUERY_KEY] });
    },

    onError: (error: unknown, params) => {
      if (isUserCancellationError(error)) return;
      const msg = error instanceof Error ? error.message : "Transaction failed";
      sileo.error({
        title: `${capitalise(params.action)} failed`,
        description: msg,
      });
    },
  });
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
