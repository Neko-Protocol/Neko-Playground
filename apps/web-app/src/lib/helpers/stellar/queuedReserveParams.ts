import { Contract, scValToNative, xdr } from "@stellar/stellar-sdk";
import { rpcUrl } from "@/lib/constants/network";
import { getSorobanServer } from "./sorobanServer";

export interface QueuedReserveParamState {
  asset: string;
  unlockTime: number;
}

function queuedReserveConfigKey(asset: string): xdr.ScVal {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("QueuedReserveConfig"),
    xdr.ScVal.scvSymbol(asset),
  ]);
}

function getUnlockTime(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>).unlock_time;
  if (typeof candidate !== "number" && typeof candidate !== "bigint") {
    return null;
  }
  const unlockTime = Number(candidate);
  return Number.isSafeInteger(unlockTime) && unlockTime > 0 ? unlockTime : null;
}

export async function getQueuedReserveParams(
  contractId: string,
  assets: readonly string[]
): Promise<QueuedReserveParamState[]> {
  const uniqueAssets = Array.from(new Set(assets));
  if (uniqueAssets.length === 0) return [];

  const server = getSorobanServer(rpcUrl);
  const contract = new Contract(contractId).address().toScAddress();
  const requests = uniqueAssets.map((asset) => ({
    asset,
    key: xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract,
        key: queuedReserveConfigKey(asset),
        durability: xdr.ContractDataDurability.temporary(),
      })
    ),
  }));
  const results: QueuedReserveParamState[] = [];

  // Stellar RPC accepts at most 200 ledger keys per request. Keep larger pools
  // sequential rather than recreating the old per-asset request burst.
  for (let offset = 0; offset < requests.length; offset += 200) {
    const batch = requests.slice(offset, offset + 200);
    const pending = new Map(
      batch.map(({ asset, key }) => [key.toXDR("base64"), asset])
    );
    // SDK 14.4.3 getContractData turns every lookup failure into code 404.
    // Only keys absent from a successful ledger lookup mean no queue.
    const { entries } = await server.getLedgerEntries(
      ...batch.map(({ key }) => key)
    );
    if (!Array.isArray(entries)) {
      throw new Error("Queued reserve lookup did not return ledger entries");
    }
    for (const entry of entries) {
      const encodedKey = entry.key.toXDR("base64");
      const asset = pending.get(encodedKey);
      if (asset === undefined) {
        throw new Error(
          "Queued reserve lookup returned an unexpected or duplicate key"
        );
      }
      pending.delete(encodedKey);

      const config = scValToNative(entry.val.contractData().val());
      const unlockTime = getUnlockTime(config);
      if (unlockTime === null) {
        throw new Error(
          `Queued reserve config for ${asset} did not contain unlock_time`
        );
      }
      results.push({ asset, unlockTime });
    }
  }

  return results.sort((a, b) => a.asset.localeCompare(b.asset));
}
