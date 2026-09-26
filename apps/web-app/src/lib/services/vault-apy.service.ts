/**
 * Shared vault-strategy APY reads.
 *
 * Extracted from `app/api/vault/apy/route.ts` so both that route and the
 * candidates assembler can call the same contract/Aquarius logic without
 * an HTTP self-hop. Behaviour is intentionally identical to the route.
 */

import {
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  Operation,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import { Client as DefindexVaultClient } from "@neko/defindex-vault";
import { clientEnv } from "@/lib/env.client";
import { serverEnv } from "@/lib/env.server";
import { getSorobanServer } from "@/lib/helpers/stellar/sorobanServer";

export const VAULT_CONTRACT_ID =
  "CBHGX6TCHHVYJ7P3UZS7WI5TRAAA7GQA2L2Y7P2LCPIXWWD5FKDF2Z5S";
export const NEKO_POOL_CONTRACT =
  "CB4HAFD6ECCOQZXOD6FXUVDM3E773LKR5JHVGA3DBJXIWHZUWX2THEDJ";
export const AQUARIUS_POOL =
  "CBJPT2SCZSUJQGBZHHCHLZJX3GVYLOPVUKF53ESH4NFQZMC2UFPDWHRI";
export const AQUARIUS_STRATEGY =
  "CCGV5QSAFRT6OGBZNCE72I6BAODXLDMWEUYAOBI5ZBLHOURSEGVGFTTZ";
export const SOROSWAP_STRATEGY =
  "CCY5WW3VXVJDBBXNYXCCH33XTQICHPU6RPFWYJJCT4PTYPN3SXJN2XBJ";
export const NEKO_STRATEGY =
  "CCCEWBCYSIHTGBJ2TUOAFQY63UJ4SWDYTYNAEGXWPB7FP6PRHHGVZJIR";

const SCALAR_7 = 10_000_000;

function getRpcConfig() {
  return {
    rpcUrl: clientEnv.rpcUrl,
    networkPassphrase: clientEnv.networkPassphrase,
  };
}

/** Returns APY as a percentage (e.g. 8.5 for 8.5%), or null if unavailable. */
export async function getNekoApy(
  server: rpc.Server,
  networkPassphrase: string,
  managerPublicKey: string
): Promise<number | null> {
  try {
    const account = await server.getAccount(managerPublicKey);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: NEKO_POOL_CONTRACT,
          function: "get_interest_rate",
          args: [nativeToScVal("CETES", { type: "symbol" })],
        })
      )
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) return null;

    const raw = scValToNative(sim.result!.retval);
    const aprRaw: bigint =
      typeof raw === "object" && raw !== null && "ok" in raw
        ? BigInt(raw.ok)
        : typeof raw === "bigint"
          ? raw
          : BigInt(String(raw));

    const apr = Number(aprRaw) / SCALAR_7;
    const apy = Math.pow(1 + apr / 365, 365) - 1;
    return apy * 100;
  } catch {
    return null;
  }
}

/** Returns APY as a percentage, or null if the public API is unreachable. */
export async function getAquariusApy(): Promise<number | null> {
  try {
    const isTestnet = clientEnv.stellarNetwork !== "PUBLIC";
    const base = isTestnet
      ? "https://amm-api-testnet.aqua.network"
      : "https://amm-api.aqua.network";

    const res = await fetch(`${base}/pools/?address__in=${AQUARIUS_POOL}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const pool = data?.items?.[0];
    if (!pool) return null;

    return parseFloat(pool.total_apy) * 100;
  } catch {
    return null;
  }
}

/** Soroswap volume data is not exposed; documented as unavailable. */
export async function getSoroswapApy(): Promise<number | null> {
  return null;
}

export interface VaultApyStrategy {
  name: string;
  address: string;
  apy: number | null;
  weight: number; // 0-1
}

export interface VaultApyResult {
  vaultApy: number | null;
  strategies: VaultApyStrategy[];
  note?: string;
}

/**
 * Full vault APY snapshot — weighted across the strategies whose APY could
 * be read, with `note` set when a strategy is excluded.
 * Returns `null` vaultApy when the vault manager key is not configured.
 */
export async function getVaultApySnapshot(): Promise<VaultApyResult | null> {
  const secretKey = serverEnv.VAULT_MANAGER_SECRET_KEY;
  if (!secretKey) return null;

  const { rpcUrl, networkPassphrase } = getRpcConfig();
  const keypair = Keypair.fromSecret(secretKey);
  const server = getSorobanServer(rpcUrl);

  const client = new DefindexVaultClient({
    contractId: VAULT_CONTRACT_ID,
    rpcUrl,
    networkPassphrase,
    publicKey: keypair.publicKey(),
  });

  const [nekoApy, aquariusApy, soroswapApy, allocations] = await Promise.all([
    getNekoApy(server, networkPassphrase, keypair.publicKey()),
    getAquariusApy(),
    getSoroswapApy(),
    getAllocations(client),
  ]);

  const strategies: VaultApyStrategy[] = [
    {
      name: "Neko",
      address: NEKO_STRATEGY,
      apy: nekoApy,
      weight: allocations[NEKO_STRATEGY] ?? 0,
    },
    {
      name: "Aquarius",
      address: AQUARIUS_STRATEGY,
      apy: aquariusApy,
      weight: allocations[AQUARIUS_STRATEGY] ?? 0,
    },
    {
      name: "Soroswap",
      address: SOROSWAP_STRATEGY,
      apy: soroswapApy,
      weight: allocations[SOROSWAP_STRATEGY] ?? 0,
    },
  ];

  const known = strategies.filter((s) => s.apy !== null);
  const totalKnownWeight = known.reduce((sum, s) => sum + s.weight, 0);

  let vaultApy: number | null = null;
  if (known.length > 0 && totalKnownWeight > 0) {
    vaultApy = known.reduce((sum, s) => {
      const normalizedWeight = s.weight / totalKnownWeight;
      return sum + s.apy! * normalizedWeight;
    }, 0);
  }

  return {
    vaultApy,
    strategies,
    note:
      soroswapApy === null
        ? "Soroswap APY not available — trading fee yield requires volume data"
        : undefined,
  };
}

async function getAllocations(
  client: DefindexVaultClient
): Promise<Record<string, number>> {
  const fundsTx = await client.fetch_total_managed_funds({ simulate: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve
  let funds = fundsTx.result as any;
  if (funds?.tag === "ok") funds = funds.value;
  else if (typeof funds?.unwrap === "function") funds = funds.unwrap();

  const total = Number(BigInt(funds[0].total_amount.toString()));
  if (total === 0) return {};

  const result: Record<string, number> = {};
  for (const alloc of funds[0].strategy_allocations) {
    const addr: string = alloc.strategy_address;
    const amount = Number(BigInt(alloc.amount.toString()));
    result[addr] = amount / total;
  }
  return result;
}
