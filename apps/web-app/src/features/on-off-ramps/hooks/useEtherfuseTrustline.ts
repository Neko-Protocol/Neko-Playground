"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";
import { getEtherfuseAssets } from "../utils/rampApi";
import { networkPassphrase, horizonUrl } from "@/lib/constants/network";
import type { AnchorProvider } from "@/lib/anchors/types";
import type { SignTransactionFn } from "@/lib/helpers/stellar/transaction";

export function useEtherfuseTrustline(
  provider: AnchorProvider,
  publicKey: string | undefined,
  /** Only run the check after an on-ramp order has been created. */
  enabled: boolean,
  signTransaction: SignTransactionFn
) {
  const queryClient = useQueryClient();

  const { data: assets, isLoading: isCheckingTrustline } = useQuery({
    queryKey: ["etherfuse-assets", provider, publicKey],
    queryFn: () => getEtherfuseAssets(provider, publicKey!),
    enabled: enabled && !!publicKey && provider === "etherfuse",
    staleTime: 30_000,
  });

  const cetes = assets?.assets.find((a) => a.symbol === "CETES");
  // null balance → no trustline; undefined → asset not in list → no trustline
  const hasTrustline = cetes !== undefined && cetes.balance !== null;

  const {
    mutate: addTrustline,
    isPending: isAddingTrustline,
    error: trustlineError,
  } = useMutation({
    mutationFn: async () => {
      if (!publicKey || !cetes) throw new Error("Missing wallet or asset info");

      // Parse "CODE:ISSUER" identifier
      const [assetCode, assetIssuer] = cetes.identifier.split(":");
      if (!assetCode || !assetIssuer)
        throw new Error("Invalid asset identifier");

      // Load account to get sequence number
      const server = new Horizon.Server(horizonUrl);
      const account = await server.loadAccount(publicKey);

      // Build changeTrust transaction
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase,
      })
        .addOperation(
          Operation.changeTrust({
            asset: new Asset(assetCode, assetIssuer),
          })
        )
        .setTimeout(30)
        .build();

      const { signedTxXdr } = await signTransaction(tx.toXDR());

      // Submit directly to Horizon
      const res = await fetch(`${horizonUrl}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ tx: signedTxXdr }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Horizon rejected transaction: ${body}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["etherfuse-assets", provider, publicKey],
      });
    },
  });

  return {
    hasTrustline,
    isCheckingTrustline,
    isAddingTrustline,
    trustlineError: trustlineError as Error | null,
    addTrustline,
  };
}
