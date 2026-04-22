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

export const NEKO_DISTRIBUTOR_CONTRACT_ID =
  process.env.NEXT_PUBLIC_NEKO_DISTRIBUTOR_CONTRACT_ID ?? "";

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
