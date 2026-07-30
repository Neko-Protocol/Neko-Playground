import { AUTH_DOMAIN } from "./constants";

export function buildAuthMessage(publicKey: string, nonce: string): string {
  return `${AUTH_DOMAIN} wants you to sign in with ${publicKey}\n\nNonce: ${nonce}`;
}
