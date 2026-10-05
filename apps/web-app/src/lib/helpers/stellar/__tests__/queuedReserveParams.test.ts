import { beforeEach, describe, expect, it, vi } from "vitest";
import { nativeToScVal, StrKey, xdr } from "@stellar/stellar-sdk";
import { getQueuedReserveParams } from "../queuedReserveParams";

const { getLedgerEntries } = vi.hoisted(() => ({ getLedgerEntries: vi.fn() }));
vi.mock("../sorobanServer", () => ({
  getSorobanServer: () => ({ getLedgerEntries }),
}));

const contractId = StrKey.encodeContract(Buffer.alloc(32));
const unlockTime = 1_800_000_000;
function entry(
  key: xdr.LedgerKey,
  time: bigint | string = BigInt(unlockTime)
) {
  return {
    key,
    val: {
      contractData: () => ({ val: () => nativeToScVal({ unlock_time: time }) }),
    },
  };
}

beforeEach(() => {
  getLedgerEntries.mockReset();
});

describe("getQueuedReserveParams", () => {
  it("batches unique assets and distinguishes absent keys from unordered replies", async () => {
    getLedgerEntries.mockImplementation(async (...keys: xdr.LedgerKey[]) => ({
      entries: keys.slice(1).reverse().map((key) => entry(key)),
    }));
    const result = await getQueuedReserveParams(contractId, [
      "USDC", "XLM", "USDC", "BTC",
    ]);
    expect(getLedgerEntries).toHaveBeenCalledTimes(1);
    expect(getLedgerEntries.mock.calls[0]).toHaveLength(3);
    expect(result).toEqual([
      { asset: "BTC", unlockTime },
      { asset: "XLM", unlockTime },
    ]);
  });

  it("makes no request for an empty pool and respects the 200-key RPC limit", async () => {
    expect(await getQueuedReserveParams(contractId, [])).toEqual([]);
    expect(getLedgerEntries).not.toHaveBeenCalled();
    getLedgerEntries.mockResolvedValue({ entries: [] });
    const assets = Array.from({ length: 201 }, (_, index) => `A${index}`);
    expect(await getQueuedReserveParams(contractId, assets)).toEqual([]);
    expect(getLedgerEntries.mock.calls.map((keys) => keys.length)).toEqual([
      200, 1,
    ]);
  });

  it("rejects failed, malformed, duplicate and foreign replies without an all-clear", async () => {
    getLedgerEntries.mockRejectedValueOnce(new Error("RPC unavailable"));
    await expect(getQueuedReserveParams(contractId, ["USDC"]))
      .rejects.toThrow("RPC unavailable");
    getLedgerEntries.mockResolvedValueOnce({});
    await expect(getQueuedReserveParams(contractId, ["USDC"]))
      .rejects.toThrow("ledger entries");
    getLedgerEntries.mockImplementationOnce(async (key: xdr.LedgerKey) => ({
      entries: [entry(key), entry(key)],
    }));
    await expect(getQueuedReserveParams(contractId, ["USDC"]))
      .rejects.toThrow("duplicate key");
    getLedgerEntries.mockImplementationOnce(async (key: xdr.LedgerKey) => ({
      entries: [{ ...entry(key), key: { toXDR: () => "unrequested-key" } }],
    }));
    await expect(getQueuedReserveParams(contractId, ["USDC"]))
      .rejects.toThrow("unexpected");
    getLedgerEntries.mockImplementationOnce(async (key: xdr.LedgerKey) => ({
      entries: [entry(key, "invalid")],
    }));
    await expect(getQueuedReserveParams(contractId, ["USDC"]))
      .rejects.toThrow("unlock_time");
  });
});
