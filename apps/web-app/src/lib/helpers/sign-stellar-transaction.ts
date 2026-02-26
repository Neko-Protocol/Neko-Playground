/**
 * Firma una transacción de Stellar usando la wallet conectada (Kit).
 * Recibe el XDR sin firmar y la clave pública del firmante; usa la red actual de la app.
 */

import { getStellarWalletKit } from "./stellar-wallet-kit";
import { getCurrentNetworkPassphrase } from "./stellar-network";

export interface SignStellarTransactionParams {
  /** Transacción en XDR (base64) sin firmar. */
  unsignedTransactionXdr: string;
  /** Clave pública de la cuenta que debe firmar (la wallet conectada). */
  signerPublicKey: string;
}

/**
 * Pide a la wallet del usuario que firme la transacción.
 * Devuelve el XDR firmado listo para enviar a la red.
 */
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
