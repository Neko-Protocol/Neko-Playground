"use client";

import { useMutation } from "@tanstack/react-query";
import { NEKO_DISTRIBUTOR_CONTRACT_ID } from "@/lib/constants";
import {
  buildListOp,
  prepareOperationXdr,
  stroopsFromXlm,
} from "@/lib/stellar/contract";
import { submitPreparedTransaction } from "@/lib/stellar/transactions";
import { useWallet } from "@/hooks/useWallet";
import type { LinkTokenValues } from "@/features/issuer/components/LinkTokenStep";

function scaledAmount(human: string, decimals: number): bigint {
  const [whole, fraction = ""] = human.split(".");
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt((whole || "0") + padded);
}

export interface ListAssetInput {
  token: LinkTokenValues;
  listedAmount: string;
  priceXlm: string;
}

export function useListAsset() {
  const { address, networkPassphrase, signTransaction } = useWallet();

  return useMutation({
    mutationFn: async ({ token, listedAmount, priceXlm }: ListAssetInput) => {
      if (!address) throw new Error("Connect your wallet first");
      if (!NEKO_DISTRIBUTOR_CONTRACT_ID) {
        throw new Error("NEKO_DISTRIBUTOR_CONTRACT_ID not configured");
      }

      const amountBase = scaledAmount(listedAmount, token.decimals);
      if (amountBase <= 0n) throw new Error("Amount must be > 0");
      const priceStroops = stroopsFromXlm(Number(priceXlm));
      if (priceStroops <= 0n) throw new Error("Price must be > 0");

      const xdr = await prepareOperationXdr(
        address,
        buildListOp(
          NEKO_DISTRIBUTOR_CONTRACT_ID,
          address,
          token.contractId,
          amountBase,
          priceStroops
        )
      );
      const { signedTxXdr } = await signTransaction(xdr, {
        networkPassphrase,
        address,
      });
      const { hash } = await submitPreparedTransaction(signedTxXdr);
      return { listTx: hash };
    },
  });
}
