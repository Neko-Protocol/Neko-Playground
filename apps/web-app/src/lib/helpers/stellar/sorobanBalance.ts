import {
  Contract,
  Address,
  rpc,
  scValToNative,
  TransactionBuilder,
  Horizon,
} from "@stellar/stellar-sdk";
import { rpcUrl, networkPassphrase, horizonUrl } from "@/lib/constants/network";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";

export async function getTokenBalanceFromContract(
  contractAddress: string,
  walletAddress: string,
  decimals: number = 7
): Promise<string> {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, { allowHttp: true });
    const horizonServer = new Horizon.Server(horizonUrl);
    const contract = new Contract(contractAddress);

    const operation = contract.call(
      "balance",
      new Address(walletAddress).toScVal()
    );

    let account;
    try {
      account = await horizonServer.loadAccount(walletAddress);
    } catch (err) {
      console.warn(
        `[sorobanBalance] Account ${walletAddress} not found for balance query:`,
        err
      );
      return "0";
    }

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simulated = await sorobanServer.simulateTransaction(transaction);
    const simulatedResult = simulated as
      | { result?: { retval?: unknown } }
      | null
      | undefined;
    const retval = simulatedResult?.result?.retval;
    if (!retval) return "0";

    const balanceValue = scValToNative(
      retval as Parameters<typeof scValToNative>[0]
    );
    const balanceBigInt = BigInt(balanceValue as string);
    return fromSmallestUnit(balanceBigInt.toString(), decimals);
  } catch (err) {
    console.warn(
      `[sorobanBalance] Failed to fetch balance for contract ${contractAddress}:`,
      err
    );
    return "0";
  }
}
