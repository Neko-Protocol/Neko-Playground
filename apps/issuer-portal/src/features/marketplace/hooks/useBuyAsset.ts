"use client";

import { useMutation } from "@tanstack/react-query";
import { NEKO_LISTING_REGISTRY_CONTRACT_ID } from "@/lib/constants";
import {
  buildBuyOp,
  prepareOperationXdr,
  simulateCanTransfer,
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
  /** Slippage protection: stroops per token base unit. */
  maxPricePerTokenStroops: bigint;
}

export interface BuyResult {
  buyHash: string;
  releaseTx: string;
  mockRelease: boolean;
}

export function useBuyAsset() {
  const { address, networkPassphrase, signTransaction } = useWallet();

  return useMutation({
    mutationFn: async ({
      asset,
      tokenAmount,
      maxPricePerTokenStroops,
    }: BuyInput): Promise<BuyResult> => {
      if (!address) throw new Error("Connect your wallet first");
      if (!NEKO_LISTING_REGISTRY_CONTRACT_ID) {
        throw new Error(
          "NEXT_PUBLIC_NEKO_LISTING_REGISTRY_CONTRACT_ID not configured"
        );
      }

      const baseAmount = scaledAmount(tokenAmount, asset.decimals);
      if (baseAmount <= 0n) throw new Error("Amount must be > 0");
      if (maxPricePerTokenStroops <= 0n) {
        throw new Error("Max price must be > 0");
      }

      // Compliance preview: the escrow address must be allowed to send the
      // tokens to the buyer (T-REX `can_transfer` check).
      const compliant = await simulateCanTransfer(
        address,
        asset.contractId,
        asset.escrowAddress,
        address,
        baseAmount
      );
      if (!compliant) {
        throw new Error(
          "The token's compliance contract rejected this transfer. Make sure your wallet is registered on the issuer's identity registry."
        );
      }

      // Single signature: registry.buy charges XLM (issuer cut + Neko fee)
      // and decrements available supply.
      const buyXdr = await prepareOperationXdr(
        address,
        buildBuyOp(
          NEKO_LISTING_REGISTRY_CONTRACT_ID,
          address,
          asset.contractId,
          baseAmount,
          maxPricePerTokenStroops
        )
      );
      const { signedTxXdr } = await signTransaction(buyXdr, {
        networkPassphrase,
        address,
      });
      const { hash: buyHash } = await submitPreparedTransaction(signedTxXdr);

      // Trigger TW release. The server verifies the buy_executed event
      // matches the requested release before signing.
      const releaseRes = await fetch("/api/escrow/release", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          buyHash,
          escrowId: asset.escrowId,
          escrowAddress: asset.escrowAddress,
          tokenContract: asset.contractId,
          tokenDecimals: asset.decimals,
          buyerAddress: address,
          amountBaseUnits: baseAmount.toString(),
        }),
      });
      if (!releaseRes.ok) {
        const txt = await releaseRes.text();
        throw new Error(
          `Buy succeeded on-chain but escrow release failed: ${txt}`
        );
      }
      const release = (await releaseRes.json()) as {
        releaseTx: string;
        mock: boolean;
      };

      return {
        buyHash,
        releaseTx: release.releaseTx,
        mockRelease: release.mock,
      };
    },
  });
}
