import type { VaultAsset, VaultConfig } from "../types/vault";
import { getContracts } from "@/lib/constants/contractsByNetwork";

const contracts = getContracts();

const USDC: VaultAsset = {
  symbol: "USDC",
  name: "USD Coin",
  iconSrc: "/assets/vault-assets/usdc.svg",
  iconWhiteSrc: "/assets/vault-assets/usdc-white.svg",
  logoSrc: "/assets/usdc-logo.png",
  network: "Stellar",
};

const CETES: VaultAsset = {
  symbol: "CETES",
  name: "CETES",
  iconSrc: "/assets/vault-assets/cetes.svg",
  iconWhiteSrc: "/assets/vault-assets/cetes-white.svg",
  logoSrc: "/assets/cetes-logo.png",
  network: "Stellar",
};

export const VAULT_REGISTRY: Record<string, VaultConfig> = {
  "neko-usdc-cetes": {
    id: "neko-usdc-cetes",
    name: "Neko USDC-CETES Vault",
    description:
      "High-yield USDC lending vault backed by real-world CETES collateral on Stellar.",
    category: "lending",
    status: "active",
    supplyAsset: USDC,
    collateralAssets: [USDC, CETES],
    createdBy: "Neko Protocol",
    creatorIconSrc: "/neko-logo.png",
    variant: "light",
    featured: true,
    detail: {
      description:
        "Deposit CETES to earn yield through automated strategies across AMMs and lending protocols on Stellar.",
      strategies: [
        {
          protocol: "Neko",
          description: "RWA lending pool using CETES as collateral.",
        },
        {
          protocol: "Aquarius",
          description:
            "AMM liquidity provision in the CETES/USDC pool with AQUA rewards.",
        },
        {
          protocol: "Soroswap",
          description:
            "Automated liquidity provision in the CETES/USDC trading pair.",
        },
      ],
      contracts: {
        vault: contracts.vault,
        pools: contracts.vaultPools,
        strategies: contracts.strategies,
      },
      liquidity:
        "Withdrawals are available at any time, subject to liquidity conditions across underlying protocols.",
    },
  },
};
