import { getStellarWalletKit } from "./walletKit";

export interface SignStellarMessageParams {
  message: string;
  signerAddress: string;
}

/**
 * Signs an arbitrary message with the connected wallet — used for the event
 * platform's sign-in challenge (see lib/event-platform/auth/challenge.ts).
 * Mirrors signStellarTransactionWithWallet's shape, but for
 * `Kit.signMessage` instead of `Kit.signTransaction`.
 */
export async function signStellarMessageWithWallet({
  message,
  signerAddress,
}: SignStellarMessageParams): Promise<string> {
  const Kit = await getStellarWalletKit();
  const { signedMessage } = await Kit.signMessage(message, {
    address: signerAddress,
  });
  return signedMessage;
}
