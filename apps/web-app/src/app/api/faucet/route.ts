import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  Contract,
  TransactionBuilder,
  Address,
  nativeToScVal,
  rpc,
  Horizon,
} from "@stellar/stellar-sdk";
import {
  getFaucetTokens,
  buildMintRequestsScVal,
  FAUCET_COOLDOWN_MS,
} from "@/lib/constants/faucet";
import { parseJsonBody } from "@/lib/validation/parse";
import { FaucetBodySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

interface RateLimitEntry {
  lastMint: number;
  txHash: string;
}

// Module-level cache — works for single-instance deployments.
// For serverless/multi-instance, the on-chain check below provides the real guard.
const rateLimitCache = new Map<string, RateLimitEntry>();

/**
 * Check rate limit using both in-memory cache and on-chain transaction history.
 * The on-chain check is the authoritative source for serverless deployments
 * where in-memory state is unreliable across instances.
 */
async function checkRateLimit(
  address: string,
  sorobanServer: rpc.Server,
  faucetContractId: string | undefined,
  cooldownMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();

  // Fast path: in-memory check
  const cached = rateLimitCache.get(address);
  if (cached && now - cached.lastMint < cooldownMs) {
    return {
      allowed: false,
      remaining: Math.ceil((cooldownMs - (now - cached.lastMint)) / 1000),
    };
  }

  // Slow path: check on-chain transaction history for this address
  // This prevents bypass via serverless cold starts or multi-instance deployments
  if (faucetContractId) {
    try {
      // Look for recent transactions involving this address
      const account = await sorobanServer.getAccount(address).catch(() => null);
      if (account) {
        // Check operations involving the faucet contract
        const operations = await sorobanServer
          .forAccount(address)
          .limit(20)
          .order("desc")
          .call()
          .catch(() => null);

        if (operations && "records" in operations) {
          for (const record of (operations as { records: Array<{ created_at: string; transaction_hash: string }> }).records) {
            const txTime = new Date(record.created_at).getTime();
            if (now - txTime < cooldownMs) {
              // Found a recent transaction — update cache and reject
              rateLimitCache.set(address, { lastMint: txTime, txHash: record.transaction_hash });
              return {
                allowed: false,
                remaining: Math.ceil((cooldownMs - (now - txTime)) / 1000),
              };
            }
          }
        }
      }
    } catch {
      // If on-chain check fails, fall through to allow (fail-open for faucet availability)
    }
  }

  return { allowed: true, remaining: 0 };
}

async function bulkMint(
  adminKeypair: Keypair,
  sorobanServer: rpc.Server,
  horizonServer: Horizon.Server,
  faucetContractId: string,
  toAddress: string,
  passphrase: string
): Promise<{ hash: string }> {
  const faucetContract = new Contract(faucetContractId);
  const requestsScVal = buildMintRequestsScVal(toAddress);

  const operation = faucetContract.call("bulk_mint", requestsScVal);

  const adminAccount = await horizonServer.loadAccount(
    adminKeypair.publicKey()
  );

  const transaction = new TransactionBuilder(adminAccount, {
    fee: "10000000",
    networkPassphrase: passphrase,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  const prepared = await sorobanServer.prepareTransaction(transaction);
  prepared.sign(adminKeypair);

  const response = await sorobanServer.sendTransaction(prepared);

  if (response.status === "ERROR") {
    throw new Error(`Transaction failed: ${response.status}`);
  }

  if (response.status === "PENDING") {
    let result = await sorobanServer.getTransaction(response.hash);
    const maxRetries = 30;
    let retries = 0;
    while (result.status === "NOT_FOUND" && retries < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await sorobanServer.getTransaction(response.hash);
      retries++;
    }

    if (result.status === "FAILED") {
      throw new Error("Transaction failed on-chain");
    }
  }

  return { hash: response.hash };
}

async function mintTokenLegacy(
  adminKeypair: Keypair,
  sorobanServer: rpc.Server,
  horizonServer: Horizon.Server,
  contractId: string,
  toAddress: string,
  amount: bigint,
  passphrase: string
): Promise<{ hash: string }> {
  const contract = new Contract(contractId);

  const operation = contract.call(
    "mint",
    new Address(toAddress).toScVal(),
    nativeToScVal(amount, { type: "i128" })
  );

  const adminAccount = await horizonServer.loadAccount(
    adminKeypair.publicKey()
  );

  const transaction = new TransactionBuilder(adminAccount, {
    fee: "10000000",
    networkPassphrase: passphrase,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  const prepared = await sorobanServer.prepareTransaction(transaction);
  prepared.sign(adminKeypair);

  const response = await sorobanServer.sendTransaction(prepared);

  if (response.status === "ERROR") {
    throw new Error(`Transaction failed: ${response.status}`);
  }

  if (response.status === "PENDING") {
    let result = await sorobanServer.getTransaction(response.hash);
    const maxRetries = 30;
    let retries = 0;
    while (result.status === "NOT_FOUND" && retries < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await sorobanServer.getTransaction(response.hash);
      retries++;
    }

    if (result.status === "FAILED") {
      throw new Error("Transaction failed on-chain");
    }
  }

  return { hash: response.hash };
}

export async function POST(request: NextRequest) {
  try {
    const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET";
    if (network === "PUBLIC") {
      return NextResponse.json(
        { error: "Faucet is not available on mainnet" },
        { status: 403 }
      );
    }

    const secretKey = process.env.FAUCET_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "Faucet is not configured" },
        { status: 503 }
      );
    }

    const parsed = await parseJsonBody(request, FaucetBodySchema);
    if ("error" in parsed) return parsed.error;
    const { address } = parsed.data;

    const rpcUrl =
      process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
      "https://soroban-testnet.stellar.org";
    const horizonUrl =
      process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??
      "https://horizon-testnet.stellar.org";
    const passphrase =
      process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
      "Test SDF Network ; September 2015";

    const adminKeypair = Keypair.fromSecret(secretKey);
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: network === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);

    const faucetContractId = process.env.FAUCET_CONTRACT_ID;

    // Rate limit check — uses both in-memory cache and on-chain history
    const rateLimit = await checkRateLimit(
      address,
      sorobanServer,
      faucetContractId,
      FAUCET_COOLDOWN_MS
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit: please wait " + rateLimit.remaining + "s before requesting again",
        },
        { status: 429 }
      );
    }

    if (faucetContractId) {
      const { hash } = await bulkMint(
        adminKeypair,
        sorobanServer,
        horizonServer,
        faucetContractId,
        address,
        passphrase
      );

      const tokens = getFaucetTokens();
      rateLimitCache.set(address, { lastMint: Date.now(), txHash: hash });

      return NextResponse.json({
        success: true,
        hash,
        results: tokens.map((t) => ({
          token: t.symbol,
          success: true,
          hash,
        })),
      });
    }

    const allFaucetTokens = getFaucetTokens();
    const results: {
      token: string;
      success: boolean;
      hash?: string;
      error?: string;
    }[] = [];

    for (const token of allFaucetTokens) {
      try {
        const { hash } = await mintTokenLegacy(
          adminKeypair,
          sorobanServer,
          horizonServer,
          token.contractId,
          address,
          token.mintAmount,
          passphrase
        );
        results.push({ token: token.symbol, success: true, hash });
      } catch (err) {
        results.push({
          token: token.symbol,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    rateLimitCache.set(address, {
      lastMint: Date.now(),
      txHash: results.find((r) => r.success)?.hash ?? "",
    });

    const allSucceeded = results.every((r) => r.success);
    const noneSucceeded = results.every((r) => !r.success);

    return NextResponse.json(
      { results, success: allSucceeded },
      { status: noneSucceeded ? 500 : 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Faucet request failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
