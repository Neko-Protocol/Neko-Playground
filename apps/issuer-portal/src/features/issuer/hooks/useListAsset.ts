"use client";

import { useMutation } from "@tanstack/react-query";
import { StrKey, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  NEKO_LISTING_REGISTRY_CONTRACT_ID,
  NETWORK_PASSPHRASE,
} from "@/lib/constants";
import {
  buildListOp,
  buildTokenTransferOp,
  prepareOperationXdr,
} from "@/lib/stellar/contract";
import { describeTransactionOperations } from "@/lib/stellar/operationSummary";
import { submitPreparedTransaction } from "@/lib/stellar/transactions";
import { useWallet } from "@/hooks/useWallet";
import type { LinkTokenValues } from "@/features/issuer/components/LinkTokenStep";
import type { PricingMode } from "@/types";

function scaledAmount(human: string, decimals: number): bigint {
  const [whole, fraction = ""] = human.split(".");
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt((whole || "0") + padded);
}

const LIST_LOG = "[issuer-portal][list-asset]";

function logList(phase: string, data: Record<string, unknown>): void {
  console.log(LIST_LOG, phase, data);
}

function logXdrSummary(label: string, xdr: string): Record<string, unknown> {
  try {
    const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
    return {
      label,
      operationCount: tx.operations.length,
      operations: describeTransactionOperations(tx),
      xdrLength: xdr.length,
      xdrPrefix: xdr.slice(0, 120),
    };
  } catch (parseErr) {
    return {
      label,
      parseError:
        parseErr instanceof Error ? parseErr.message : String(parseErr),
      xdrLength: xdr.length,
    };
  }
}

function logXdrOperationContext(label: string, xdr: string): void {
  console.error(`${LIST_LOG} ${label}`, logXdrSummary(label, xdr));
}

export interface ListAssetInput {
  token: LinkTokenValues;
  /** Stellar G-address sent to Trustless Work as issuer / trustline (must match connected wallet). */
  issuerAddress: string;
  /** Asset code for TW `trustline.symbol` (e.g. NKB); may differ from on-chain token symbol. */
  escrowAssetSymbol: string;
  listedAmount: string;
  pricing: PricingMode;
}

export interface ListAssetResult {
  listTx: string;
  escrowId: string;
  escrowIdHex: string;
  escrowAddress: string;
  mockEscrow: boolean;
}

export function useListAsset() {
  const { address, networkPassphrase, signTransaction } = useWallet();

  return useMutation({
    mutationFn: async ({
      token,
      issuerAddress,
      escrowAssetSymbol,
      listedAmount,
      pricing,
    }: ListAssetInput): Promise<ListAssetResult> => {
      if (!address) throw new Error("Connect your wallet first");
      if (!NEKO_LISTING_REGISTRY_CONTRACT_ID) {
        throw new Error(
          "NEXT_PUBLIC_NEKO_LISTING_REGISTRY_CONTRACT_ID not configured"
        );
      }

      const issuer = issuerAddress.trim();
      if (!StrKey.isValidEd25519PublicKey(issuer)) {
        throw new Error("Issuer must be a valid Stellar G-address");
      }
      if (issuer !== address) {
        throw new Error(
          "Issuer address must match your connected wallet — it signs the Trustless Work deploy."
        );
      }
      const symbol = escrowAssetSymbol.trim().toUpperCase();
      if (!symbol || symbol.length > 12) {
        throw new Error("Asset code must be 1–12 characters");
      }
      if (!/^[A-Z0-9]+$/.test(symbol)) {
        throw new Error("Asset code may only contain letters and digits");
      }

      const amountBase = scaledAmount(listedAmount, token.decimals);
      if (amountBase <= 0n) throw new Error("Amount must be > 0");

      logList("start", {
        wallet: address,
        issuer,
        tokenContract: token.contractId,
        tokenSymbol: token.symbol,
        tokenDecimals: token.decimals,
        classicIssuer: token.classicIssuer ?? null,
        escrowAssetSymbol: symbol,
        listedAmount,
        amountBase: amountBase.toString(),
        pricingType: pricing.type,
      });

      // 1) Ask the server to provision a Trustless Work escrow for this listing.
      const classic = token.classicIssuer?.trim();
      const createBody = {
        issuerAddress: issuer,
        tokenContract: token.contractId,
        tokenDecimals: token.decimals,
        totalAmount: listedAmount,
        symbol,
        ...(classic
          ? { trustlineClassicIssuer: classic }
          : { trustlineAddress: issuer }),
      };
      logList(
        "POST /api/escrow/create body",
        createBody as unknown as Record<string, unknown>
      );

      const escrowRes = await fetch("/api/escrow/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createBody),
      });
      logList("POST /api/escrow/create status", {
        httpStatus: escrowRes.status,
        ok: escrowRes.ok,
      });
      if (!escrowRes.ok) {
        const txt = await escrowRes.text();
        logList("POST /api/escrow/create error body", {
          text: txt.slice(0, 4000),
        });
        throw new Error(`Escrow creation failed: ${txt}`);
      }
      const escrow = (await escrowRes.json()) as {
        escrowId: string;
        escrowIdHex: string;
        escrowAddress: string;
        mock: boolean;
        deployUnsignedXdr?: string;
      };

      let escrowAddress = (escrow.escrowAddress ?? "").trim();

      logList("create response summary", {
        mock: escrow.mock,
        escrowId: escrow.escrowId,
        escrowIdHex: escrow.escrowIdHex,
        escrowAddressFromApi: escrowAddress || null,
        deployUnsignedXdrLen: escrow.deployUnsignedXdr?.length ?? 0,
        deployXdr: escrow.deployUnsignedXdr
          ? logXdrSummary("deploy unsigned", escrow.deployUnsignedXdr)
          : null,
      });

      if (!escrow.mock && escrow.deployUnsignedXdr) {
        logList("wallet.sign TW deploy", {
          ...logXdrSummary("deploy unsigned", escrow.deployUnsignedXdr),
        });
        let signedDeployXdr: string;
        try {
          const out = await signTransaction(escrow.deployUnsignedXdr, {
            networkPassphrase,
            address,
          });
          signedDeployXdr = out.signedTxXdr;
          logList("wallet.sign TW deploy ok", {
            ...logXdrSummary("deploy signed", signedDeployXdr),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            "[issuer-portal] Trustless Work deploy signTransaction failed",
            {
              message,
              stack: err instanceof Error ? err.stack : undefined,
            }
          );
          logXdrOperationContext(
            "TW deploy unsigned XDR (wallet rejected or parse error)",
            escrow.deployUnsignedXdr
          );
          throw err;
        }
        logList("POST /api/escrow/submit-deploy", {
          signedXdrLen: signedDeployXdr.length,
          ...logXdrSummary("deploy signed", signedDeployXdr),
        });
        const submitRes = await fetch("/api/escrow/submit-deploy", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ signedXdr: signedDeployXdr }),
        });
        logList("POST /api/escrow/submit-deploy status", {
          httpStatus: submitRes.status,
          ok: submitRes.ok,
        });
        if (!submitRes.ok) {
          const txt = await submitRes.text();
          console.error(
            "[issuer-portal] Trustless Work deploy submit-deploy HTTP error",
            {
              status: submitRes.status,
              body: txt,
            }
          );
          logXdrOperationContext(
            "TW deploy signed XDR (submit failed)",
            signedDeployXdr
          );
          throw new Error(`Trustless Work deploy submit failed: ${txt}`);
        }
        const deployed = (await submitRes.json()) as {
          hash: string;
          contractAddress: string | null;
        };
        logList("submit-deploy response", deployed);
        escrowAddress = (deployed.contractAddress ?? "").trim();
        if (!escrowAddress) {
          throw new Error(
            `Deploy transaction submitted (${deployed.hash}) but no escrow contract id was returned. Check the explorer or TW dashboard.`
          );
        }
      } else if (!escrowAddress) {
        throw new Error(
          "Escrow address not available from server response (missing deploy XDR and contract id)."
        );
      }

      logList("resolved escrow Soroban address", {
        escrowAddress,
        mock: escrow.mock,
      });

      // 2) Transfer to escrow, then `registry.list` — **one Soroban op per tx**.
      // Freighter rejects multi-op Soroban envelopes ("Transaction contains more than
      // one operation") even though Stellar allows them on-chain.
      logList("prepare token→escrow transfer", {
        tokenContract: token.contractId,
        from: address,
        toEscrow: escrowAddress,
        amountBase: amountBase.toString(),
      });
      const transferXdr = await prepareOperationXdr(
        address,
        buildTokenTransferOp(
          token.contractId,
          address,
          escrowAddress,
          amountBase
        )
      );
      logList("transfer prepared XDR", logXdrSummary("transfer", transferXdr));
      let signedTransferXdr: string;
      try {
        logList("wallet.sign transfer", {});
        signedTransferXdr = (
          await signTransaction(transferXdr, {
            networkPassphrase,
            address,
          })
        ).signedTxXdr;
        logList(
          "wallet.sign transfer ok",
          logXdrSummary("transfer signed", signedTransferXdr)
        );
      } catch (err) {
        console.error("[issuer-portal] token→escrow transfer sign failed", {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        logXdrOperationContext("transfer to escrow (unsigned)", transferXdr);
        throw err;
      }
      const transferSubmit = await submitPreparedTransaction(signedTransferXdr);
      logList("transfer on-chain hash", { hash: transferSubmit.hash });

      logList("prepare registry.list", {
        registry: NEKO_LISTING_REGISTRY_CONTRACT_ID,
        escrowIdHex: escrow.escrowIdHex,
        escrowAddress,
        amountBase: amountBase.toString(),
      });
      const listXdr = await prepareOperationXdr(
        address,
        buildListOp(
          NEKO_LISTING_REGISTRY_CONTRACT_ID,
          address,
          token.contractId,
          escrow.escrowIdHex,
          escrowAddress,
          amountBase,
          pricing
        )
      );
      logList("list prepared XDR", logXdrSummary("list", listXdr));
      let signedListXdr: string;
      try {
        logList("wallet.sign registry.list", {});
        signedListXdr = (
          await signTransaction(listXdr, {
            networkPassphrase,
            address,
          })
        ).signedTxXdr;
        logList(
          "wallet.sign registry.list ok",
          logXdrSummary("list signed", signedListXdr)
        );
      } catch (err) {
        console.error("[issuer-portal] registry.list sign failed", {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        logXdrOperationContext("registry.list (unsigned)", listXdr);
        throw err;
      }
      const { hash } = await submitPreparedTransaction(signedListXdr);
      logList("done", {
        listTx: hash,
        escrowId: escrow.escrowId,
        escrowAddress,
        mock: escrow.mock,
      });
      return {
        listTx: hash,
        escrowId: escrow.escrowId,
        escrowIdHex: escrow.escrowIdHex,
        escrowAddress,
        mockEscrow: escrow.mock,
      };
    },
  });
}
