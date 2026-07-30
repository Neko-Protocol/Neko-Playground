import * as Client from "@neko/oracle";
import { getContracts } from "@/lib/constants/contractsByNetwork";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";

const oracleClient = new Client.Client({
  networkPassphrase: networkPassphrase,
  contractId: getContracts().oracle,
  rpcUrl,
  publicKey: undefined,
  ...(allowHttpForSoroban && { allowHttp: true }),
});

export default oracleClient;
