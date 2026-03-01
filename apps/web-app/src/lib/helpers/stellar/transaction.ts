/**
 * Reusable sign → send pattern for Stellar/Soroban transactions
 */

import { TransactionBuilder, rpc } from "@stellar/stellar-sdk";
import { stellarNetwork } from "@/lib/constants/network";

const PENDING_WAIT_MS = 5000;

export type SignTransactionFn = (
  xdr: string,
  options?: { networkPassphrase?: string; address?: string }
) => Promise<{ signedTxXdr: string }>;

/**
 * Build XDR → sign with wallet → send to network.
 * Returns the send result; if status is PENDING, optionally waits before resolving.
 */
export async function signAndSendTransaction(
  xdr: string,
  signTransaction: SignTransactionFn,
  options: {
    networkPassphrase: string;
    rpcUrl: string;
    address?: string;
    waitForPending?: boolean;
  }
): Promise<{ hash: string; status: string }> {
  const signed = await signTransaction(xdr, {
    networkPassphrase: options.networkPassphrase,
    address: options.address,
  });
  const tx = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    options.networkPassphrase
  );
  const sorobanServer = new rpc.Server(options.rpcUrl, {
    allowHttp: stellarNetwork === "LOCAL",
  });
  const result = await sorobanServer.sendTransaction(tx);

  if (options.waitForPending !== false && result.status === "PENDING") {
    await new Promise((resolve) => setTimeout(resolve, PENDING_WAIT_MS));
  }

  return { hash: result.hash, status: result.status };
}
