import type { rpc, Transaction } from "@stellar/stellar-sdk";

/** A submitted mint may still settle, so its cooldown must remain reserved. */
export class FaucetMintPendingError extends Error {
  readonly hash: string;

  constructor(hash: string) {
    super(
      "Mint outcome is not yet confirmed; check the existing transaction before retrying"
    );
    this.name = "FaucetMintPendingError";
    this.hash = hash;
  }
}

const MINT_CONFIRMATION_TIMEOUT_MS = 30_000;

/** Bound each RPC by the same deadline; late settlement cannot resume polling. */
async function awaitMintRpc<T>(
  request: () => Promise<T>,
  deadline: number,
  hash: string
): Promise<T> {
  const remaining = deadline - performance.now();
  if (remaining <= 0) throw new FaucetMintPendingError(hash);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => {
        if (performance.now() >= deadline) throw new FaucetMintPendingError(hash);
        return request();
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new FaucetMintPendingError(hash)),
          remaining
        );
      }),
    ]);
    // A busy event loop may deliver an RPC result before its overdue timer.
    if (performance.now() >= deadline) throw new FaucetMintPendingError(hash);
    return result;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Submit once and distinguish a definitive failure from an unknown outcome. */
export async function submitFaucetMint(
  server: Pick<rpc.Server, "sendTransaction" | "getTransaction">,
  transaction: Transaction
): Promise<{ hash: string }> {
  // The local hash remains available even if the submission response is lost.
  const localHash = transaction.hash().toString("hex");
  const deadline = performance.now() + MINT_CONFIRMATION_TIMEOUT_MS;
  let response: Awaited<ReturnType<rpc.Server["sendTransaction"]>>;
  try {
    response = await awaitMintRpc(
      () => server.sendTransaction(transaction),
      deadline,
      localHash
    );
  } catch {
    throw new FaucetMintPendingError(localHash);
  }

  if (response.status === "ERROR" || response.status === "TRY_AGAIN_LATER") {
    throw new Error(`Transaction not accepted: ${response.status}`);
  }

  const hash = response.hash;
  // PENDING and DUPLICATE both require the final on-chain result. An
  // acknowledgement, a missed status read, or NOT_FOUND is not mint success.
  for (let retries = 0; retries <= 30; retries++) {
    let result: Awaited<ReturnType<rpc.Server["getTransaction"]>>;
    try {
      result = await awaitMintRpc(
        () => server.getTransaction(hash),
        deadline,
        hash
      );
    } catch {
      throw new FaucetMintPendingError(hash);
    }

    if (result.status === "SUCCESS") return { hash };
    if (result.status === "FAILED") {
      throw new Error("Transaction failed on-chain");
    }
    if (retries < 30) {
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new FaucetMintPendingError(hash);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000, remaining))
      );
    }
  }

  throw new FaucetMintPendingError(hash);
}
