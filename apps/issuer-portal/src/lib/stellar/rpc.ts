import { rpc } from "@stellar/stellar-sdk";
import { RPC_URL } from "@/lib/constants";

export const sorobanServer = new rpc.Server(RPC_URL, { allowHttp: true });
