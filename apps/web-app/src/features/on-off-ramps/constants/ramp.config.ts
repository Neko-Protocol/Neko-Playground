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
/**
 * Bump this whenever the on-disk shape of the three anchor storage keys
 * changes.  Old unscoped entries (v0 — keyed by provider only) are
 * intentionally NOT migrated: silently adopting an unscoped entry into the
 * currently-connected wallet would be exactly the bug we are fixing.  Users
 * who had a cached identity under the old key will simply re-run
 * ensureCustomer once — the anchor will find their existing customer by
 * email and return the same IDs, so KYC is not lost, only re-fetched.
 */
export const ANCHOR_STORAGE_VERSION = 1;

/**
 * Storage keys now encode version + wallet address so each Stellar public key
 * gets its own isolated slot.  Format:
 *   neko_anchor_<field>_v<version>_<walletAddress>
 *
 * The legacy (v0) keys — "neko_anchor_customer_ids" etc. — are abandoned in
 * place; browsers will evict them eventually.  We never read from them.
 */
export const CUSTOMER_ID_STORAGE_KEY = "neko_anchor_customer_ids";
export const BANK_ACCOUNT_ID_STORAGE_KEY = "neko_anchor_bank_account_ids";
export const ONBOARDING_URL_STORAGE_KEY = "neko_anchor_onboarding_urls";

/** Build the versioned, wallet-scoped storage key for a given base key. */
export function anchorStorageKey(
  baseKey: string,
  walletAddress: string
): string {
  return `${baseKey}_v${ANCHOR_STORAGE_VERSION}_${walletAddress}`;
}

/**
 * Remove all versioned anchor storage entries for the given wallet address.
 * Called on disconnect and on wallet switch to prevent cross-wallet bleed.
 */
export function clearAnchorState(walletAddress: string): void {
  if (typeof window === "undefined") return;
  try {
    for (const baseKey of [
      CUSTOMER_ID_STORAGE_KEY,
      BANK_ACCOUNT_ID_STORAGE_KEY,
      ONBOARDING_URL_STORAGE_KEY,
    ]) {
      localStorage.removeItem(anchorStorageKey(baseKey, walletAddress));
    }
  } catch {
    // ignore — storage may be unavailable in SSR or restricted contexts
  }
}
