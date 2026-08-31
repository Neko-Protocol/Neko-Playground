import {
  Contract,
  Address,
  rpc,
  scValToNative,
  TransactionBuilder,
  Horizon,
} from "@stellar/stellar-sdk";
import { getFaucetTokens } from "@/lib/constants/faucet";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { getSorobanServer } from "./sorobanServer";

export interface SorobanTokenBalance {
  contractId: string;
  symbol: string;
  decimals: number;
  balance: string;
}

async function getContractBalance(
  sorobanServer: rpc.Server,
  horizonServer: Horizon.Server,
  contractId: string,
  walletAddress: string,
  decimals: number,
  passphrase: string
): Promise<string> {
  const contract = new Contract(contractId);
  const operation = contract.call(
    "balance",
    new Address(walletAddress).toScVal()
  );

  let account;
  try {
    account = await horizonServer.loadAccount(walletAddress);
  } catch {
    return "0";
  }

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: passphrase,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  const simulated = await sorobanServer.simulateTransaction(tx);
  const result = simulated as { result?: { retval?: unknown } } | null;
  const retval = result?.result?.retval;
  if (!retval) return "0";

  const raw = scValToNative(retval as Parameters<typeof scValToNative>[0]);
  return fromSmallestUnit(BigInt(raw as string).toString(), decimals);
}

/**
 * Fetch balances for all faucet tokens by simulating balance() calls on each contract.
 */
export async function fetchSorobanTokenBalances(
  walletAddress: string,
  sorobanRpcUrl: string,
  stellarHorizonUrl: string,
  passphrase: string
): Promise<SorobanTokenBalance[]> {
  const tokens = getFaucetTokens();
  const sorobanServer = getSorobanServer(sorobanRpcUrl);
  const horizonServer = new Horizon.Server(stellarHorizonUrl);

  const results = await Promise.allSettled(
    tokens.map(async (t) => {
      const balance = await getContractBalance(
        sorobanServer,
        horizonServer,
        t.contractId,
        walletAddress,
        t.decimals,
        passphrase
      );
      return {
        contractId: t.contractId,
        symbol: t.symbol,
        decimals: t.decimals,
        balance,
      };
    })
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          contractId: tokens[i].contractId,
          symbol: tokens[i].symbol,
          decimals: tokens[i].decimals,
          balance: "0",
        }
  );
}
