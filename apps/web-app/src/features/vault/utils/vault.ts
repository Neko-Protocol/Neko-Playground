import type { VaultAsset } from "../types/vault";

/**
 * Returns the correct icon src for a vault asset based on the card variant.
 * Light cards use the white/illustrated version; dark cards use the colored version.
 */
export function resolveAssetIcon(asset: VaultAsset, isLight: boolean): string {
  return isLight ? (asset.iconWhiteSrc ?? asset.iconSrc) : asset.iconSrc;
}
