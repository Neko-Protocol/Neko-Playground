import type { Anchor, AnchorProvider } from "./types";
import { AnchorError } from "./types";
import { EtherfuseClient } from "./etherfuse";
import { AlfredPayClient } from "./alfredpay";

export * from "./types";
export { EtherfuseClient } from "./etherfuse";
export { AlfredPayClient } from "./alfredpay";

const anchorInstances = new Map<AnchorProvider, Anchor>();

/**
 * Get an anchor client instance by provider name.
 * Reads credentials from process.env (server-side only).
 */
export function getAnchorClient(provider: AnchorProvider): Anchor {
  let anchor = anchorInstances.get(provider);

  if (!anchor) {
    switch (provider) {
      case "etherfuse": {
        const apiKey = process.env.ETHERFUSE_API_KEY;
        const baseUrl = process.env.ETHERFUSE_BASE_URL;
        if (!apiKey || !baseUrl) {
          throw new AnchorError(
            "Etherfuse is not configured (missing ETHERFUSE_API_KEY or ETHERFUSE_BASE_URL)",
            "MISSING_CONFIG",
            503
          );
        }
        anchor = new EtherfuseClient({ apiKey, baseUrl });
        break;
      }
      case "alfredpay": {
        const apiKey = process.env.ALFREDPAY_API_KEY;
        const apiSecret = process.env.ALFREDPAY_API_SECRET;
        const baseUrl = process.env.ALFREDPAY_BASE_URL;
        if (!apiKey || !apiSecret || !baseUrl) {
          throw new AnchorError(
            "Alfred Pay is not configured (missing ALFREDPAY_API_KEY, ALFREDPAY_API_SECRET, or ALFREDPAY_BASE_URL)",
            "MISSING_CONFIG",
            503
          );
        }
        anchor = new AlfredPayClient({ apiKey, apiSecret, baseUrl });
        break;
      }
      default:
        throw new AnchorError(
          `Unknown anchor provider: ${provider}`,
          "UNKNOWN_PROVIDER",
          400
        );
    }
    anchorInstances.set(provider, anchor);
  }

  return anchor;
}

export function isValidProvider(provider: string): provider is AnchorProvider {
  return ["etherfuse", "alfredpay"].includes(provider);
}
