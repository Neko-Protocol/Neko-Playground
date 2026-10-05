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
} from "@/lib/constants/faucet";
import { parseJsonBody } from "@/lib/validation/parse";
import { FaucetBodySchema } from "@/lib/validation/schemas";
import { clientEnv } from "@/lib/env.client";
import { serverEnv } from "@/lib/env.server";
import { getSorobanServer } from "@/lib/helpers/stellar/sorobanServer";
import {
  acquireFaucetRateLimit,
  releaseFaucetRateLimit,
} from "@/lib/faucetRateLimit";
import {
  FaucetMintPendingError,
  submitFaucetMint,
} from "@/lib/faucetSubmission";

export const dynamic = "force-dynamic";

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

  return submitFaucetMint(sorobanServer, prepared);
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

  return submitFaucetMint(sorobanServer, prepared);
}

export async function POST(request: NextRequest) {
  let rateLimitAcquired = false;
  let rateLimitAddress: string | undefined;
  let rateLimitReleaseToken: string | undefined;
  let mintMaySettle = false;

  try {
    const network = clientEnv.stellarNetwork;
    if (network === "PUBLIC") {
      return NextResponse.json(
        { error: "Faucet is not available on mainnet" },
        { status: 403 }
      );
    }

    const secretKey = serverEnv.FAUCET_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "Faucet is not configured" },
        { status: 503 }
      );
    }

    const parsed = await parseJsonBody(request, FaucetBodySchema);
    if ("error" in parsed) return parsed.error;
    const { address } = parsed.data;

    const limit = await acquireFaucetRateLimit(address);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit: please wait ${limit.retryAfterSeconds}s before requesting again`,
        },
        { status: 429 }
      );
    }
    rateLimitAcquired = true;
    rateLimitAddress = address;
    rateLimitReleaseToken = limit.releaseToken;

    const { rpcUrl, horizonUrl, networkPassphrase: passphrase } = clientEnv;

    const adminKeypair = Keypair.fromSecret(secretKey);
    const sorobanServer = getSorobanServer(rpcUrl);
    const horizonServer = new Horizon.Server(horizonUrl);

    const faucetContractId = serverEnv.FAUCET_CONTRACT_ID;

    if (faucetContractId) {
      const { hash } = await bulkMint(
        adminKeypair,
        sorobanServer,
        horizonServer,
        faucetContractId,
        address,
        passphrase
      );
      mintMaySettle = true;

      const tokens = getFaucetTokens();

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
      pending?: boolean;
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
        mintMaySettle = true;
        results.push({ token: token.symbol, success: true, hash });
      } catch (err) {
        if (err instanceof FaucetMintPendingError) mintMaySettle = true;
        results.push({
          token: token.symbol,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          ...(err instanceof FaucetMintPendingError
            ? { pending: true, hash: err.hash }
            : {}),
        });
      }
    }

    const allSucceeded = results.every((r) => r.success);
    const noneSucceeded = results.every((r) => !r.success);
    const anyPending = results.some((r) => r.pending);

    // Release only after every mint definitively failed. An unknown submitted
    // transaction can still settle and must not admit another faucet request.
    if (noneSucceeded && !anyPending) {
      await releaseFaucetRateLimit(address, rateLimitReleaseToken);
      rateLimitAcquired = false;
    }

    return NextResponse.json(
      {
        results,
        success: allSucceeded,
        ...(anyPending ? { pending: true } : {}),
      },
      { status: anyPending ? 202 : noneSucceeded ? 500 : 200 }
    );
  } catch (error) {
    if (error instanceof FaucetMintPendingError) {
      return NextResponse.json(
        {
          success: false,
          pending: true,
          hash: error.hash,
          error: error.message,
        },
        { status: 202 }
      );
    }
    if (rateLimitAcquired && rateLimitAddress && !mintMaySettle) {
      try {
        await releaseFaucetRateLimit(rateLimitAddress, rateLimitReleaseToken);
      } catch {
        // Best-effort release; surface the original mint error below.
      }
    }
    return NextResponse.json(
      {
        error: "Faucet request failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
