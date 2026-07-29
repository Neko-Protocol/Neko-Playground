// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterSnapshotsByWindow,
  loadPortfolioHistory,
  recordPortfolioSnapshot,
  type PortfolioSnapshot,
} from "../portfolioHistory";

const ADDRESS = "GTEST_ADDRESS";

describe("portfolioHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns no history for a wallet that has never been recorded", () => {
    expect(loadPortfolioHistory(ADDRESS)).toEqual([]);
  });

  it("records and reloads a snapshot", () => {
    recordPortfolioSnapshot(ADDRESS, 1234);
    expect(loadPortfolioHistory(ADDRESS)).toEqual([
      { date: expect.any(String), totalValueUsd: 1234 },
    ]);
  });

  it("overwrites today's snapshot instead of appending a duplicate", () => {
    recordPortfolioSnapshot(ADDRESS, 100);
    recordPortfolioSnapshot(ADDRESS, 150);
    const history = loadPortfolioHistory(ADDRESS);
    expect(history).toHaveLength(1);
    expect(history[0].totalValueUsd).toBe(150);
  });

  it("keeps snapshots isolated per wallet address", () => {
    recordPortfolioSnapshot("WALLET_A", 100);
    recordPortfolioSnapshot("WALLET_B", 200);
    expect(loadPortfolioHistory("WALLET_A")).toEqual([
      { date: expect.any(String), totalValueUsd: 100 },
    ]);
    expect(loadPortfolioHistory("WALLET_B")).toEqual([
      { date: expect.any(String), totalValueUsd: 200 },
    ]);
  });

  it("ignores a stored schema from a different version", () => {
    localStorage.setItem(
      "neko_portfolio_history_v1_GTEST_ADDRESS",
      JSON.stringify({
        version: 999,
        snapshots: [{ date: "2020-01-01", totalValueUsd: 5 }],
      })
    );
    expect(loadPortfolioHistory(ADDRESS)).toEqual([]);
  });
});

describe("filterSnapshotsByWindow", () => {
  const snapshots: PortfolioSnapshot[] = [
    { date: "2020-01-01", totalValueUsd: 10 },
    { date: "2020-01-05", totalValueUsd: 20 },
    { date: "2020-01-10", totalValueUsd: 30 },
  ];

  it("returns everything for a window at or beyond the retention cap", () => {
    expect(filterSnapshotsByWindow(snapshots, 400)).toEqual(snapshots);
  });

  it("filters out snapshots older than the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-10T00:00:00Z"));
    const result = filterSnapshotsByWindow(snapshots, 6);
    expect(result).toEqual([
      { date: "2020-01-05", totalValueUsd: 20 },
      { date: "2020-01-10", totalValueUsd: 30 },
    ]);
    vi.useRealTimers();
  });
});
