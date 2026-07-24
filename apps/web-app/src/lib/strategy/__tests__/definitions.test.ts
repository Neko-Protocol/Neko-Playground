import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  nekoAdapterMethods,
  NekoLendingAdapterMock,
  blendAdapterMethods,
  BlendPoolAdapterMock,
  soroswapAdapterMethods,
  SoroswapPoolAdapterMock,
  defindexMethods,
  DefindexClientMock,
  getQuote,
  buildTransaction,
  getAvailableTokens,
} = vi.hoisted(() => {
  const nekoAdapterMethods = {
    deposit: vi.fn(),
    withdraw: vi.fn(),
    borrow: vi.fn(),
    repay: vi.fn(),
    supplyCollateral: vi.fn(),
    withdrawCollateral: vi.fn(),
  };
  class NekoLendingAdapterMock {
    constructor() {
      Object.assign(this, nekoAdapterMethods);
    }
  }
  const blendAdapterMethods = {
    deposit: vi.fn(),
    withdraw: vi.fn(),
    borrow: vi.fn(),
    repay: vi.fn(),
    supplyCollateral: vi.fn(),
    withdrawCollateral: vi.fn(),
  };
  class BlendPoolAdapterMock {
    constructor() {
      Object.assign(this, blendAdapterMethods);
    }
  }
  const soroswapAdapterMethods = { deposit: vi.fn() };
  class SoroswapPoolAdapterMock {
    constructor() {
      Object.assign(this, soroswapAdapterMethods);
    }
  }
  const defindexMethods = { deposit: vi.fn(), withdraw: vi.fn() };
  class DefindexClientMock {
    constructor(public options: unknown) {
      Object.assign(this, defindexMethods);
    }
  }
  return {
    nekoAdapterMethods,
    NekoLendingAdapterMock,
    blendAdapterMethods,
    BlendPoolAdapterMock,
    soroswapAdapterMethods,
    SoroswapPoolAdapterMock,
    defindexMethods,
    DefindexClientMock,
    getQuote: vi.fn(),
    buildTransaction: vi.fn(),
    getAvailableTokens: vi.fn(),
  };
});

vi.mock("@/lib/orchestrator/adapters/NekoLendingAdapter", () => ({
  NekoLendingAdapter: NekoLendingAdapterMock,
}));
vi.mock("@/lib/orchestrator/adapters/BlendPoolAdapter", () => ({
  BlendPoolAdapter: BlendPoolAdapterMock,
}));
vi.mock("@/lib/orchestrator/adapters/SoroswapPoolAdapter", () => ({
  SoroswapPoolAdapter: SoroswapPoolAdapterMock,
}));
vi.mock("@neko/defindex-vault", () => ({ Client: DefindexClientMock }));
vi.mock("@/lib/helpers/stellar/soroswap", () => ({
  getQuote,
  buildTransaction,
  getAvailableTokens,
}));

import {
  swapSoroswapDefinition,
  supplyNekoDefinition,
  supplyBlendDefinition,
  borrowNekoDefinition,
  borrowBlendDefinition,
  repayNekoDefinition,
  repayBlendDefinition,
  vaultDepositDefindexDefinition,
  vaultWithdrawDefindexDefinition,
  lpAddSoroswapDefinition,
  lpRemoveSoroswapDefinition,
  registerBuiltInStepDefinitions,
} from "../definitions";
import { strategyStepRegistry } from "../registry";
import type { StepExecutionContext } from "../types";

const USDC = {
  contract: "C_USDC",
  code: "USDC",
  name: "USD Coin",
  decimals: 7,
};
const XLM = {
  contract: "C_XLM",
  code: "XLM",
  name: "Stellar Lumens",
  decimals: 7,
};

function ctx(resolvedParams: Record<string, unknown>): StepExecutionContext {
  return {
    userAddress: "GUSER",
    networkPassphrase: "p",
    resolvedParams,
    upstreamOutputs: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAvailableTokens.mockReturnValue({ USDC, XLM });
  nekoAdapterMethods.deposit.mockResolvedValue({
    xdr: "N_DEPOSIT_XDR",
    networkPassphrase: "p",
  });
  nekoAdapterMethods.withdraw.mockResolvedValue({
    xdr: "N_WITHDRAW_XDR",
    networkPassphrase: "p",
  });
  nekoAdapterMethods.borrow.mockResolvedValue({
    xdr: "N_BORROW_XDR",
    networkPassphrase: "p",
  });
  nekoAdapterMethods.repay.mockResolvedValue({
    xdr: "N_REPAY_XDR",
    networkPassphrase: "p",
  });
  nekoAdapterMethods.supplyCollateral.mockResolvedValue({
    xdr: "N_SUPPLY_COLL_XDR",
    networkPassphrase: "p",
  });
  nekoAdapterMethods.withdrawCollateral.mockResolvedValue({
    xdr: "N_WITHDRAW_COLL_XDR",
    networkPassphrase: "p",
  });
  blendAdapterMethods.deposit.mockResolvedValue({
    xdr: "B_DEPOSIT_XDR",
    networkPassphrase: "p",
  });
  blendAdapterMethods.withdraw.mockResolvedValue({
    xdr: "B_WITHDRAW_XDR",
    networkPassphrase: "p",
  });
  blendAdapterMethods.borrow.mockResolvedValue({
    xdr: "B_BORROW_XDR",
    networkPassphrase: "p",
  });
  blendAdapterMethods.repay.mockResolvedValue({
    xdr: "B_REPAY_XDR",
    networkPassphrase: "p",
  });
  blendAdapterMethods.supplyCollateral.mockResolvedValue({
    xdr: "B_SUPPLY_COLL_XDR",
    networkPassphrase: "p",
  });
  blendAdapterMethods.withdrawCollateral.mockResolvedValue({
    xdr: "B_WITHDRAW_COLL_XDR",
    networkPassphrase: "p",
  });
  soroswapAdapterMethods.deposit.mockResolvedValue({
    xdr: "LP_ADD_XDR",
    networkPassphrase: "p",
  });
  defindexMethods.deposit.mockResolvedValue({
    toXDR: () => "VAULT_DEPOSIT_XDR",
  });
  defindexMethods.withdraw.mockResolvedValue({
    toXDR: () => "VAULT_WITHDRAW_XDR",
  });
});

describe("swapSoroswapDefinition", () => {
  const params = { tokenIn: "XLM", tokenOut: "USDC", amountIn: "10" };

  it("validate flags identical tokens and unknown asset codes", () => {
    expect(
      swapSoroswapDefinition.validate(
        ctx({ tokenIn: "XLM", tokenOut: "XLM", amountIn: "1" })
      )
    ).toContainEqual(expect.objectContaining({ code: "INCOMPATIBLE_ASSET" }));
    expect(
      swapSoroswapDefinition.validate(
        ctx({ tokenIn: "NOPE", tokenOut: "USDC", amountIn: "1" })
      )
    ).toContainEqual(expect.objectContaining({ code: "UNKNOWN_ASSET" }));
    expect(swapSoroswapDefinition.validate(ctx(params))).toEqual([]);
  });

  it("simulate projects the quote's amountOut on the tokenOut port", async () => {
    getQuote.mockResolvedValue({
      amountOut: "95000000",
      amountIn: "100000000",
      priceImpact: "0.5",
      protocol: "soroswap",
    });
    const projection = await swapSoroswapDefinition.simulate(ctx(params));
    expect(getQuote).toHaveBeenCalledWith({
      assetIn: "XLM",
      assetOut: "USDC",
      amount: "10",
      tradeType: "EXACT_IN",
    });
    expect(projection.outputs["out.receivedAsset"]).toBe("95000000");
    expect(projection.slippageBps).toBe(50);
  });

  it("simulate throws when no liquidity is found", async () => {
    getQuote.mockResolvedValue(undefined);
    await expect(swapSoroswapDefinition.simulate(ctx(params))).rejects.toThrow(
      /No liquidity/
    );
  });

  it("prepare quotes then builds the swap transaction", async () => {
    const quote = { amountOut: "1", amountIn: "1", protocol: "soroswap" };
    getQuote.mockResolvedValue(quote);
    buildTransaction.mockResolvedValue({ xdr: "SWAP_XDR" });
    const result = await swapSoroswapDefinition.prepare(ctx(params));
    expect(buildTransaction).toHaveBeenCalledWith({
      quote,
      from: "GUSER",
      to: "GUSER",
    });
    expect(result).toEqual({ xdr: "SWAP_XDR", networkPassphrase: "p" });
  });

  it("describeOutputs declares a single asset output port for tokenOut", () => {
    expect(swapSoroswapDefinition.describeOutputs(params)).toEqual([
      { id: "out.receivedAsset", assetCode: "USDC", kind: "asset" },
    ]);
  });
});

describe("supplyNekoDefinition", () => {
  it("mode=supply calls deposit/withdraw by direction", async () => {
    await supplyNekoDefinition.prepare(
      ctx({
        mode: "supply",
        direction: "deposit",
        assetCode: "USDC",
        amount: "1",
      })
    );
    expect(nekoAdapterMethods.deposit).toHaveBeenCalledWith(
      "USDC",
      "GUSER",
      10_000_000n
    );
    await supplyNekoDefinition.prepare(
      ctx({
        mode: "supply",
        direction: "withdraw",
        assetCode: "USDC",
        amount: "1",
      })
    );
    expect(nekoAdapterMethods.withdraw).toHaveBeenCalledWith(
      "USDC",
      "GUSER",
      10_000_000n
    );
  });

  it("mode=collateral calls supplyCollateral/withdrawCollateral with the compound raw id", async () => {
    await supplyNekoDefinition.prepare(
      ctx({
        mode: "collateral",
        direction: "deposit",
        poolContractId: "CPOOL1",
        collateralTokenAddress: "C_RWA",
        amount: "1",
      })
    );
    expect(nekoAdapterMethods.supplyCollateral).toHaveBeenCalledWith(
      "CPOOL1:C_RWA",
      "GUSER",
      10_000_000n
    );
  });

  it("validate flags unknown asset / missing collateral params without throwing", () => {
    expect(
      supplyNekoDefinition.validate(
        ctx({
          mode: "supply",
          direction: "deposit",
          assetCode: "NOPE",
          amount: "1",
        })
      )
    ).toContainEqual(expect.objectContaining({ code: "UNKNOWN_ASSET" }));
    expect(
      supplyNekoDefinition.validate(
        ctx({ mode: "collateral", direction: "deposit", amount: "1" })
      )
    ).toContainEqual(expect.objectContaining({ code: "MISSING_PARAM" }));
  });

  it("simulate reports a signed collateralDelta matching direction", async () => {
    const deposit = await supplyNekoDefinition.simulate(
      ctx({
        mode: "collateral",
        direction: "deposit",
        poolContractId: "CPOOL1",
        collateralTokenAddress: "C_RWA",
        amount: "5",
      })
    );
    expect(deposit.resultingPosition?.collateralDelta).toBe(5);
    const withdraw = await supplyNekoDefinition.simulate(
      ctx({
        mode: "collateral",
        direction: "withdraw",
        poolContractId: "CPOOL1",
        collateralTokenAddress: "C_RWA",
        amount: "5",
      })
    );
    expect(withdraw.resultingPosition?.collateralDelta).toBe(-5);
  });
});

describe("supplyBlendDefinition", () => {
  const base = {
    mode: "supply",
    direction: "deposit",
    poolContractId: "CPOOL",
    assetAddress: "C_ASSET",
    amount: "1",
  };

  it("builds the compound raw id and calls the right adapter method per mode/direction", async () => {
    await supplyBlendDefinition.prepare(ctx(base));
    expect(blendAdapterMethods.deposit).toHaveBeenCalledWith(
      "CPOOL:C_ASSET",
      "GUSER",
      10_000_000n
    );
    await supplyBlendDefinition.prepare(ctx({ ...base, mode: "collateral" }));
    expect(blendAdapterMethods.supplyCollateral).toHaveBeenCalledWith(
      "CPOOL:C_ASSET",
      "GUSER",
      10_000_000n
    );
    await supplyBlendDefinition.prepare(
      ctx({ ...base, mode: "collateral", direction: "withdraw" })
    );
    expect(blendAdapterMethods.withdrawCollateral).toHaveBeenCalledWith(
      "CPOOL:C_ASSET",
      "GUSER",
      10_000_000n
    );
  });

  it("validate flags missing pool/asset params without throwing", () => {
    const issues = supplyBlendDefinition.validate(
      ctx({
        mode: "supply",
        direction: "deposit",
        amount: "1",
        poolContractId: "",
        assetAddress: "",
      })
    );
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("borrowNekoDefinition / borrowBlendDefinition", () => {
  it("Neko: converts amount and calls adapter.borrow with the asset code", async () => {
    const result = await borrowNekoDefinition.prepare(
      ctx({ assetCode: "USDC", amount: "1" })
    );
    expect(nekoAdapterMethods.borrow).toHaveBeenCalledWith(
      "USDC",
      "GUSER",
      10_000_000n
    );
    expect(result.xdr).toBe("N_BORROW_XDR");
  });

  it("Neko: validate flags an unknown asset / malformed params without throwing", () => {
    expect(
      borrowNekoDefinition.validate(ctx({ assetCode: "NOPE", amount: "1" }))
    ).toContainEqual(expect.objectContaining({ code: "UNKNOWN_ASSET" }));
    expect(borrowNekoDefinition.validate(ctx({})).length).toBeGreaterThan(0);
  });

  it("Neko: simulate reports a positive debtDelta", async () => {
    const projection = await borrowNekoDefinition.simulate(
      ctx({ assetCode: "USDC", amount: "50" })
    );
    expect(projection.resultingPosition).toMatchObject({
      protocol: "neko",
      debtAssetCode: "USDC",
      debtDelta: 50,
    });
  });

  it("Blend: builds the compound raw id and calls adapter.borrow", async () => {
    await borrowBlendDefinition.prepare(
      ctx({ poolContractId: "CPOOL", assetAddress: "C_ASSET", amount: "1" })
    );
    expect(blendAdapterMethods.borrow).toHaveBeenCalledWith(
      "CPOOL:C_ASSET",
      "GUSER",
      10_000_000n
    );
  });

  it("Blend: validate flags missing params without throwing", () => {
    expect(borrowBlendDefinition.validate(ctx({})).length).toBeGreaterThan(0);
  });
});

describe("repayNekoDefinition / repayBlendDefinition", () => {
  it("Neko: delegates to adapter.repay with underlying-asset units (dToken conversion is the adapter's job)", async () => {
    const result = await repayNekoDefinition.prepare(
      ctx({ assetCode: "USDC", amount: "1" })
    );
    expect(nekoAdapterMethods.repay).toHaveBeenCalledWith(
      "USDC",
      "GUSER",
      10_000_000n
    );
    expect(result.xdr).toBe("N_REPAY_XDR");
  });

  it("Neko: simulate reports a negative debtDelta", async () => {
    const projection = await repayNekoDefinition.simulate(
      ctx({ assetCode: "USDC", amount: "20" })
    );
    expect(projection.resultingPosition?.debtDelta).toBe(-20);
  });

  it("Blend: builds the compound raw id and calls adapter.repay", async () => {
    await repayBlendDefinition.prepare(
      ctx({ poolContractId: "CPOOL", assetAddress: "C_ASSET", amount: "3" })
    );
    expect(blendAdapterMethods.repay).toHaveBeenCalledWith(
      "CPOOL:C_ASSET",
      "GUSER",
      30_000_000n
    );
  });
});

describe("vaultDepositDefindexDefinition / vaultWithdrawDefindexDefinition", () => {
  it("deposit applies the 1% slippage floor to amounts_min", async () => {
    const result = await vaultDepositDefindexDefinition.prepare(
      ctx({ amount: "100" })
    );
    expect(defindexMethods.deposit).toHaveBeenCalledWith({
      amounts_desired: [1_000_000_000n],
      amounts_min: [990_000_000n],
      from: "GUSER",
      invest: false,
    });
    expect(result.xdr).toBe("VAULT_DEPOSIT_XDR");
  });

  it("deposit validate rejects a zero/negative amount and accepts a positive one", () => {
    expect(
      vaultDepositDefindexDefinition.validate(ctx({ amount: "0" }))
    ).toContainEqual(expect.objectContaining({ code: "INVALID_AMOUNT" }));
    expect(
      vaultDepositDefindexDefinition.validate(ctx({ amount: "5" }))
    ).toEqual([]);
  });

  it("withdraw converts shares and requests zero-minimum output amounts", async () => {
    const result = await vaultWithdrawDefindexDefinition.prepare(
      ctx({ shares: "10" })
    );
    expect(defindexMethods.withdraw).toHaveBeenCalledWith({
      withdraw_shares: 100_000_000n,
      min_amounts_out: [0n],
      from: "GUSER",
    });
    expect(result.xdr).toBe("VAULT_WITHDRAW_XDR");
  });

  it("withdraw validate rejects zero shares", () => {
    expect(
      vaultWithdrawDefindexDefinition.validate(ctx({ shares: "0" }))
    ).toContainEqual(expect.objectContaining({ code: "INVALID_AMOUNT" }));
  });
});

describe("lpAddSoroswapDefinition", () => {
  it("builds the TOKEN_A-TOKEN_B pool id and calls adapter.deposit", async () => {
    const result = await lpAddSoroswapDefinition.prepare(
      ctx({ tokenA: "USDC", tokenB: "XLM", amount: "10" })
    );
    expect(soroswapAdapterMethods.deposit).toHaveBeenCalledWith(
      "USDC-XLM",
      "GUSER",
      100_000_000n
    );
    expect(result.xdr).toBe("LP_ADD_XDR");
  });

  it("validate rejects identical tokenA/tokenB", () => {
    expect(
      lpAddSoroswapDefinition.validate(
        ctx({ tokenA: "USDC", tokenB: "USDC", amount: "1" })
      )
    ).toContainEqual(expect.objectContaining({ code: "INCOMPATIBLE_ASSET" }));
  });
});

describe("lpRemoveSoroswapDefinition", () => {
  const params = { tokenA: "USDC", tokenB: "XLM", amount: "10" };

  it("always fails validation with a clear unsupported-combination message", () => {
    const issues = lpRemoveSoroswapDefinition.validate(ctx(params));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: "error",
      code: "UNSUPPORTED_PROTOCOL_COMBINATION",
    });
    expect(issues[0].message).toMatch(/not yet supported/i);
  });

  it("simulate and prepare reject rather than silently succeeding", async () => {
    await expect(
      lpRemoveSoroswapDefinition.simulate(ctx(params))
    ).rejects.toThrow(/not yet supported/i);
    await expect(
      lpRemoveSoroswapDefinition.prepare(ctx(params))
    ).rejects.toThrow(/not yet supported/i);
  });

  it("still declares an output port so the composer can render it", () => {
    expect(lpRemoveSoroswapDefinition.describeOutputs(params)).toEqual([
      { id: "out.withdrawnAssets", assetCode: "USDC-XLM", kind: "asset" },
    ]);
  });
});

describe("registerBuiltInStepDefinitions (registration wiring)", () => {
  const expectedKeys: Array<[string, string]> = [
    ["swap", "soroswap"],
    ["supply", "neko"],
    ["supply", "blend"],
    ["borrow", "neko"],
    ["borrow", "blend"],
    ["repay", "neko"],
    ["repay", "blend"],
    ["vaultDeposit", "defindex"],
    ["vaultWithdraw", "defindex"],
    ["lpAdd", "soroswap"],
    ["lpRemove", "soroswap"],
  ];

  it("registers exactly the 11 built-in (stepType, protocol) pairs (already registered via module import side effect)", () => {
    registerBuiltInStepDefinitions();
    for (const [stepType, protocol] of expectedKeys) {
      expect(strategyStepRegistry.has(stepType, protocol)).toBe(true);
    }
  });
});
