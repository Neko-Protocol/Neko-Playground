import { getStellarWalletKit } from "./stellar-wallet-kit";
import { getCurrentNetworkPassphrase } from "./stellar-network";

export interface SignStellarTransactionParams {
  unsignedTransactionXdr: string;
  signerPublicKey: string;
}

export async function signStellarTransactionWithWallet({
  unsignedTransactionXdr,
  signerPublicKey,
}: SignStellarTransactionParams): Promise<string> {
  const stellarWalletKit = getStellarWalletKit();
  const networkPassphrase = getCurrentNetworkPassphrase();

  const { signedTxXdr } = await stellarWalletKit.signTransaction(
    unsignedTransactionXdr,
    {
      address: signerPublicKey,
      networkPassphrase,
    }
  );

  return signedTxXdr;
}
