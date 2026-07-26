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
import { clientEnv } from "@/lib/env.client";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

const rateLimitMap = new Map<string, number>();

function checkRateLimit(address: string): boolean {
  const lastMint = rateLimitMap.get(address);
  if (lastMint && Date.now() - lastMint < FAUCET_COOLDOWN_MS) {
    return false;
  }
  return true;
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

    if (!checkRateLimit(address)) {
      const remaining = Math.ceil(
        (FAUCET_COOLDOWN_MS - (Date.now() - (rateLimitMap.get(address) ?? 0))) /
          1000
      );
      return NextResponse.json(
        {
          error: `Rate limit: please wait ${remaining}s before requesting again`,
        },
        { status: 429 }
      );
    }

    const { rpcUrl, horizonUrl, networkPassphrase: passphrase } = clientEnv;

    const adminKeypair = Keypair.fromSecret(secretKey);
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: network === "LOCAL",
    });
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

      const tokens = getFaucetTokens();
      rateLimitMap.set(address, Date.now());

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

    rateLimitMap.set(address, Date.now());

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
