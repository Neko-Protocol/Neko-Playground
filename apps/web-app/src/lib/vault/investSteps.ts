import {
  Keypair,
  TransactionBuilder,
  rpc,
  BASE_FEE,
  Operation,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { Client as DefindexVaultClient } from "@neko/defindex-vault";
import { clientEnv } from "@/lib/env.client";
import { requireServerEnv } from "@/lib/env.server";

/**
 * The vault auto-invest sequence (harvest → invest idle → collect fees),
 * extracted verbatim from `app/api/vault/invest/route.ts` so both the route
 * and the job-ledger runner (`lib/vault/investLedger.ts`) can drive the same
 * three operations as durable `JobStep`s instead of one inline sequence.
 */

export const VAULT_CONTRACT_ID =
  "CBHGX6TCHHVYJ7P3UZS7WI5TRAAA7GQA2L2Y7P2LCPIXWWD5FKDF2Z5S";

export const STRATEGIES = [
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

export const MIN_IDLE_THRESHOLD = 10_000_000n; // 1 CETES minimum
export const VAULT_INVEST_COOLDOWN_MS = 5 * 60 * 1000;

export function getVaultManagerEnv() {
  const { VAULT_MANAGER_SECRET_KEY: secretKey } = requireServerEnv([
    "VAULT_MANAGER_SECRET_KEY",
  ]);
  return {
    secretKey,
    rpcUrl: clientEnv.rpcUrl,
    networkPassphrase: clientEnv.networkPassphrase,
  };
}

export function buildVaultClient(
  secretKey: string,
  rpcUrl: string,
  networkPassphrase: string
) {
  const keypair = Keypair.fromSecret(secretKey);
  const server = new rpc.Server(rpcUrl);
  const client = new DefindexVaultClient({
    contractId: VAULT_CONTRACT_ID,
    rpcUrl,
    networkPassphrase,
    publicKey: keypair.publicKey(),
  });
  return { keypair, server, client };
}

export async function waitForTx(
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

export async function sendTx(
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

export async function harvestAquarius(
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
          args: [new Address(VAULT_CONTRACT_ID).toScVal(), xdr.ScVal.scvVoid()],
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

export async function investIdle(
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

export async function collectFees(
  client: DefindexVaultClient,
  keypair: Keypair,
  server: rpc.Server,
  networkPassphrase: string
) {
  const results: { step: string; hash: string; status: string }[] = [];

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
