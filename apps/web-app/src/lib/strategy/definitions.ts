import { z } from "zod";
import {
  getAvailableTokens,
  getQuote,
  buildTransaction,
} from "@/lib/helpers/stellar/soroswap";
import { fromSmallestUnit, toSmallestUnit } from "@/lib/helpers/tokenUtils";
import { NekoLendingAdapter } from "@/lib/orchestrator/adapters/NekoLendingAdapter";
import { BlendPoolAdapter } from "@/lib/orchestrator/adapters/BlendPoolAdapter";
import { SoroswapPoolAdapter } from "@/lib/orchestrator/adapters/SoroswapPoolAdapter";
import { Client as DefindexVaultClient } from "@neko/defindex-vault";
import { rpcUrl, networkPassphrase } from "@/lib/constants/network";
import { strategyStepRegistry } from "./registry";
import type {
  StepProjection,
  StrategyStepDefinition,
  TxResult,
  ValidationIssue,
} from "./types";

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Base Stellar tx fee in stroops, matching the `fee: "100"` used throughout the adapters. */
const BASE_FEE_STROOPS = "100";

function baseFeeEstimate(): string {
  return fromSmallestUnit(BASE_FEE_STROOPS, 7);
}

function knownAssetCode(assetCode: string): boolean {
  return Boolean(getAvailableTokens()[assetCode]?.contract);
}

/** Mirrors features/vault/hooks/useVaultAction.ts — single deployed DeFindex vault. */
const DEFINDEX_VAULT_CONTRACT_ID =
  "CBHGX6TCHHVYJ7P3UZS7WI5TRAAA7GQA2L2Y7P2LCPIXWWD5FKDF2Z5S";
const DEFINDEX_DEPOSIT_SLIPPAGE = 0.01;
const DEFINDEX_SLIPPAGE_SCALE = 10_000_000n;

type ParseResult<T> =
  { ok: true; data: T } | { ok: false; issues: ValidationIssue[] };

/**
 * validate() must never throw — a malformed/unresolved param is itself a
 * validation issue, not a crash. Every definition's validate() starts with
 * this instead of calling paramsSchema.parse() directly.
 */
function safeParseParams<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  input: unknown
): ParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      stepId: null,
      severity: "error" as const,
      code: "INVALID_PARAMS",
      message: `${issue.path.join(".") || "params"}: ${issue.message}`,
    })),
  };
}

// ─── Swap (SoroSwap) ─────────────────────────────────────────────────────────

const swapParamsSchema = z.object({
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amountIn: z.string().min(1),
});
type SwapParams = z.infer<typeof swapParamsSchema>;

const swapSoroswapDefinition: StrategyStepDefinition<SwapParams> = {
  stepType: "swap",
  protocol: "soroswap",
  submissionMode: "soroswapApi",
  paramsSchema: swapParamsSchema,

  describeOutputs(params) {
    return [
      { id: "out.receivedAsset", assetCode: params.tokenOut, kind: "asset" },
    ];
  },

  validate(ctx) {
    const parsed = safeParseParams(swapParamsSchema, ctx.resolvedParams);
    if (!parsed.ok) return parsed.issues;
    const { tokenIn, tokenOut } = parsed.data;
    const issues: ValidationIssue[] = [];
    if (tokenIn === tokenOut) {
      issues.push({
        stepId: null,
        severity: "error",
        code: "INCOMPATIBLE_ASSET",
        message: "Swap tokenIn and tokenOut must be different assets.",
      });
    }
    if (!knownAssetCode(tokenIn)) {
      issues.push({
        stepId: null,
        severity: "error",
        code: "UNKNOWN_ASSET",
        message: `Unknown asset code: ${tokenIn}`,
      });
    }
    if (!knownAssetCode(tokenOut)) {
      issues.push({
        stepId: null,
        severity: "error",
        code: "UNKNOWN_ASSET",
        message: `Unknown asset code: ${tokenOut}`,
      });
    }
    return issues;
  },

  async simulate(ctx) {
    const { tokenIn, tokenOut, amountIn } = swapParamsSchema.parse(
      ctx.resolvedParams
    );
    const quote = await getQuote({
      assetIn: tokenIn,
      assetOut: tokenOut,
      amount: amountIn,
      tradeType: "EXACT_IN",
    });
    if (!quote)
      throw new Error(
        `No liquidity found for ${tokenIn} -> ${tokenOut} — try a different pair`
      );
    const priceImpactBps = Math.round(
      parseFloat(quote.priceImpact ?? "0") * 100
    );
    return {
      outputs: { "out.receivedAsset": quote.amountOut },
      resultingBalances: { [tokenOut]: quote.amountOut },
      estimatedFee: baseFeeEstimate(),
      slippageBps: Number.isFinite(priceImpactBps) ? priceImpactBps : 0,
      warnings: [],
    };
  },

  async prepare(ctx) {
    const { tokenIn, tokenOut, amountIn } = swapParamsSchema.parse(
      ctx.resolvedParams
    );
    const quote = await getQuote({
      assetIn: tokenIn,
      assetOut: tokenOut,
      amount: amountIn,
      tradeType: "EXACT_IN",
    });
    if (!quote)
      throw new Error(
        `No liquidity found for ${tokenIn} -> ${tokenOut} — try a different pair`
      );
    const built = await buildTransaction({
      quote,
      from: ctx.userAddress,
      to: ctx.userAddress,
    });
    return { xdr: built.xdr, networkPassphrase: ctx.networkPassphrase };
  },
};

// ─── Supply / Borrow / Repay — Neko ──────────────────────────────────────────

/**
 * "Supply" on Neko covers two on-chain actions selected via `mode`:
 *  - "supply": plain pool lending (deposit/withdraw), earns yield, does not
 *    affect borrowing health factor.
 *  - "collateral": add_collateral/remove_collateral against a debt pool,
 *    backs a Borrow step and does affect health factor.
 * `direction` makes both bidirectional, which is how the Position Unwind
 * template composes a withdraw using the same step type as a deposit.
 */
const supplyParamsSchema = z.object({
  mode: z.enum(["supply", "collateral"]).default("supply"),
  direction: z.enum(["deposit", "withdraw"]).default("deposit"),
  assetCode: z.string().optional(),
  poolContractId: z.string().optional(),
  collateralTokenAddress: z.string().optional(),
  decimals: z.number().default(7),
  amount: z.string().min(1),
});
type SupplyNekoParams = z.infer<typeof supplyParamsSchema>;

function supplyNekoPoolId(params: SupplyNekoParams): string {
  if (params.mode === "collateral") {
    if (!params.poolContractId || !params.collateralTokenAddress) {
      throw new Error(
        "supply(collateral) requires poolContractId and collateralTokenAddress"
      );
    }
    return `${params.poolContractId}:${params.collateralTokenAddress}`;
  }
  if (!params.assetCode) throw new Error("supply(supply) requires assetCode");
  return params.assetCode;
}

const supplyNekoDefinition: StrategyStepDefinition<SupplyNekoParams> = {
  stepType: "supply",
  protocol: "neko",
  submissionMode: "rpc",
  paramsSchema: supplyParamsSchema,

  describeOutputs(params) {
    return [
      {
        id: "out.resultingAmount",
        assetCode: params.assetCode ?? params.collateralTokenAddress ?? null,
        kind: params.mode === "collateral" ? "collateralPosition" : "asset",
      },
    ];
  },

  validate(ctx) {
    const parsed = safeParseParams(supplyParamsSchema, ctx.resolvedParams);
    if (!parsed.ok) return parsed.issues;
    const params = parsed.data;
    const issues: ValidationIssue[] = [];
    if (params.mode === "supply") {
      if (!params.assetCode) {
        issues.push({
          stepId: null,
          severity: "error",
          code: "MISSING_PARAM",
          message: "assetCode is required for supply(mode=supply).",
        });
      } else if (!knownAssetCode(params.assetCode)) {
        issues.push({
          stepId: null,
          severity: "error",
          code: "UNKNOWN_ASSET",
          message: `Unknown asset code: ${params.assetCode}`,
        });
      }
    } else if (!params.poolContractId || !params.collateralTokenAddress) {
      issues.push({
        stepId: null,
        severity: "error",
        code: "MISSING_PARAM",
        message:
          "poolContractId and collateralTokenAddress are required for supply(mode=collateral).",
      });
    }
    return issues;
  },

  async simulate(ctx) {
    const params = supplyParamsSchema.parse(ctx.resolvedParams);
    const signedAmount =
      params.direction === "deposit"
        ? Number(params.amount)
        : -Number(params.amount);
    return {
      outputs: { "out.resultingAmount": params.amount },
      estimatedFee: baseFeeEstimate(),
      warnings: [],
      resultingPosition:
        params.mode === "collateral"
          ? {
              protocol: "neko",
              collateralAssetCode: params.collateralTokenAddress,
              collateralDelta: signedAmount,
            }
          : { protocol: "neko" },
    };
  },

  async prepare(ctx) {
    const params = supplyParamsSchema.parse(ctx.resolvedParams);
    const adapter = new NekoLendingAdapter();
    const poolId = supplyNekoPoolId(params);
    const amountBigInt = toSmallestUnit(params.amount, params.decimals);
    const method =
      params.mode === "collateral"
        ? params.direction === "deposit"
          ? adapter.supplyCollateral?.bind(adapter)
          : adapter.withdrawCollateral?.bind(adapter)
        : params.direction === "deposit"
          ? adapter.deposit.bind(adapter)
          : adapter.withdraw.bind(adapter);
    if (!method)
      throw new Error(`NekoLendingAdapter has no method for ${params.mode}`);
    return method(poolId, ctx.userAddress, amountBigInt);
  },
};

const assetAmountParamsSchema = z.object({
  assetCode: z.string().min(1),
  decimals: z.number().default(7),
  amount: z.string().min(1),
});
type AssetAmountParams = z.infer<typeof assetAmountParamsSchema>;

const borrowNekoDefinition: StrategyStepDefinition<AssetAmountParams> = {
  stepType: "borrow",
  protocol: "neko",
  submissionMode: "rpc",
  paramsSchema: assetAmountParamsSchema,

  describeOutputs(params) {
    return [
      { id: "out.borrowedAsset", assetCode: params.assetCode, kind: "asset" },
    ];
  },

  validate(ctx) {
    const parsed = safeParseParams(assetAmountParamsSchema, ctx.resolvedParams);
    if (!parsed.ok) return parsed.issues;
    const { assetCode } = parsed.data;
    return knownAssetCode(assetCode)
      ? []
      : [
          {
            stepId: null,
            severity: "error",
            code: "UNKNOWN_ASSET",
            message: `Unknown asset code: ${assetCode}`,
          },
        ];
  },

  async simulate(ctx) {
    const params = assetAmountParamsSchema.parse(ctx.resolvedParams);
    return {
      outputs: { "out.borrowedAsset": params.amount },
      estimatedFee: baseFeeEstimate(),
      warnings: [],
      resultingPosition: {
        protocol: "neko",
        debtAssetCode: params.assetCode,
        debtDelta: Number(params.amount),
      },
    };
  },

  async prepare(ctx) {
    const params = assetAmountParamsSchema.parse(ctx.resolvedParams);
    const adapter = new NekoLendingAdapter();
    return adapter.borrow(
      params.assetCode,
      ctx.userAddress,
      toSmallestUnit(params.amount, params.decimals)
    );
  },
};

const repayNekoDefinition: StrategyStepDefinition<AssetAmountParams> = {
  stepType: "repay",
  protocol: "neko",
  submissionMode: "rpc",
  paramsSchema: assetAmountParamsSchema,

  describeOutputs(params) {
    return [
      {
        id: "out.remainingDebt",
        assetCode: params.assetCode,
        kind: "debtPosition",
      },
    ];
  },

  validate(ctx) {
    const parsed = safeParseParams(assetAmountParamsSchema, ctx.resolvedParams);
    if (!parsed.ok) return parsed.issues;
    const { assetCode } = parsed.data;
    return knownAssetCode(assetCode)
      ? []
      : [
          {
            stepId: null,
            severity: "error",
            code: "UNKNOWN_ASSET",
            message: `Unknown asset code: ${assetCode}`,
          },
        ];
  },

  async simulate(ctx) {
    const params = assetAmountParamsSchema.parse(ctx.resolvedParams);
    return {
      outputs: { "out.remainingDebt": params.amount },
      estimatedFee: baseFeeEstimate(),
      warnings: [],
      resultingPosition: {
        protocol: "neko",
        debtAssetCode: params.assetCode,
        debtDelta: -Number(params.amount),
      },
    };
  },

  /** amount is underlying-asset units (matching Blend's repay contract); NekoLendingAdapter.repay converts to dTokens internally. */
  async prepare(ctx) {
    const params = assetAmountParamsSchema.parse(ctx.resolvedParams);
    const adapter = new NekoLendingAdapter();
    return adapter.repay(
      params.assetCode,
      ctx.userAddress,
      toSmallestUnit(params.amount, params.decimals)
    );
  },
};

// ─── Supply / Borrow / Repay — Blend ─────────────────────────────────────────

const blendSupplyParamsSchema = z.object({
  mode: z.enum(["supply", "collateral"]).default("supply"),
  direction: z.enum(["deposit", "withdraw"]).default("deposit"),
  poolContractId: z.string().min(1),
  assetAddress: z.string().min(1),
  decimals: z.number().default(7),
  amount: z.string().min(1),
});
type SupplyBlendParams = z.infer<typeof blendSupplyParamsSchema>;

const supplyBlendDefinition: StrategyStepDefinition<SupplyBlendParams> = {
  stepType: "supply",
  protocol: "blend",
  submissionMode: "rpc",
  paramsSchema: blendSupplyParamsSchema,

  describeOutputs(params) {
    return [
      {
        id: "out.resultingAmount",
        assetCode: params.assetAddress,
        kind: params.mode === "collateral" ? "collateralPosition" : "asset",
      },
    ];
  },

  validate(ctx) {
    const parsed = safeParseParams(blendSupplyParamsSchema, ctx.resolvedParams);
    if (!parsed.ok) return parsed.issues;
    const params = parsed.data;
    return params.poolContractId && params.assetAddress
      ? []
      : [
          {
            stepId: null,
            severity: "error",
            code: "MISSING_PARAM",
            message: "poolContractId and assetAddress are required.",
          },
        ];
  },

  async simulate(ctx) {
    const params = blendSupplyParamsSchema.parse(ctx.resolvedParams);
    const signedAmount =
      params.direction === "deposit"
        ? Number(params.amount)
        : -Number(params.amount);
    return {
      outputs: { "out.resultingAmount": params.amount },
      estimatedFee: baseFeeEstimate(),
      warnings: [],
      resultingPosition:
        params.mode === "collateral"
          ? {
              protocol: "blend",
              collateralAssetCode: params.assetAddress,
              collateralDelta: signedAmount,
            }
          : { protocol: "blend" },
    };
  },

  async prepare(ctx) {
    const params = blendSupplyParamsSchema.parse(ctx.resolvedParams);
    const adapter = new BlendPoolAdapter(params.poolContractId);
    const amountBigInt = toSmallestUnit(params.amount, params.decimals);
    const rawId = `${params.poolContractId}:${params.assetAddress}`;
    const method =
      params.mode === "collateral"
        ? params.direction === "deposit"
          ? adapter.supplyCollateral?.bind(adapter)
          : adapter.withdrawCollateral?.bind(adapter)
        : params.direction === "deposit"
          ? adapter.deposit.bind(adapter)
          : adapter.withdraw.bind(adapter);
    if (!method)
      throw new Error(`BlendPoolAdapter has no method for ${params.mode}`);
    return method(rawId, ctx.userAddress, amountBigInt);
  },
};

const blendPoolAssetParamsSchema = z.object({
  poolContractId: z.string().min(1),
  assetAddress: z.string().min(1),
  decimals: z.number().default(7),
  amount: z.string().min(1),
});
type BlendPoolAssetParams = z.infer<typeof blendPoolAssetParamsSchema>;

const borrowBlendDefinition: StrategyStepDefinition<BlendPoolAssetParams> = {
  stepType: "borrow",
  protocol: "blend",
  submissionMode: "rpc",
  paramsSchema: blendPoolAssetParamsSchema,

  describeOutputs(params) {
    return [
      {
        id: "out.borrowedAsset",
        assetCode: params.assetAddress,
        kind: "asset",
      },
    ];
  },

  validate(ctx) {
    const parsed = safeParseParams(
      blendPoolAssetParamsSchema,
      ctx.resolvedParams
    );
    if (!parsed.ok) return parsed.issues;
    const params = parsed.data;
    return params.poolContractId && params.assetAddress
      ? []
      : [
          {
            stepId: null,
            severity: "error",
            code: "MISSING_PARAM",
            message: "poolContractId and assetAddress are required.",
          },
        ];
  },

  async simulate(ctx) {
    const params = blendPoolAssetParamsSchema.parse(ctx.resolvedParams);
    return {
      outputs: { "out.borrowedAsset": params.amount },
      estimatedFee: baseFeeEstimate(),
      warnings: [],
      resultingPosition: {
        protocol: "blend",
        debtAssetCode: params.assetAddress,
        debtDelta: Number(params.amount),
      },
    };
  },

  async prepare(ctx) {
    const params = blendPoolAssetParamsSchema.parse(ctx.resolvedParams);
    const adapter = new BlendPoolAdapter(params.poolContractId);
    const rawId = `${params.poolContractId}:${params.assetAddress}`;
    if (!adapter.borrow) throw new Error("BlendPoolAdapter.borrow unavailable");
    return adapter.borrow(
      rawId,
      ctx.userAddress,
      toSmallestUnit(params.amount, params.decimals)
    );
  },
};

const repayBlendDefinition: StrategyStepDefinition<BlendPoolAssetParams> = {
  stepType: "repay",
  protocol: "blend",
  submissionMode: "rpc",
  paramsSchema: blendPoolAssetParamsSchema,

  describeOutputs(params) {
    return [
      {
        id: "out.remainingDebt",
        assetCode: params.assetAddress,
        kind: "debtPosition",
      },
    ];
  },

  validate(ctx) {
    const parsed = safeParseParams(
      blendPoolAssetParamsSchema,
      ctx.resolvedParams
    );
    if (!parsed.ok) return parsed.issues;
    const params = parsed.data;
    return params.poolContractId && params.assetAddress
      ? []
      : [
          {
            stepId: null,
            severity: "error",
            code: "MISSING_PARAM",
            message: "poolContractId and assetAddress are required.",
          },
        ];
  },

  async simulate(ctx) {
    const params = blendPoolAssetParamsSchema.parse(ctx.resolvedParams);
    return {
      outputs: { "out.remainingDebt": params.amount },
      estimatedFee: baseFeeEstimate(),
      warnings: [],
      resultingPosition: {
        protocol: "blend",
        debtAssetCode: params.assetAddress,
        debtDelta: -Number(params.amount),
      },
    };
  },

  async prepare(ctx) {
    const params = blendPoolAssetParamsSchema.parse(ctx.resolvedParams);
    const adapter = new BlendPoolAdapter(params.poolContractId);
    const rawId = `${params.poolContractId}:${params.assetAddress}`;
    if (!adapter.repay) throw new Error("BlendPoolAdapter.repay unavailable");
    return adapter.repay(
      rawId,
      ctx.userAddress,
      toSmallestUnit(params.amount, params.decimals)
    );
  },
};

// ─── Vault Deposit / Withdraw — DeFindex ─────────────────────────────────────

const vaultDepositParamsSchema = z.object({
  vaultContractId: z.string().default(DEFINDEX_VAULT_CONTRACT_ID),
  amount: z.string().min(1),
});
type VaultDepositParams = z.infer<typeof vaultDepositParamsSchema>;

const vaultDepositDefindexDefinition: StrategyStepDefinition<VaultDepositParams> =
  {
    stepType: "vaultDeposit",
    protocol: "defindex",
    submissionMode: "rpc",
    paramsSchema: vaultDepositParamsSchema,

    describeOutputs() {
      return [{ id: "out.dfTokens", assetCode: null, kind: "shares" }];
    },

    validate(ctx) {
      const parsed = safeParseParams(
        vaultDepositParamsSchema,
        ctx.resolvedParams
      );
      if (!parsed.ok) return parsed.issues;
      return Number(parsed.data.amount) > 0
        ? []
        : [
            {
              stepId: null,
              severity: "error",
              code: "INVALID_AMOUNT",
              message: "Vault deposit amount must be greater than zero.",
            },
          ];
    },

    async simulate(ctx) {
      const params = vaultDepositParamsSchema.parse(ctx.resolvedParams);
      return {
        outputs: { "out.dfTokens": params.amount },
        estimatedFee: baseFeeEstimate(),
        warnings: [],
        resultingPosition: { protocol: "defindex" },
      };
    },

    async prepare(ctx) {
      const params = vaultDepositParamsSchema.parse(ctx.resolvedParams);
      const client = new DefindexVaultClient({
        contractId: params.vaultContractId,
        rpcUrl,
        networkPassphrase,
        publicKey: ctx.userAddress,
      });
      const amountBigInt = toSmallestUnit(params.amount, 7);
      const slippageScaled = toSmallestUnit(
        String(DEFINDEX_DEPOSIT_SLIPPAGE),
        7
      );
      const minAmount =
        amountBigInt -
        (amountBigInt * slippageScaled) / DEFINDEX_SLIPPAGE_SCALE;
      const depositTx = await client.deposit({
        amounts_desired: [amountBigInt],
        amounts_min: [minAmount],
        from: ctx.userAddress,
        invest: false,
      });
      return {
        xdr: depositTx.toXDR(),
        networkPassphrase: ctx.networkPassphrase,
      };
    },
  };

const vaultWithdrawParamsSchema = z.object({
  vaultContractId: z.string().default(DEFINDEX_VAULT_CONTRACT_ID),
  /** dfToken shares to redeem. */
  shares: z.string().min(1),
});
type VaultWithdrawParams = z.infer<typeof vaultWithdrawParamsSchema>;

const vaultWithdrawDefindexDefinition: StrategyStepDefinition<VaultWithdrawParams> =
  {
    stepType: "vaultWithdraw",
    protocol: "defindex",
    submissionMode: "rpc",
    paramsSchema: vaultWithdrawParamsSchema,

    describeOutputs() {
      return [{ id: "out.withdrawnAsset", assetCode: null, kind: "asset" }];
    },

    validate(ctx) {
      const parsed = safeParseParams(
        vaultWithdrawParamsSchema,
        ctx.resolvedParams
      );
      if (!parsed.ok) return parsed.issues;
      return Number(parsed.data.shares) > 0
        ? []
        : [
            {
              stepId: null,
              severity: "error",
              code: "INVALID_AMOUNT",
              message: "Vault withdraw shares must be greater than zero.",
            },
          ];
    },

    async simulate(ctx) {
      const params = vaultWithdrawParamsSchema.parse(ctx.resolvedParams);
      return {
        outputs: { "out.withdrawnAsset": params.shares },
        estimatedFee: baseFeeEstimate(),
        warnings: [],
        resultingPosition: { protocol: "defindex" },
      };
    },

    async prepare(ctx) {
      const params = vaultWithdrawParamsSchema.parse(ctx.resolvedParams);
      const client = new DefindexVaultClient({
        contractId: params.vaultContractId,
        rpcUrl,
        networkPassphrase,
        publicKey: ctx.userAddress,
      });
      const withdrawTx = await client.withdraw({
        withdraw_shares: toSmallestUnit(params.shares, 7),
        min_amounts_out: [0n],
        from: ctx.userAddress,
      });
      return {
        xdr: withdrawTx.toXDR(),
        networkPassphrase: ctx.networkPassphrase,
      };
    },
  };

// ─── LP Add / Remove — SoroSwap ──────────────────────────────────────────────

const lpAddParamsSchema = z.object({
  tokenA: z.string().min(1),
  tokenB: z.string().min(1),
  /** SoroswapPoolAdapter.deposit mirrors this amount to both sides of the pair. */
  amount: z.string().min(1),
  decimals: z.number().default(7),
});
type LpAddParams = z.infer<typeof lpAddParamsSchema>;

function lpPoolId(params: LpAddParams | LpRemoveParams): string {
  return `${params.tokenA}-${params.tokenB}`;
}

const lpAddSoroswapDefinition: StrategyStepDefinition<LpAddParams> = {
  stepType: "lpAdd",
  protocol: "soroswap",
  submissionMode: "rpc",
  paramsSchema: lpAddParamsSchema,

  describeOutputs(params) {
    return [
      { id: "out.lpPosition", assetCode: lpPoolId(params), kind: "lpPosition" },
    ];
  },

  validate(ctx) {
    const parsed = safeParseParams(lpAddParamsSchema, ctx.resolvedParams);
    if (!parsed.ok) return parsed.issues;
    const params = parsed.data;
    return params.tokenA === params.tokenB
      ? [
          {
            stepId: null,
            severity: "error",
            code: "INCOMPATIBLE_ASSET",
            message: "LP Add requires two different assets.",
          },
        ]
      : [];
  },

  async simulate(ctx) {
    const params = lpAddParamsSchema.parse(ctx.resolvedParams);
    return {
      outputs: { "out.lpPosition": params.amount },
      estimatedFee: baseFeeEstimate(),
      warnings: [],
      resultingPosition: { protocol: "soroswap" },
    };
  },

  async prepare(ctx) {
    const params = lpAddParamsSchema.parse(ctx.resolvedParams);
    const adapter = new SoroswapPoolAdapter();
    return adapter.deposit(
      lpPoolId(params),
      ctx.userAddress,
      toSmallestUnit(params.amount, params.decimals)
    );
  },
};

const lpRemoveParamsSchema = z.object({
  tokenA: z.string().min(1),
  tokenB: z.string().min(1),
  amount: z.string().min(1),
});
type LpRemoveParams = z.infer<typeof lpRemoveParamsSchema>;

const LP_REMOVE_UNSUPPORTED_MESSAGE =
  "LP removal is not yet supported by the SoroSwap integration — SoroswapPoolAdapter.withdraw() has no removal API to call. This step will always fail validation until that capability ships.";

/**
 * Registered so strategies referencing lpRemove fail validation cleanly with
 * a clear, step-scoped message instead of the registry throwing or a
 * template silently omitting the step type. This is a real demonstration of
 * "unsupported protocol combinations" validation, not a workaround — see
 * SoroswapPoolAdapter.withdraw().
 */
const lpRemoveSoroswapDefinition: StrategyStepDefinition<LpRemoveParams> = {
  stepType: "lpRemove",
  protocol: "soroswap",
  submissionMode: "rpc",
  paramsSchema: lpRemoveParamsSchema,

  describeOutputs(params) {
    return [
      { id: "out.withdrawnAssets", assetCode: lpPoolId(params), kind: "asset" },
    ];
  },

  validate(): ValidationIssue[] {
    return [
      {
        stepId: null,
        severity: "error",
        code: "UNSUPPORTED_PROTOCOL_COMBINATION",
        message: LP_REMOVE_UNSUPPORTED_MESSAGE,
      },
    ];
  },

  async simulate(): Promise<StepProjection> {
    throw new Error(LP_REMOVE_UNSUPPORTED_MESSAGE);
  },

  async prepare(): Promise<TxResult> {
    throw new Error(LP_REMOVE_UNSUPPORTED_MESSAGE);
  },
};

// ─── Registration ────────────────────────────────────────────────────────────

/**
 * Registers every built-in step definition into the shared registry
 * singleton. Adding a protocol means adding a new definition above and one
 * line here — nothing in validation/simulation/execution changes.
 */
export function registerBuiltInStepDefinitions(): void {
  strategyStepRegistry.register(swapSoroswapDefinition);
  strategyStepRegistry.register(supplyNekoDefinition);
  strategyStepRegistry.register(supplyBlendDefinition);
  strategyStepRegistry.register(borrowNekoDefinition);
  strategyStepRegistry.register(borrowBlendDefinition);
  strategyStepRegistry.register(repayNekoDefinition);
  strategyStepRegistry.register(repayBlendDefinition);
  strategyStepRegistry.register(vaultDepositDefindexDefinition);
  strategyStepRegistry.register(vaultWithdrawDefindexDefinition);
  strategyStepRegistry.register(lpAddSoroswapDefinition);
  strategyStepRegistry.register(lpRemoveSoroswapDefinition);
}

registerBuiltInStepDefinitions();

export {
  baseFeeEstimate,
  knownAssetCode,
  safeParseParams,
  DEFINDEX_VAULT_CONTRACT_ID,
  DEFINDEX_DEPOSIT_SLIPPAGE,
  DEFINDEX_SLIPPAGE_SCALE,
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
};
