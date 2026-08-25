/** Cookie used by middleware to gate /dashboard/admin (UX hint, not auth proof). */
export const WALLET_ADDRESS_COOKIE = "neko-stellar-address";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, aligned with zustand persist

export function setWalletAddressCookie(address: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${WALLET_ADDRESS_COOKIE}=${encodeURIComponent(address)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearWalletAddressCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${WALLET_ADDRESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getWalletAddressCookie(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${WALLET_ADDRESS_COOKIE}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}
