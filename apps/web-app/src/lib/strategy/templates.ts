import type { Strategy } from "./types";

/**
 * The 4 built-in templates, as plain Strategy data (isTemplate: true) — not
 * separate code paths. "Use Template" in the composer clones one of these
 * into an editable draft (new id, isTemplate: false); the composer, the
 * validator, the simulator, and the execution engine treat a cloned
 * template exactly like any user-authored strategy.
 */
export const STRATEGY_TEMPLATES: Strategy[] = [
  {
    id: "template-swap-then-vault-deposit",
    version: 1,
    name: "Swap → Vault Deposit",
    description:
      "Swap an asset you're holding into a DeFindex vault's base asset, then deposit the proceeds in one composed strategy.",
    isTemplate: true,
    createdAt: 0,
    updatedAt: 0,
    steps: [
      {
        id: "swap",
        type: "swap",
        protocol: "soroswap",
        label: "Swap",
        dependsOn: [],
        params: {
          tokenIn: { source: "literal", value: "XLM" },
          tokenOut: { source: "literal", value: "USDC" },
          amountIn: { source: "literal", value: "100" },
        },
      },
      {
        id: "deposit",
        type: "vaultDeposit",
        protocol: "defindex",
        label: "Vault Deposit",
        dependsOn: ["swap"],
        params: {
          amount: {
            source: "stepOutput",
            stepId: "swap",
            portId: "out.receivedAsset",
          },
        },
      },
    ],
  },
  {
    id: "template-leveraged-supply",
    version: 1,
    name: "Leveraged Supply",
    description:
      "Supply an RWA asset as collateral, borrow against it, and re-supply the borrowed asset to amplify yield exposure.",
    isTemplate: true,
    createdAt: 0,
    updatedAt: 0,
    steps: [
      {
        id: "supply-collateral",
        type: "supply",
        protocol: "blend",
        label: "Supply Collateral",
        dependsOn: [],
        params: {
          mode: { source: "literal", value: "collateral" },
          direction: { source: "literal", value: "deposit" },
          poolContractId: { source: "literal", value: "" },
          assetAddress: { source: "literal", value: "" },
          amount: { source: "literal", value: "100" },
        },
      },
      {
        id: "borrow",
        type: "borrow",
        protocol: "blend",
        label: "Borrow",
        dependsOn: ["supply-collateral"],
        params: {
          poolContractId: { source: "literal", value: "" },
          assetAddress: { source: "literal", value: "" },
          amount: { source: "literal", value: "50" },
        },
      },
      {
        id: "resupply",
        type: "supply",
        protocol: "blend",
        label: "Re-supply Borrowed Asset",
        dependsOn: ["borrow"],
        params: {
          mode: { source: "literal", value: "supply" },
          direction: { source: "literal", value: "deposit" },
          poolContractId: { source: "literal", value: "" },
          assetAddress: { source: "literal", value: "" },
          amount: {
            source: "stepOutput",
            stepId: "borrow",
            portId: "out.borrowedAsset",
          },
        },
      },
    ],
  },
  {
    id: "template-position-unwind",
    version: 1,
    name: "Position Unwind",
    description:
      "Repay outstanding debt and withdraw the underlying collateral — the reverse of a leveraged position, composed from the same Repay and Supply(withdraw) step types.",
    isTemplate: true,
    createdAt: 0,
    updatedAt: 0,
    steps: [
      {
        id: "repay",
        type: "repay",
        protocol: "blend",
        label: "Repay",
        dependsOn: [],
        params: {
          poolContractId: { source: "literal", value: "" },
          assetAddress: { source: "literal", value: "" },
          amount: { source: "literal", value: "50" },
        },
      },
      {
        id: "withdraw-collateral",
        type: "supply",
        protocol: "blend",
        label: "Withdraw Collateral",
        dependsOn: ["repay"],
        params: {
          mode: { source: "literal", value: "collateral" },
          direction: { source: "literal", value: "withdraw" },
          poolContractId: { source: "literal", value: "" },
          assetAddress: { source: "literal", value: "" },
          amount: { source: "literal", value: "100" },
        },
      },
    ],
  },
  {
    id: "template-single-asset-liquidity",
    version: 1,
    name: "Single Asset Liquidity Position",
    description:
      "Start from one asset, swap half into its pair, and add both sides to a SoroSwap liquidity pool.",
    isTemplate: true,
    createdAt: 0,
    updatedAt: 0,
    steps: [
      {
        id: "swap-half",
        type: "swap",
        protocol: "soroswap",
        label: "Swap Half",
        dependsOn: [],
        params: {
          tokenIn: { source: "literal", value: "XLM" },
          tokenOut: { source: "literal", value: "USDC" },
          amountIn: { source: "literal", value: "50" },
        },
      },
      {
        id: "lp-add",
        type: "lpAdd",
        protocol: "soroswap",
        label: "Add Liquidity",
        dependsOn: ["swap-half"],
        params: {
          tokenA: { source: "literal", value: "XLM" },
          tokenB: { source: "literal", value: "USDC" },
          amount: {
            source: "stepOutput",
            stepId: "swap-half",
            portId: "out.receivedAsset",
          },
        },
      },
    ],
  },
];

export function findTemplate(id: string): Strategy | undefined {
  return STRATEGY_TEMPLATES.find((t) => t.id === id);
}
