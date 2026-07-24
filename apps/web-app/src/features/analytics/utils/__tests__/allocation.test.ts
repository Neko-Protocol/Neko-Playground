import { describe, expect, it } from "vitest";
import type { UnifiedPosition } from "@/features/dashboard/positions/types";
import { buildAllocationBySource } from "../allocation";

function makePosition(overrides: Partial<UnifiedPosition>): UnifiedPosition {
  return {
    id: "p1",
    protocol: "wallet",
    label: "USDC",
    assetCode: "USDC",
    quantity: 100,
    valueUsd: 100,
    direction: "asset",
    href: "/",
    ...overrides,
  };
}

describe("buildAllocationBySource", () => {
  it("returns an empty breakdown when there is no priced asset value", () => {
    expect(buildAllocationBySource([])).toEqual([]);
  });

  it("groups priced asset positions by protocol and computes percentages", () => {
    const positions: UnifiedPosition[] = [
      makePosition({ id: "1", protocol: "wallet", valueUsd: 100 }),
      makePosition({ id: "2", protocol: "lending", valueUsd: 300 }),
    ];

    const result = buildAllocationBySource(positions);

    expect(result).toEqual([
      { label: "Lending", value: 300, pct: 75 },
      { label: "Wallet", value: 100, pct: 25 },
    ]);
  });

  it("excludes debt (liability) and unpriced positions from the breakdown", () => {
    const positions: UnifiedPosition[] = [
      makePosition({ id: "1", protocol: "wallet", valueUsd: 100 }),
      makePosition({
        id: "2",
        protocol: "borrowing",
        direction: "liability",
        valueUsd: 9999,
      }),
      makePosition({ id: "3", protocol: "pools", valueUsd: null }),
    ];

    const result = buildAllocationBySource(positions);

    expect(result).toEqual([{ label: "Wallet", value: 100, pct: 100 }]);
  });

  it("labels borrowing-protocol asset positions as collateral, not debt", () => {
    const positions: UnifiedPosition[] = [
      makePosition({
        id: "1",
        protocol: "borrowing",
        direction: "asset",
        valueUsd: 200,
      }),
    ];

    expect(buildAllocationBySource(positions)).toEqual([
      { label: "Collateral", value: 200, pct: 100 },
    ]);
  });

  it("sorts slices largest first", () => {
    const positions: UnifiedPosition[] = [
      makePosition({ id: "1", protocol: "vault", valueUsd: 50 }),
      makePosition({ id: "2", protocol: "backstop", valueUsd: 500 }),
      makePosition({ id: "3", protocol: "wallet", valueUsd: 150 }),
    ];

    const result = buildAllocationBySource(positions);
    expect(result.map((r) => r.label)).toEqual(["Backstop", "Wallet", "Vault"]);
  });
});
