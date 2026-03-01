import * as Client from "@neko/oracle";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";

const oracleClient = new Client.Client({
  networkPassphrase: networkPassphrase,
  contractId: Client.networks.testnet.contractId,
  rpcUrl,
  publicKey: undefined,
  ...(allowHttpForSoroban && { allowHttp: true }),
});

export default oracleClient;
