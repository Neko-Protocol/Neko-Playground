import { TransactionBuilder } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "@/lib/constants";
import { describeTransactionOperations } from "./operationSummary";
import { sorobanServer } from "./rpc";

const SOROBAN_LOG = "[issuer-portal][soroban]";

function xdrPreview(signedXdr: string): { length: number; prefix: string } {
  return { length: signedXdr.length, prefix: signedXdr.slice(0, 120) };
}

export async function submitPreparedTransaction(signedXdr: string): Promise<{
  hash: string;
}> {
  let tx: ReturnType<typeof TransactionBuilder.fromXDR>;
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  } catch (e) {
    console.error(`${SOROBAN_LOG} parse XDR before send`, {
      ...xdrPreview(signedXdr),
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }

  const operations = describeTransactionOperations(tx);
  console.log(`${SOROBAN_LOG} sendTransaction`, {
    ...xdrPreview(signedXdr),
    operationCount: tx.operations.length,
    operations,
  });

  const send = await sorobanServer.sendTransaction(tx);
  console.log(`${SOROBAN_LOG} sendTransaction RPC response`, {
    status: send.status,
    hash: send.hash,
    errorResult: send.errorResult ? String(send.errorResult) : undefined,
    latestLedger: "latestLedger" in send ? send.latestLedger : undefined,
  });

  if (send.status !== "PENDING" && send.status !== "DUPLICATE") {
    console.error(`${SOROBAN_LOG} sendTransaction rejected`, {
      status: send.status,
      hash: send.hash,
      errorResult: send.errorResult,
    });
    throw new Error(`sendTransaction failed: ${send.status}`);
  }
  const hash = send.hash;
  for (let i = 0; i < 45; i++) {
    const st = await sorobanServer.getTransaction(hash);
    if (st.status === "SUCCESS") {
      console.log(`${SOROBAN_LOG} getTransaction SUCCESS`, {
        hash,
        attempts: i + 1,
        ledger: "ledger" in st ? st.ledger : undefined,
      });
      return { hash };
    }
    if (st.status === "FAILED") {
      console.error(`${SOROBAN_LOG} getTransaction FAILED`, {
        hash,
        attempts: i + 1,
        ledger: "ledger" in st ? st.ledger : undefined,
        applicationOrder:
          "applicationOrder" in st ? st.applicationOrder : undefined,
      });
      throw new Error("Transaction failed on-chain");
    }
    if (i === 0 || i % 5 === 4) {
      console.log(`${SOROBAN_LOG} getTransaction pending`, {
        hash,
        attempt: i + 1,
        status: st.status,
      });
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`${SOROBAN_LOG} getTransaction timeout`, {
    hash,
    attempts: 45,
  });
  throw new Error("Timeout waiting for transaction");
}
