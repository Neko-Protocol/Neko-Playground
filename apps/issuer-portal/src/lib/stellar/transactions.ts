import { TransactionBuilder } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "@/lib/constants";
import { sorobanServer } from "./rpc";

export async function submitPreparedTransaction(signedXdr: string): Promise<{
  hash: string;
}> {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const send = await sorobanServer.sendTransaction(tx);
  if (send.status !== "PENDING" && send.status !== "DUPLICATE") {
    throw new Error(`sendTransaction failed: ${send.status}`);
  }
  const hash = send.hash;
  for (let i = 0; i < 45; i++) {
    const st = await sorobanServer.getTransaction(hash);
    if (st.status === "SUCCESS") {
      return { hash };
    }
    if (st.status === "FAILED") {
      throw new Error("Transaction failed on-chain");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timeout waiting for transaction");
}
