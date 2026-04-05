import type { VaultAsset, VaultConfig } from "../types/vault";

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
        vault: "CBHGX6TCHHVYJ7P3UZS7WI5TRAAA7GQA2L2Y7P2LCPIXWWD5FKDF2Z5S",
        pools: {
          neko: "CB4HAFD6ECCOQZXOD6FXUVDM3E773LKR5JHVGA3DBJXIWHZUWX2THEDJ",
          aquarius: "CBJPT2SCZSUJQGBZHHCHLZJX3GVYLOPVUKF53ESH4NFQZMC2UFPDWHRI",
          soroswap: "CD2TAYCQZEY7U5CTUOV5QSGWHJNN4ZRPRUSMN2KRM2ZE6ZGX5TNU76H2",
        },
        strategies: {
          neko: "CCCEWBCYSIHTGBJ2TUOAFQY63UJ4SWDYTYNAEGXWPB7FP6PRHHGVZJIR",
          aquarius: "CCGV5QSAFRT6OGBZNCE72I6BAODXLDMWEUYAOBI5ZBLHOURSEGVGFTTZ",
          soroswap: "CCY5WW3VXVJDBBXNYXCCH33XTQICHPU6RPFWYJJCT4PTYPN3SXJN2XBJ",
        },
      },
      liquidity:
        "Withdrawals are available at any time, subject to liquidity conditions across underlying protocols.",
    },
  },
};
