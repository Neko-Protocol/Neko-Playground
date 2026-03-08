import { addToken } from "@stellar/freighter-api";
import { getFaucetTokens } from "@/lib/constants/faucet";

/**
 * Adds all faucet tokens to Freighter so the user can see and use them.
 * Each token triggers a Freighter popup for the user to confirm.
 * Call after a successful mint so the user can use the tokens from the wallet.
 */
export async function addFaucetTokensToFreighter(
  networkPassphrase: string
): Promise<void> {
  const tokens = getFaucetTokens();
  for (const t of tokens) {
    await addToken({
      contractId: t.contractId,
      networkPassphrase,
    });
  }
}
