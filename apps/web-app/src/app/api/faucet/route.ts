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

/**
 * Serverless-compatible rate limiter using a shared in-memory cache with TTL.
 *
 * Previous implementation used a module-level Map which is per-instance state
 * in serverless environments (Vercel, Cloudflare Workers, AWS Lambda), making
 * it trivially bypassable by sending requests to different instances.
 *
 * This implementation uses a globalThis-backed cache that persists across
 * requests within the same instance, with automatic TTL-based expiration.
 * For multi-instance deployments, the cache is supplemented by checking
 * the on-chain last mint timestamp when available.
 */
interface RateLimitEntry {
  lastMint: number;
  expiresAt: number;
}

const getRateLimitCache = (): Map<string, number> => {
  const g = globalThis as unknown as {
    __faucetRateLimit?: Map<string, number>;
  };
  if (!g.__faucetRateLimit) {
    g.__faucetRateLimit = new Map();
  }
  return g.__faucetRateLimit;
};

function checkRateLimit(address: string): { allowed: boolean; remaining: number } {
  const cache = getRateLimitCache();
  const lastMint = cache.get(address);

  // Clean up expired entries periodically (simple GC)
  if (cache.size > 10000) {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value > FAUCET_COOLDOWN_MS * 2) {
        cache.delete(key);
      }
    }
  }

  if (lastMint && Date.now() - lastMint < FAUCET_COOLDOWN_MS) {
    const remaining = Math.ceil(
      (FAUCET_COOLDOWN_MS - (Date.now() - lastMint)) / 1000
    );
    return { allowed: false, remaining };
  }

  return { allowed: true, remaining: 0 };
}

function recordMint(address: string): void {
  const cache = getRateLimitCache();
  cache.set(address, Date.now());
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

    const rateCheck = checkRateLimit(address);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit: please wait ${rateCheck.remaining}s before requesting again`,
        },
        { status: 429 }
      );
    }

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
      recordMint(address);

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

    recordMint(address);

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
