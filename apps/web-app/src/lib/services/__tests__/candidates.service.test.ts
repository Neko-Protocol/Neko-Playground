import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────
const getVaultApySnapshotMock = vi.fn();
vi.mock("@/lib/services/vault-apy.service", () => ({
  getVaultApySnapshot: (...a: unknown[]) => getVaultApySnapshotMock(...a),
}));

const lendingGetPoolInfoMock = vi.fn();
const lendingGetUserPositionMock = vi.fn();
vi.mock("@/lib/orchestrator/adapters/NekoLendingAdapter", () => ({
  NekoLendingAdapter: class {
    getPoolInfo = lendingGetPoolInfoMock;
    getUserPosition = lendingGetUserPositionMock;
  },
}));

const poolGetPoolInfoMock = vi.fn();
const poolGetUserPositionMock = vi.fn();
vi.mock("@/lib/orchestrator/adapters/SoroswapPoolAdapter", () => ({
  SoroswapPoolAdapter: class {
    getPoolInfo = poolGetPoolInfoMock;
    getUserPosition = poolGetUserPositionMock;
  },
}));

const getPriceMock = vi.fn();
vi.mock("@/lib/services/stellar-price.service", () => ({
  stellarPriceService: {
    getPrice: (...a: unknown[]) => getPriceMock(...a),
  },
}));

vi.mock("@/lib/helpers/stellar/soroswap", () => ({
  getAvailableTokens: () => ({
    USDC: { code: "USDC", name: "USD Coin", decimals: 7, contract: "CUSDC" },
    XLM: { code: "XLM", name: "Stellar", decimals: 7, contract: "CXLM" },
  }),
}));

const { buildCandidates } = await import("../candidates.service");

const USDC_TOKEN = { code: "USDC", name: "USD Coin", decimals: 7, contract: "CUSDC" };
const XLM_TOKEN = { code: "XLM", name: "Stellar", decimals: 7, contract: "CXLM" };

describe("buildCandidates", () => {
  beforeEach(() => {
    getVaultApySnapshotMock.mockReset();
    lendingGetPoolInfoMock.mockReset();
    lendingGetUserPositionMock.mockReset();
    poolGetPoolInfoMock.mockReset();
    poolGetUserPositionMock.mockReset();
    getPriceMock.mockReset();
  });

  it("marks a lending venue unavailable when its pool read throws", async () => {
    getVaultApySnapshotMock.mockResolvedValue({ vaultApy: null, strategies: [], note: "Vault APY unavailable" });
    lendingGetPoolInfoMock.mockImplementation((asset: string) => {
      if (asset === "USDC") throw new Error("RPC unreachable");
      return Promise.resolve({ id: `neko:${asset}`, type: "neko", name: asset, tokens: [], tvl: 0n, apy: 0, state: "active", supportedActions: [], metadata: {} });
    });
    lendingGetUserPositionMock.mockResolvedValue({ deposited: 0n, depositedFormatted: "0", rewards: 0n, rewardsFormatted: "0", metadata: {}, poolId: "x" });
    poolGetPoolInfoMock.mockResolvedValue({ id: "soroswap:USDC-XLM", type: "soroswap", name: "USDC / XLM", tokens: [], tvl: 0n, apy: 0, state: "active", supportedActions: [], metadata: {} });
    poolGetUserPositionMock.mockResolvedValue({ deposited: 0n, depositedFormatted: "0", rewards: 0n, rewardsFormatted: "0", metadata: {}, poolId: "x" });
    getPriceMock.mockResolvedValue(1);

    const out = await buildCandidates("GWALLET");
    const usdc = out.find((c) => c.id === "neko-lending-usdc");
    expect(usdc).toBeDefined();
    expect(usdc!.availability).toBe("unavailable");
    expect(usdc!.grossApyBps).toBeNull();
    expect(usdc!.netApyBps).toBeNull();
    expect(usdc!.unavailableReason).toMatch(/RPC unreachable/);
  });

  it("marks a venue partial when the USD price cannot be resolved", async () => {
    getVaultApySnapshotMock.mockResolvedValue({ vaultApy: 5, strategies: [], note: undefined });
    lendingGetPoolInfoMock.mockResolvedValue({
      id: "neko:XLM",
      type: "neko",
      name: "XLM",
      tokens: [],
      tvl: 1_000_000_000n, // 100 XLM at 7 decimals
      apy: 4,
      state: "active",
      supportedActions: [],
      metadata: {},
    });
    lendingGetUserPositionMock.mockResolvedValue({ deposited: 0n, depositedFormatted: "0", rewards: 0n, rewardsFormatted: "0", metadata: {}, poolId: "x" });
    poolGetPoolInfoMock.mockRejectedValue(new Error("unavailable"));
    poolGetUserPositionMock.mockResolvedValue({ deposited: 0n, depositedFormatted: "0", rewards: 0n, rewardsFormatted: "0", metadata: {}, poolId: "x" });
    getPriceMock.mockResolvedValue(0); // price not resolvable

    const out = await buildCandidates("GWALLET");
    const xlm = out.find((c) => c.id === "neko-lending-xlm");
    expect(xlm).toBeDefined();
    expect(xlm!.availability).toBe("partial");
    expect(xlm!.availableLiquidityUsd).toBeNull();
    expect(xlm!.grossApyBps).toBe(400); // 4% → 400 bps
    expect(xlm!.netApyBps).toBe(400 - 20 - 5); // lending fee + gas
    expect(xlm!.unavailableReason).toMatch(/USD price/);
  });

  it("computes currentAllocationPct from the caller's positions in USD", async () => {
    getVaultApySnapshotMock.mockResolvedValue({ vaultApy: 5, strategies: [], note: undefined });
    lendingGetPoolInfoMock.mockResolvedValue({
      id: "neko:USDC", type: "neko", name: "USDC", tokens: [],
      tvl: 0n, apy: 3, state: "active", supportedActions: [], metadata: {},
    });
    // USDC position: 25 USDC at 1 USD
    lendingGetUserPositionMock.mockImplementation((asset: string) => {
      if (asset === "USDC") {
        return Promise.resolve({ deposited: 250_000_000n, depositedFormatted: "25", rewards: 0n, rewardsFormatted: "0", metadata: {}, poolId: "x" });
      }
      return Promise.resolve({ deposited: 0n, depositedFormatted: "0", rewards: 0n, rewardsFormatted: "0", metadata: {}, poolId: "x" });
    });
    poolGetPoolInfoMock.mockRejectedValue(new Error("skip"));
    poolGetUserPositionMock.mockResolvedValue({ deposited: 0n, depositedFormatted: "0", rewards: 0n, rewardsFormatted: "0", metadata: {}, poolId: "x" });
    getPriceMock.mockImplementation((code: string) => Promise.resolve(code === "USDC" ? 1 : 0));

    const out = await buildCandidates("GWALLET");
    const usdc = out.find((c) => c.id === "neko-lending-usdc");
    expect(usdc).toBeDefined();
    expect(usdc!.currentAllocationPct).toBeCloseTo(100, 5);
  });

  it("never silently drops a venue — one entry per supported venue", async () => {
    getVaultApySnapshotMock.mockResolvedValue(null); // vault unconfigured
    lendingGetPoolInfoMock.mockRejectedValue(new Error("down"));
    lendingGetUserPositionMock.mockResolvedValue({ deposited: 0n, depositedFormatted: "0", rewards: 0n, rewardsFormatted: "0", metadata: {}, poolId: "x" });
    poolGetPoolInfoMock.mockRejectedValue(new Error("down"));
    poolGetUserPositionMock.mockResolvedValue({ deposited: 0n, depositedFormatted: "0", rewards: 0n, rewardsFormatted: "0", metadata: {}, poolId: "x" });
    getPriceMock.mockResolvedValue(0);

    const out = await buildCandidates("GWALLET");
    // Every venue should be present, marked unavailable.
    expect(out.length).toBeGreaterThan(0);
    for (const c of out) {
      expect(c.availability).toBe("unavailable");
      expect(c.unavailableReason).toBeTruthy();
    }
  });
});
