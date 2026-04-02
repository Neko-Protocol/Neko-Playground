import type { VaultAsset, VaultConfig, VaultStats } from "../types/vault";

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
    creatorIconSrc: "/Neko.svg",
    variant: "light",
    featured: true,
    detail: {
      description:
        "Deposit USDC to gain exposure to tokenized CETES and earn yield through automated strategies across AMMs and lending protocols on Stellar.",
      strategies: [
        {
          protocol: "Soroswap & Aquarius",
          description: "AMM liquidity provision in the CETES/USDC pool.",
        },
        {
          protocol: "Blend",
          description: "Lending using CETES as collateral to borrow USDC.",
        },
        {
          protocol: "Neko",
          description:
            "Automated allocation and rebalancing across all strategies.",
        },
      ],
      contracts: {
        vault: "CBT6RCAKXKRNPNM5Z5CS7XX4VH2SQHHZZVHB2X7VRS77Q25HLDUGVEVZ",
        pools: {
          neko: "CB4HAFD6ECCOQZXOD6FXUVDM3E773LKR5JHVGA3DBJXIWHZUWX2THEDJ",
          aquarius: "CBJPT2SCZSUJQGBZHHCHLZJX3GVYLOPVUKF53ESH4NFQZMC2UFPDWHRI",
          blend: "CBAIXNER3POGK3HSVY5FPNUNYFGMVZBN4IV7E6324573SXPUKHTISFZP",
          soroswap: "CD2TAYCQZEY7U5CTUOV5QSGWHJNN4ZRPRUSMN2KRM2ZE6ZGX5TNU76H2",
        },
        strategies: {
          neko: "CA53D5GXDYN53YFZHBS6YMY54IC33NRTWUPATMGAL73QFNVDXRTONP3P",
          aquarius: "CBZFU63CGG6Q5DRFYOG3VLAJEUHW55Y7XXD2O3RM2VCVMXDDALUHJZY7",
          soroswap: "CBLCO3YBMXGQAWHPM3P7I5X52T535QPSUZN2VJHJLA7WKAZWEA3PB6EH",
          blend: "CBP5FUVUB4XWQ4ZUUDYR26CGHGLPN4FSHGCTRMTF4Z7V4H3DZFICOES3",
        },
      },
      liquidity:
        "Withdrawals are available at any time, subject to liquidity conditions across underlying protocols.",
    },
  },
};

export const MOCK_STATS: Record<string, VaultStats> = {
  "neko-usdc-cetes": {
    tvl: "$14.94M",
    apy7d: "14.94%",
    utilization: "82%",
    totalSupply: "14,940,000 USDC",
  },
  "neko-cetes-yield": {
    tvl: "$8.21M",
    apy7d: "11.50%",
    utilization: "71%",
    totalSupply: "8,210,000 CETES",
  },
};
