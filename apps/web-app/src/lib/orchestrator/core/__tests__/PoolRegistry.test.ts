import { describe, it, expect } from "vitest";
import { PoolRegistry } from "../PoolRegistry";
import type { BasePoolAdapter } from "../../types/adapter.types";
import type { PoolInfo, PoolType } from "../../types/pool.types";
import { PoolNotFoundError } from "../../types/errors";

function makeStub(type: PoolType, sentinelId: string): BasePoolAdapter {
  const sentinel: PoolInfo = {
    id: sentinelId,
    type,
    name: sentinelId,
    tokens: [],
    tvl: 0n,
    apy: 0,
    state: "active",
    supportedActions: [],
    metadata: {},
  };

  return {
    type,
    listPools: async () => [sentinel],
  } as unknown as BasePoolAdapter;
}

describe("PoolRegistry", () => {
  it("keeps every adapter when multiple of the same type are registered", () => {
    const registry = new PoolRegistry();
    const first = makeStub("blend", "blend-pool-a");
    const second = makeStub("blend", "blend-pool-b");

    registry.register(first);
    registry.register(second);

    const adapters = registry.getAdapters();
    expect(adapters).toHaveLength(2);
    expect(adapters).toContain(first);
    expect(adapters).toContain(second);
  });

  it("resolve() returns a working adapter of the correct type when multiples are registered", () => {
    const registry = new PoolRegistry();
    const first = makeStub("blend", "blend-pool-a");
    const second = makeStub("blend", "blend-pool-b");

    registry.register(first);
    registry.register(second);

    const resolved = registry.resolve("blend:SOME_CONTRACT_ID");
    expect(resolved.type).toBe("blend");
    expect(resolved).toBe(first);
  });

  it("resolve() throws PoolNotFoundError for an unknown type/poolId", () => {
    const registry = new PoolRegistry();
    registry.register(makeStub("blend", "blend-pool-a"));

    expect(() => registry.resolve("unknown:pool")).toThrow(PoolNotFoundError);
    expect(() => registry.resolve("no-prefix-at-all")).toThrow(
      PoolNotFoundError
    );
  });

  it("getAdapters() returns adapters across different types", () => {
    const registry = new PoolRegistry();
    const blend = makeStub("blend", "blend-pool");
    const neko = makeStub("neko", "neko-pool");
    const soroswap = makeStub("soroswap", "soroswap-pool");

    registry.register(blend);
    registry.register(neko);
    registry.register(soroswap);

    const adapters = registry.getAdapters();
    expect(adapters).toHaveLength(3);
    expect(adapters).toEqual(expect.arrayContaining([blend, neko, soroswap]));
  });

  it("resolve() routes to the adapter matching the poolId prefix across types", () => {
    const registry = new PoolRegistry();
    const blend = makeStub("blend", "blend-pool");
    const neko = makeStub("neko", "neko-pool");
    const soroswap = makeStub("soroswap", "soroswap-pool");

    registry.register(blend);
    registry.register(neko);
    registry.register(soroswap);

    expect(registry.resolve("blend:ABC")).toBe(blend);
    expect(registry.resolve("neko:XYZ")).toBe(neko);
    expect(registry.resolve("soroswap:XLM-USDC")).toBe(soroswap);
  });
});
