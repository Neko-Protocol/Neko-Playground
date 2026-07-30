import {
  xdr,
  Address,
  nativeToScVal,
  Contract,
  TransactionBuilder,
  rpc,
  Horizon,
} from "@stellar/stellar-sdk";
import { clientEnv } from "@/lib/env.client";
import { getAssetsConfig } from "@/lib/constants/assets.config";
import { stellarNetwork } from "@/lib/constants/network";
export interface FaucetToken {
  symbol: string;
  contractId: string;
  decimals: number;
  mintAmount: bigint;
}

const FAUCET_RWA_CODES = [
  "USTRY",
  "TESOURO",
  "CETES",
  "USDY",
  "PYUSD",
  "KTB",
] as const;

const FAUCET_MINT_AMOUNT = 100;

export const FAUCET_CONTRACT_ID = clientEnv.faucetContractId;

export const FAUCET_COOLDOWN_MS = 5 * 60 * 1000;

export function getFaucetTokens(): FaucetToken[] {
  if (stellarNetwork !== "TESTNET") {
    return [];
  }

  const assets = getAssetsConfig();
  return FAUCET_RWA_CODES
    .filter((code) => assets[code])
    .map((code) => {
      const asset = assets[code];
      return {
        symbol: code,
        contractId: asset.contract,
        decimals: asset.decimals,
        mintAmount:
          BigInt(FAUCET_MINT_AMOUNT) * 10n ** BigInt(asset.decimals),
      };
    });
}

/**
 * Build a single MintRequest as ScVal (Soroban struct encoded as a map).
 * Fields are alphabetically ordered: amount, to, token.
 */
function mintRequestToScVal(
  tokenContractId: string,
  toAddress: string,
  amount: bigint
): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("amount"),
      val: nativeToScVal(amount, { type: "i128" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("to"),
      val: new Address(toAddress).toScVal(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("token"),
      val: new Address(tokenContractId).toScVal(),
    }),
  ]);
}

/**
 * Build the full Vec<MintRequest> ScVal for the bulk_mint contract call.
 * Encodes all configured faucet tokens as MintRequest structs targeting `toAddress`.
 */
export function buildMintRequestsScVal(toAddress: string): xdr.ScVal {
  const tokens = getFaucetTokens();
  const entries = tokens.map((t) =>
    mintRequestToScVal(t.contractId, toAddress, t.mintAmount)
  );
  return xdr.ScVal.scvVec(entries);
}

/**
 * Build a prepared faucet bulk_mint transaction XDR ready for wallet signing.
 * Uses the Blend pattern: build → prepareTransaction → return XDR for Freighter.
 */
export async function buildFaucetTransaction(
  userAddress: string,
  sorobanRpcUrl: string,
  stellarHorizonUrl: string,
  passphrase: string
): Promise<string> {
  if (!FAUCET_CONTRACT_ID) {
    throw new Error("NEXT_PUBLIC_FAUCET_CONTRACT_ID is not configured");
  }

  const faucetContract = new Contract(FAUCET_CONTRACT_ID);
  const requestsScVal = buildMintRequestsScVal(userAddress);
  const operation = faucetContract.call("bulk_mint", requestsScVal);

  const horizonServer = new Horizon.Server(stellarHorizonUrl);
  const account = await horizonServer.loadAccount(userAddress);

  const tx = new TransactionBuilder(account, {
    fee: "10000000",
    networkPassphrase: passphrase,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  const sorobanServer = new rpc.Server(sorobanRpcUrl, { allowHttp: true });
  const prepared = await sorobanServer.prepareTransaction(tx);

  return prepared.toXDR();
}
