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
import { requireServerEnv } from "@/lib/env.server";
import { reportStageOutcome } from "@/lib/event-platform/vaultStageOutcome";

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

let lastInvest = 0;
const COOLDOWN_MS = 5 * 60 * 1000;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve (separate pre-existing workspace package-naming issue), so the real SDK types can't be verified here
  if ((assembledTx.simulation as any)?.error) {
    return {
      hash: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve (separate pre-existing workspace package-naming issue), so the real SDK types can't be verified here
      status: `sim_error: ${(assembledTx.simulation as any).error}`,
    };
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
    return { hash: "", status: `error: ${e}` };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve (separate pre-existing workspace package-naming issue), so the real SDK types can't be verified here
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve (separate pre-existing workspace package-naming issue), so the real SDK types can't be verified here
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve (separate pre-existing workspace package-naming issue), so the real SDK types can't be verified here
    const r = await sendTx(reportTx as any, keypair, server, networkPassphrase);
    results.push({ step: "report", ...r });
    if (r.status !== "SUCCESS") return { results, feesCollected: false };
  } catch (e) {
    results.push({ step: "report", hash: "", status: `error: ${e}` });
    return { results, feesCollected: false };
  }

  // 2. lock_fees() — separate accrued gains as manager fees
  try {
    const lockTx = await client.lock_fees({ new_fee_bps: undefined });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve (separate pre-existing workspace package-naming issue), so the real SDK types can't be verified here
    const r = await sendTx(lockTx as any, keypair, server, networkPassphrase);
    results.push({ step: "lock_fees", ...r });
    if (r.status !== "SUCCESS") return { results, feesCollected: false };
  } catch (e) {
    results.push({ step: "lock_fees", hash: "", status: `error: ${e}` });
    return { results, feesCollected: false };
  }

  // 3. distribute_fees() — transfer locked fees to fee receivers
  try {
    const distTx = await client.distribute_fees({
      caller: keypair.publicKey(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve (separate pre-existing workspace package-naming issue), so the real SDK types can't be verified here
    const r = await sendTx(distTx as any, keypair, server, networkPassphrase);
    results.push({ step: "distribute_fees", ...r });
    return { results, feesCollected: r.status === "SUCCESS" };
  } catch (e) {
    results.push({ step: "distribute_fees", hash: "", status: `error: ${e}` });
    return { results, feesCollected: false };
  }
}

// ─── GET — current vault state ───────────────────────────────────────────────

export async function GET() {
  try {
    const { secretKey, rpcUrl, networkPassphrase } = getEnv();
    const keypair = Keypair.fromSecret(secretKey);

    const client = new DefindexVaultClient({
      contractId: VAULT_CONTRACT_ID,
      rpcUrl,
      networkPassphrase,
      publicKey: keypair.publicKey(),
    });

    const fundsTx = await client.fetch_total_managed_funds({ simulate: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve (separate pre-existing workspace package-naming issue), so the real SDK types can't be verified here
    let funds = fundsTx.result as any;
    if (funds?.tag === "ok") funds = funds.value;
    else if (typeof funds?.unwrap === "function") funds = funds.unwrap();

    const idleAmount = Number(BigInt(funds[0].idle_amount.toString())) / 1e7;
    const totalAmount = Number(BigInt(funds[0].total_amount.toString())) / 1e7;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve (separate pre-existing workspace package-naming issue), so the real SDK types can't be verified here
    const allocations = funds[0].strategy_allocations.map((a: any) => ({
      strategy: a.strategy_address,
      amount: Number(BigInt(a.amount.toString())) / 1e7,
    }));

    return NextResponse.json({
      idle: idleAmount,
      total: totalAmount,
      allocations,
      canInvest: BigInt(funds[0].idle_amount.toString()) >= MIN_IDLE_THRESHOLD,
      cooldownRemaining: Math.max(
        0,
        Math.ceil((lastInvest + COOLDOWN_MS - Date.now()) / 1000)
      ),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ─── POST — invest idle + collect fees (cron or manual) ──────────────────────

export async function POST(request: NextRequest) {
  try {
    const isCron = request.headers.get("x-vercel-cron") === "1";

    if (!isCron) {
      const remaining = lastInvest + COOLDOWN_MS - Date.now();
      if (remaining > 0) {
        return NextResponse.json(
          { error: `Please wait ${Math.ceil(remaining / 1000)}s` },
          { status: 429 }
        );
      }
    }

    lastInvest = Date.now();

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
    await reportStageOutcome(
      "harvestAquarius",
      harvestResult.status !== "SUCCESS",
      harvestResult
    );

    // 2. Invest idle funds (includes any AQUA-converted idle if applicable)
    const investResult = await investIdle(
      client,
      keypair,
      server,
      networkPassphrase
    );
    await reportStageOutcome(
      "investIdle",
      investResult.invested &&
        investResult.results.some((r) => r.status !== "SUCCESS"),
      investResult
    );

    // 3. Collect fees (report → lock → distribute)
    const feesResult = await collectFees(
      client,
      keypair,
      server,
      networkPassphrase
    );
    await reportStageOutcome(
      "collectFees",
      !feesResult.feesCollected,
      feesResult
    );

    const allOk =
      (!investResult.invested ||
        investResult.results.every((r) => r.status === "SUCCESS")) &&
      (feesResult.feesCollected ||
        feesResult.results[0]?.status.startsWith("error"));

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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
