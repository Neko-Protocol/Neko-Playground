import { TransactionBuilder } from "@stellar/stellar-sdk";
import { getSorobanServer } from "./sorobanServer";

const PENDING_WAIT_MS = 5000;

export type SignTransactionFn = (
  xdr: string,
  options?: { networkPassphrase?: string; address?: string }
) => Promise<{ signedTxXdr: string }>;

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
  const sorobanServer = getSorobanServer(options.rpcUrl);
  const result = await sorobanServer.sendTransaction(tx);

  if (options.waitForPending !== false && result.status === "PENDING") {
    await new Promise((resolve) => setTimeout(resolve, PENDING_WAIT_MS));
  }

  return { hash: result.hash, status: result.status };
}
