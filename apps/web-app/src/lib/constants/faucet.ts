import {
  xdr,
  Address,
  nativeToScVal,
  Contract,
  TransactionBuilder,
  rpc,
  Horizon,
} from "@stellar/stellar-sdk";
export interface FaucetToken {
  symbol: string;
  contractId: string;
  decimals: number;
  mintAmount: bigint;
}

const TESTNET_FAUCET_TOKENS: {
  symbol: string;
  contract: string;
  decimals: number;
  amount: number;
}[] = [
  {
    symbol: "USTRY",
    contract: "CC6SODKGOTFEDWVNPR6ESJC3GL7NC5Y4DVFKYGATZJ74F2YXHTW4RJ6D",
    decimals: 7,
    amount: 100,
  },
  {
    symbol: "TESOURO",
    contract: "CA55OO3U556GXABJKDYP3QCGZ6AFNZPB27TROYP42AQPFFYPKU5EDOUH",
    decimals: 7,
    amount: 100,
  },
  {
    symbol: "CETES",
    contract: "CCGWKS4GLAGPYIAOLBH6JM5RKUPMUCN47VRAEXAJWJFKXSXQ33VIRUAA",
    decimals: 7,
    amount: 100,
  },
  {
    symbol: "USDY",
    contract: "CBVLFSVBZGHVAH6CV4JQYPBJSX75VFR2NJC7CQX7QKQ7KOLGQZOZAGQK",
    decimals: 7,
    amount: 100,
  },
  {
    symbol: "PYUSD",
    contract: "CBCB5UDYZENTIUVVA7SHQOCVVCDXDMHEKJHHFM3OQKU2E5CAF2B62TIO",
    decimals: 7,
    amount: 100,
  },
];

export const FAUCET_CONTRACT_ID =
  process.env.NEXT_PUBLIC_FAUCET_CONTRACT_ID ?? "";

export const FAUCET_COOLDOWN_MS = 5 * 60 * 1000;

export function getFaucetTokens(): FaucetToken[] {
  return TESTNET_FAUCET_TOKENS.map((t) => ({
    symbol: t.symbol,
    contractId: t.contract,
    decimals: t.decimals,
    mintAmount: BigInt(t.amount) * 10n ** BigInt(t.decimals),
  }));
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
