import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  TransactionBuilder,
  rpc,
  BASE_FEE,
  Operation,
  Address,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { Client as DefindexVaultClient } from "@neko/defindex-vault";
import { clientEnv } from "@/lib/env.client";
import { requireServerEnv, serverEnv } from "@/lib/env.server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import {
  acquireInvestLock,
  releaseInvestLock,
  getInvestLockTtl,
} from "@/lib/rateLimit/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VAULT_CONTRACT_ID =
  "CBHGX6TCHHVYJ7P3UZS7WI5TRAAA7GQA2L2Y7P2LCPIXWWD5FKDF2Z5S";
const STRATEGIES = [
  {
    name: "Neko",
    addr: "CCCEWBCYSIHTGBJ2TUOAFQY63UJ4SWDYTYNAEGXWPB7FP6PRHHGVZJIR",
  },
  {
    name: "Aquarius",
    addr: "CCGV5QSAFRT6OGBZNCE72I6BAODXLDMWEUYAOBI5ZBLHOURSEGVGFTTZ",
  },
  {
    name: "Soroswap",
    addr: "CCY5WW3VXVJDBBXNYXCCH33XTQICHPU6RPFWYJJCT4PTYPN3SXJN2XBJ",
  },
];
const MIN_IDLE_THRESHOLD = 10_000_000n; // 1 CETES minimum

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEnv() {
  const { VAULT_MANAGER_SECRET_KEY: secretKey } = requireServerEnv([
    "VAULT_MANAGER_SECRET_KEY",
  ]);
  return {
    secretKey,
    rpcUrl: clientEnv.rpcUrl,
    networkPassphrase: clientEnv.networkPassphrase,
  };
}

async function waitForTx(
  server: rpc.Server,
  hash: string
): Promise<"SUCCESS" | "FAILED" | "TIMEOUT"> {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const status = await server.getTransaction(hash);
    if (status.status === "SUCCESS") return "SUCCESS";
    if (status.status === "FAILED") return "FAILED";
  }
  return "TIMEOUT";
}

async function sendTx(
  assembledTx: Awaited<ReturnType<DefindexVaultClient["rebalance"]>>,
  keypair: Keypair,
  server: rpc.Server,
  networkPassphrase: string
): Promise<{ hash: string; status: string }> {
  if ((assembledTx.simulation as any)?.error) {
    console.error("[vault/invest] sim_error:", (assembledTx.simulation as any).error);
    return { hash: "", status: "sim_error" };
  }
  const builtTx = TransactionBuilder.fromXDR(
    assembledTx.toXDR(),
    networkPassphrase
  );
  const preparedTx = await server.prepareTransaction(builtTx);
  preparedTx.sign(keypair);
  const sendResult = await server.sendTransaction(preparedTx);
  if (sendResult.status !== "PENDING")
    return { hash: sendResult.hash ?? "", status: "submit_error" };
  const finalStatus = await waitForTx(server, sendResult.hash);
  return { hash: sendResult.hash, status: finalStatus };
}

// ─── Harvest Aquarius rewards ─────────────────────────────────────────────────

async function harvestAquarius(
  keypair: Keypair,
  server: rpc.Server,
  networkPassphrase: string
): Promise<{ hash: string; status: string }> {
  const AQUARIUS_STRATEGY =
    "CCGV5QSAFRT6OGBZNCE72I6BAODXLDMWEUYAOBI5ZBLHOURSEGVGFTTZ";

  try {
    const account = await server.getAccount(keypair.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: AQUARIUS_STRATEGY,
          function: "harvest",
          args: [
            new Address(VAULT_CONTRACT_ID).toScVal(), // from = vault address
            xdr.ScVal.scvVoid(), // data = None
          ],
        })
      )
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(keypair);
    const sendResult = await server.sendTransaction(prepared);
    if (sendResult.status !== "PENDING")
      return { hash: sendResult.hash ?? "", status: "submit_error" };
    const finalStatus = await waitForTx(server, sendResult.hash);
    return { hash: sendResult.hash, status: finalStatus };
  } catch (e) {
    console.error("[vault/invest] harvestAquarius error:", e);
    return { hash: "", status: "error" };
  }
}

// ─── Core operations ─────────────────────────────────────────────────────────

async function investIdle(
  client: DefindexVaultClient,
  keypair: Keypair,
  server: rpc.Server,
  networkPassphrase: string
) {
  const fundsTx = await client.fetch_total_managed_funds({ simulate: true });
  let funds = fundsTx.result as any;
  if (funds?.tag === "ok") funds = funds.value;
  else if (typeof funds?.unwrap === "function") funds = funds.unwrap();

  const idleAmount = BigInt(funds[0].idle_amount.toString());
  const idleHuman = Number(idleAmount) / 1e7;

  if (idleAmount < MIN_IDLE_THRESHOLD) {
    return { invested: false, results: [], idleAmount: idleHuman };
  }

  const perStrategy = idleAmount / BigInt(STRATEGIES.length);
  const remainder = idleAmount % BigInt(STRATEGIES.length);
  const results: { strategy: string; hash: string; status: string }[] = [];

  for (let i = 0; i < STRATEGIES.length; i++) {
    const { name, addr } = STRATEGIES[i];
    const amount = i === 0 ? perStrategy + remainder : perStrategy;
    if (amount === 0n) continue;

    const tx = await client.rebalance({
      caller: keypair.publicKey(),
      instructions: [{ tag: "Invest", values: [addr, amount] }],
    });
    const result = await sendTx(tx as any, keypair, server, networkPassphrase);
    results.push({ strategy: name, ...result });
  }

  return { invested: true, results, idleAmount: idleHuman };
}

async function collectFees(
  client: DefindexVaultClient,
  keypair: Keypair,
  server: rpc.Server,
  networkPassphrase: string
) {
  const results: { step: string; hash: string; status: string }[] = [];

  // 1. report() — track gains/losses per strategy since last call
  try {
    const reportTx = await client.report();
    const r = await sendTx(reportTx as any, keypair, server, networkPassphrase);
    results.push({ step: "report", ...r });
    if (r.status !== "SUCCESS") return { results, feesCollected: false };
  } catch (e) {
    console.error("[vault/invest] report error:", e);
    results.push({ step: "report", hash: "", status: "error" });
    return { results, feesCollected: false };
  }

  // 2. lock_fees() — separate accrued gains as manager fees
  try {
    const lockTx = await client.lock_fees({ new_fee_bps: undefined });
    const r = await sendTx(lockTx as any, keypair, server, networkPassphrase);
    results.push({ step: "lock_fees", ...r });
    if (r.status !== "SUCCESS") return { results, feesCollected: false };
  } catch (e) {
    console.error("[vault/invest] lock_fees error:", e);
    results.push({ step: "lock_fees", hash: "", status: "error" });
    return { results, feesCollected: false };
  }

  // 3. distribute_fees() — transfer locked fees to fee receivers
  try {
    const distTx = await client.distribute_fees({
      caller: keypair.publicKey(),
    });
    const r = await sendTx(distTx as any, keypair, server, networkPassphrase);
    results.push({ step: "distribute_fees", ...r });
    return { results, feesCollected: r.status === "SUCCESS" };
  } catch (e) {
    console.error("[vault/invest] distribute_fees error:", e);
    results.push({ step: "distribute_fees", hash: "", status: "error" });
    return { results, feesCollected: false };
  }
}

// ─── GET — current vault state ───────────────────────────────────────────────
// Uses VAULT_MANAGER_PUBLIC_KEY so the secret is never loaded on this public
// code path. Falls back to deriving the public key from the secret only when
// VAULT_MANAGER_PUBLIC_KEY is not configured (e.g. local dev without split keys).

function getPublicKey(): string {
  if (serverEnv.VAULT_MANAGER_PUBLIC_KEY) {
    return serverEnv.VAULT_MANAGER_PUBLIC_KEY;
  }
  // Fallback: derive from secret (requires VAULT_MANAGER_SECRET_KEY to be set)
  const { VAULT_MANAGER_SECRET_KEY } = requireServerEnv(["VAULT_MANAGER_SECRET_KEY"]);
  return Keypair.fromSecret(VAULT_MANAGER_SECRET_KEY).publicKey();
}

export async function GET() {
  try {
    const { rpcUrl, networkPassphrase } = {
      rpcUrl: clientEnv.rpcUrl,
      networkPassphrase: clientEnv.networkPassphrase,
    };
    const publicKey = getPublicKey();

    const client = new DefindexVaultClient({
      contractId: VAULT_CONTRACT_ID,
      rpcUrl,
      networkPassphrase,
      publicKey,
    });

    const fundsTx = await client.fetch_total_managed_funds({ simulate: true });
    let funds = fundsTx.result as any;
    if (funds?.tag === "ok") funds = funds.value;
    else if (typeof funds?.unwrap === "function") funds = funds.unwrap();

    const idleAmount = Number(BigInt(funds[0].idle_amount.toString())) / 1e7;
    const totalAmount = Number(BigInt(funds[0].total_amount.toString())) / 1e7;
    const allocations = funds[0].strategy_allocations.map((a: any) => ({
      strategy: a.strategy_address,
      amount: Number(BigInt(a.amount.toString())) / 1e7,
    }));

    const cooldownRemaining = await getInvestLockTtl();

    return NextResponse.json({
      idle: idleAmount,
      total: totalAmount,
      allocations,
      canInvest: BigInt(funds[0].idle_amount.toString()) >= MIN_IDLE_THRESHOLD,
      cooldownRemaining,
    });
  } catch (err) {
    console.error("[vault/invest GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST — invest idle + collect fees (cron only) ───────────────────────────

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locked = await acquireInvestLock();
  if (!locked) {
    return NextResponse.json(
      { error: "A vault invest job is already running" },
      { status: 409 }
    );
  }

  try {
    const { secretKey, rpcUrl, networkPassphrase } = getEnv();
    const keypair = Keypair.fromSecret(secretKey);
    const server = new rpc.Server(rpcUrl);
    const client = new DefindexVaultClient({
      contractId: VAULT_CONTRACT_ID,
      rpcUrl,
      networkPassphrase,
      publicKey: keypair.publicKey(),
    });

    // 1. Harvest Aquarius AQUA rewards → sends them to the vault
    const harvestResult = await harvestAquarius(
      keypair,
      server,
      networkPassphrase
    );

    // 2. Invest idle funds (includes any AQUA-converted idle if applicable)
    const investResult = await investIdle(
      client,
      keypair,
      server,
      networkPassphrase
    );

    // 3. Collect fees (report → lock → distribute)
    const feesResult = await collectFees(
      client,
      keypair,
      server,
      networkPassphrase
    );

    const allOk =
      (!investResult.invested ||
        investResult.results.every((r) => r.status === "SUCCESS")) &&
      (feesResult.feesCollected ||
        feesResult.results[0]?.status === "error");

    return NextResponse.json(
      {
        success: allOk,
        harvest: harvestResult,
        invest: investResult,
        fees: feesResult,
      },
      { status: allOk ? 200 : 207 }
    );
  } catch (err) {
    console.error("[vault/invest POST]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await releaseInvestLock();
  }
}
