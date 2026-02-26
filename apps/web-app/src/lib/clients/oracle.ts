import * as Client from "@neko/oracle";
import { rpcUrl, networkPassphrase } from "@/lib/constants/network";

export default new Client.Client({
  networkPassphrase: networkPassphrase,
  contractId: Client.networks.testnet.contractId,
  rpcUrl,
  publicKey: undefined,
});
