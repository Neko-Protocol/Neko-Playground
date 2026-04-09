import { getStellarWalletKit } from "./walletKit";
import { getCurrentNetworkPassphrase } from "../network";

export interface SignStellarTransactionParams {
  unsignedTransactionXdr: string;
  signerPublicKey: string;
}

export async function signStellarTransactionWithWallet({
  unsignedTransactionXdr,
  signerPublicKey,
}: SignStellarTransactionParams): Promise<string> {
  const Kit = await getStellarWalletKit();
  const networkPassphrase = getCurrentNetworkPassphrase();

  const { signedTxXdr } = await Kit.signTransaction(unsignedTransactionXdr, {
    address: signerPublicKey,
    networkPassphrase,
  });

  return signedTxXdr;
}
