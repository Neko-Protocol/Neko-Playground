export const STELLAR_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
  "Test SDF Network ; September 2015";

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??
  "https://horizon-testnet.stellar.org";

export const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
  "https://soroban-testnet.stellar.org";

export const XLM_SAC =
  process.env.NEXT_PUBLIC_XLM_SAC ??
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

/**
 * v2: Neko Listing Registry. Replaces the old neko-distributor.
 * The legacy env var name is accepted as a fallback so existing local
 * .env files keep working during the migration.
 */
export const NEKO_LISTING_REGISTRY_CONTRACT_ID =
  process.env.NEXT_PUBLIC_NEKO_LISTING_REGISTRY_CONTRACT_ID ??
  process.env.NEXT_PUBLIC_NEKO_DISTRIBUTOR_CONTRACT_ID ??
  "";

/** Reflector SEP-40 oracles on testnet — defaults for the issuer dropdown. */
export const REFLECTOR_ORACLES = [
  {
    id: "stellar",
    label: "Stellar Pubnet",
    address:
      process.env.NEXT_PUBLIC_REFLECTOR_ORACLE_STELLAR ??
      "CAVLP5DH2GJPZMVO7IJY4CVOD5MWEFTJFVPD2YY2FQXOQHRGHK4D6HLP",
    base: "XLM",
    description:
      "Stellar-native assets (XLM, USDC, USDT, etc.). Base currency: XLM.",
  },
  {
    id: "external",
    label: "External CEX/DEX",
    address:
      process.env.NEXT_PUBLIC_REFLECTOR_ORACLE_EXTERNAL ??
      "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63",
    base: "USD",
    description: "External crypto (BTC, ETH, ADA, SOL, …). Base currency: USD.",
  },
  {
    id: "fx",
    label: "Foreign Exchange",
    address:
      process.env.NEXT_PUBLIC_REFLECTOR_ORACLE_FX ??
      "CCSSOHTBL3LEWUCBBEB5NJFC2OKFRC74OWEIJIZLRJBGAAU4VMU5NV4W",
    base: "USD",
    description: "Fiat FX rates (USD, EUR, GBP, JPY, CHF). Base currency: USD.",
  },
] as const;

export const ISSUER_KYC_LEVEL = "accredited" as const;

export const KYC_LEVELS = ["basic", "accredited", "institutional"] as const;

export const ALLOWED_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "MX", name: "Mexico" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "SG", name: "Singapore" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Peru" },
  { code: "ES", name: "Spain" },
  { code: "FR", name: "France" },
] as const;

export const STELLAR_EXPERT_TESTNET = "https://stellar.expert/explorer/testnet";
