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
    contract: "CCAYGJWQI5NJN7XRVNSENF47PICNSNTG4FAQHHFOJWZIRTEAC5JPMLGN",
    decimals: 7,
    amount: 100,
  },
  {
    symbol: "TESOURO",
    contract: "CAPFX3QEAHE7JVT6E7PYZQTFSVS5Z7AV4RE7GRJRVCPKXGQHCWSCOMTW",
    decimals: 7,
    amount: 100,
  },
  {
    symbol: "CETES",
    contract: "CAJ4B2ZWU2GA7UYQZ7N7QQCTZAUSSXNKKQ326ADYVH3ALN4FFQ6LPO4U",
    decimals: 7,
    amount: 100,
  },
  {
    symbol: "USDY",
    contract: "CDRQV3D3GLWF73MWTEQWFZWMBQ47KZ3KECYPOBKBDRQBWQQ74KDH5ECT",
    decimals: 7,
    amount: 100,
  },
  {
    symbol: "PYUSD",
    contract: "CBNHH37BJ2G4ZT6PLWDXPOWHKLR75IGNLBRCXZNOS7YPAYS53JPEPSSS",
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
