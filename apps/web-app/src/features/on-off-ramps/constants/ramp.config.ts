import type { AnchorProvider } from "@/lib/anchors/types";

export interface ProviderConfig {
  name: AnchorProvider;
  displayName: string;
  description: string;
  supportedAssets: string[];
  supportedCurrencies: string[];
  paymentMethod: string;
  region: string;
  kycMethod: "redirect" | "iframe" | "form";
  quoteExpiryMs: number | null;
  onRampLabel: string;
  offRampLabel: string;
}

export const RAMP_PROVIDERS: Record<AnchorProvider, ProviderConfig> = {
  etherfuse: {
    name: "etherfuse",
    displayName: "Etherfuse FX",
    description: "Convert MXN to CETES via SPEI",
    supportedAssets: ["CETES"],
    supportedCurrencies: ["MXN"],
    paymentMethod: "SPEI",
    region: "Mexico",
    kycMethod: "redirect",
    quoteExpiryMs: 120_000, // 2 minutes
    onRampLabel: "MXN → CETES",
    offRampLabel: "CETES → MXN",
  },
  alfredpay: {
    name: "alfredpay",
    displayName: "Alfred Pay",
    description: "Convert MXN to USDC via SPEI",
    supportedAssets: ["USDC"],
    supportedCurrencies: ["MXN"],
    paymentMethod: "SPEI",
    region: "Latin America",
    kycMethod: "form",
    quoteExpiryMs: null,
    onRampLabel: "MXN → USDC",
    offRampLabel: "USDC → MXN",
  },
};

export const DEFAULT_PROVIDER: AnchorProvider = "etherfuse";
export const POLL_INTERVAL_MS = 5_000;
export const POLL_MAX_INTERVAL_MS = 30_000;
export const POLL_UNREACHABLE_AFTER = 3;
export const MAX_POLL_DURATION_MS = 5 * 60 * 1_000; // 5 minutes
export const RAMP_API_TIMEOUT_MS = 20_000;
export const CUSTOMER_ID_STORAGE_KEY = "neko_anchor_customer_ids";
export const BANK_ACCOUNT_ID_STORAGE_KEY = "neko_anchor_bank_account_ids";
export const ONBOARDING_URL_STORAGE_KEY = "neko_anchor_onboarding_urls";
