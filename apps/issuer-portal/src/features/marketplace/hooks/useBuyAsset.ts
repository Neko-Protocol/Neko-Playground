"use client";

import { useMutation } from "@tanstack/react-query";
import { NEKO_DISTRIBUTOR_CONTRACT_ID } from "@/lib/constants";
import {
  buildApproveXlmOp,
  buildBuyOp,
  prepareOperationXdr,
  simulateCanTransfer,
  stroopsFromXlm,
} from "@/lib/stellar/contract";
import { submitPreparedTransaction } from "@/lib/stellar/transactions";
import { useWallet } from "@/hooks/useWallet";
import type { ListedAsset } from "@/types";

function scaledAmount(human: string, decimals: number): bigint {
  const [whole, fraction = ""] = human.split(".");
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt((whole || "0") + padded);
}

interface BuyInput {
  asset: ListedAsset;
  /** Token amount in human units, e.g. "25". */
  tokenAmount: string;
}

export function useBuyAsset() {
  const { address, networkPassphrase, signTransaction } = useWallet();

  return useMutation({
    mutationFn: async ({ asset, tokenAmount }: BuyInput) => {
      if (!address) throw new Error("Connect your wallet first");
      if (!NEKO_DISTRIBUTOR_CONTRACT_ID) {
        throw new Error("NEKO_DISTRIBUTOR_CONTRACT_ID not configured");
      }

      const baseAmount = scaledAmount(tokenAmount, asset.decimals);
      if (baseAmount <= 0n) throw new Error("Amount must be > 0");

      const canTransfer = await simulateCanTransfer(
        address,
        asset.contractId,
        NEKO_DISTRIBUTOR_CONTRACT_ID,
        address,
        baseAmount
      );
      if (!canTransfer) {
        throw new Error(
          "The issuer's token rejected the transfer. If this is a T-REX token, your identity must be registered by the issuer."
        );
      }

      const totalStroops = stroopsFromXlm(asset.priceXlm) * BigInt(tokenAmount);
      const approveXdr = await prepareOperationXdr(
        address,
        buildApproveXlmOp(address, NEKO_DISTRIBUTOR_CONTRACT_ID, totalStroops)
      );
      const signedApprove = await signTransaction(approveXdr, {
        networkPassphrase,
        address,
      });
      const approveHash = await submitPreparedTransaction(
        signedApprove.signedTxXdr
      );

      const buyXdr = await prepareOperationXdr(
        address,
        buildBuyOp(
          NEKO_DISTRIBUTOR_CONTRACT_ID,
          address,
          asset.contractId,
          baseAmount
        )
      );
      const signedBuy = await signTransaction(buyXdr, {
        networkPassphrase,
        address,
      });
      const buyHash = await submitPreparedTransaction(signedBuy.signedTxXdr);

      return {
        approveHash: approveHash.hash,
        buyHash: buyHash.hash,
      };
    },
  });
}
