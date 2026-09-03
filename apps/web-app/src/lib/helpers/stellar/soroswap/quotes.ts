import {
  rpc,
  Contract,
  Address,
  TransactionBuilder,
  Account,
  Keypair,
  scValToNative,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { rpcUrl, networkPassphrase } from "@/lib/constants/network";
import { clientEnv } from "@/lib/env.client";
import { getCurrentNetwork, getAvailableTokens } from "./tokens";
import { toSmallestUnit } from "@/lib/helpers/tokenUtils";
import {
  getApiKey,
  getSDKNetwork,
  getSoroswapSDK,
  makeAPIRequest,
  isValidContractAddress,
  formatTokenForAPI,
} from "./utils";
import type {
  QuoteRequest,
  QuoteResponse,
  BuildRequest,
  BuildResponse,
  SendRequest,
  SendResponse,
  AddLiquidityRequest,
  AddLiquidityResponse,
  RemoveLiquidityRequest,
  RemoveLiquidityResponse,
  UserPositionInfo,
  PoolInfo,
  GetPoolRequest,
} from "../../../types/soroswapTypes";
import { getSorobanServer } from "../sorobanServer";

const SOROSWAP_API_URL = "https://api.soroswap.finance";

/**
 * Pairs that the Soroswap API has rejected with "no path found".
 * Cached so subsequent quote refreshes skip the slow API call entirely.
 */
const apiRejectedPairs = new Set<string>();

/**
 * Returns true if a token address belongs to Soroswap's curated token list.
 * Only standard tokens (XLM, USDC) are known to Soroswap on testnet.
 */
function isSoroswapListed(address: string): boolean {
  const tokens = getAvailableTokens();
  const token = Object.values(tokens).find((t) => t.contract === address);
  if (!token) return false;
  return token.code === "XLM" || token.code === "USDC";
}

/**
 * Computes a swap quote from on-chain pair reserves using the Uniswap v2 AMM formula.
 * 1. Gets factory + router addresses from the SDK.
 * 2. Simulates `get_pair(tokenA, tokenB)` on the factory → pair contract address.
 * 3. Simulates `get_reserves()` on the pair → (reserveA, reserveB, timestamp).
 * 4. Soroswap sorts tokens by address (smaller = token_0 = reserveA).
 * 5. Applies the AMM formula: out = (in*997*reserveOut) / (reserveIn*1000 + in*997).
 */
const getDirectPoolQuote = async (
  assetIn: string,
  assetOut: string,
  amountInSmallestUnit: bigint,
  slippageBps: number
): Promise<QuoteResponse> => {
  const sdk = getSoroswapSDK();
  const sdkNet = getSDKNetwork();
  const [{ address: routerAddress }, { address: factoryAddress }] =
    await Promise.all([
      sdk.getContractAddress(sdkNet, "router"),
      sdk.getContractAddress(sdkNet, "factory"),
    ]);
  if (!routerAddress || !factoryAddress) {
    throw new Error("Soroswap router or factory not found for this network");
  }

  const server = getSorobanServer(rpcUrl);
  const dummyAccount = new Account(Keypair.random().publicKey(), "0");

  const factory = new Contract(factoryAddress);
  const getPairTx = new TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      factory.call(
        "get_pair",
        new Address(assetIn).toScVal(),
        new Address(assetOut).toScVal()
      )
    )
    .setTimeout(30)
    .build();

  const pairSim = await server.simulateTransaction(getPairTx);
  if (!("result" in pairSim) || !pairSim.result?.retval) {
    throw new Error("No liquidity pair exists for this token combination");
  }

  const pairAddress = scValToNative(pairSim.result.retval) as string;
  if (!pairAddress || typeof pairAddress !== "string") {
    throw new Error("No liquidity pair exists for this token combination");
  }

  const pair = new Contract(pairAddress);
  const reservesTx = new TransactionBuilder(
    new Account(Keypair.random().publicKey(), "0"),
    { fee: "100", networkPassphrase }
  )
    .addOperation(pair.call("get_reserves"))
    .setTimeout(30)
    .build();

  const reservesSim = await server.simulateTransaction(reservesTx);
  if (!("result" in reservesSim) || !reservesSim.result?.retval) {
    throw new Error("Failed to read pool reserves — simulation error");
  }

  const reservesRaw = scValToNative(reservesSim.result.retval) as bigint[];
  if (!Array.isArray(reservesRaw) || reservesRaw.length < 2) {
    throw new Error("Invalid reserves data from pool");
  }

  const reserveA = BigInt(reservesRaw[0].toString());
  const reserveB = BigInt(reservesRaw[1].toString());
  if (reserveA <= 0n || reserveB <= 0n) {
    throw new Error("Pool has insufficient reserves");
  }

  const isAin = assetIn < assetOut;
  const reserveIn = isAin ? reserveA : reserveB;
  const reserveOut = isAin ? reserveB : reserveA;

  const amountInWithFee = amountInSmallestUnit * 997n;
  const amountOut =
    (amountInWithFee * reserveOut) / (reserveIn * 1000n + amountInWithFee);

  if (amountOut <= BigInt(0)) {
    throw new Error("Swap would produce zero output — try a larger amount");
  }

  const threshold = (amountOut * BigInt(10000 - slippageBps)) / BigInt(10000);

  const priceImpactPct = "0";

  const sdkQuote = {
    assetIn,
    assetOut,
    amountIn: amountInSmallestUnit.toString(),
    amountOut: amountOut.toString(),
    otherAmountThreshold: threshold.toString(),
    priceImpactPct,
    tradeType: "EXACT_IN",
    platform: "soroswap",
    rawTrade: null,
    routerAddress,
    routePlan: [
      {
        swapInfo: { protocol: "soroswap", path: [assetIn, assetOut] },
        percent: "100",
      },
    ],
  };

  return {
    amountOut: amountOut.toString(),
    amountIn: amountInSmallestUnit.toString(),
    priceImpact: priceImpactPct,
    protocol: "soroswap",
    _sdkQuote: sdkQuote,
  };
};

function resolveApiNetwork(): string {
  const network = getCurrentNetwork();
  return network === "standalone" || network === "local" ? "testnet" : network;
}

function assertValidContractAddress(address: string, label: string): void {
  if (!isValidContractAddress(address)) {
    throw new Error(
      `Invalid contract address for ${label}: ${address}. Contract addresses must start with 'C' and be 56 characters long.`
    );
  }
}

export const getPool = async (request: GetPoolRequest): Promise<PoolInfo[]> => {
  const tokenA = formatTokenForAPI(request.tokenA);
  const tokenB = formatTokenForAPI(request.tokenB);

  assertValidContractAddress(tokenA, "tokenA");
  assertValidContractAddress(tokenB, "tokenB");

  const apiNetwork = resolveApiNetwork();

  const protocols = request.protocols || ["soroswap"];
  const protocolParam = protocols
    .map((p: string) => `protocol=${encodeURIComponent(p)}`)
    .join("&");
  const queryParams = `?network=${apiNetwork}&${protocolParam}`;
  const endpoint = `/pools/${tokenA}/${tokenB}${queryParams}`;

  try {
    const pools = await makeAPIRequest<PoolInfo[]>(endpoint, { method: "GET" });

    if (process.env.NODE_ENV === "development" && clientEnv.verboseLogging) {
      console.log("💧 Pool information received:", pools);
    }

    return pools;
  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message;

      if (
        errorMessage.includes("404") ||
        errorMessage.includes("Not Found") ||
        errorMessage.includes("429")
      ) {
        return [];
      }

      if (
        errorMessage.includes("API key") ||
        errorMessage.includes("401") ||
        errorMessage.includes("403")
      ) {
        throw new Error(
          "Soroswap API key is invalid or expired. Please check your API key configuration at https://api.soroswap.finance/login"
        );
      }

      throw error;
    }

    throw error;
  }
};

export const getQuote = async (
  request: QuoteRequest
): Promise<QuoteResponse | undefined> => {
  const assetIn = formatTokenForAPI(request.assetIn);
  const assetOut = formatTokenForAPI(request.assetOut);

  if (!isValidContractAddress(assetIn)) {
    throw new Error(
      `Invalid contract address for assetIn: ${assetIn}. Contract addresses must start with 'C' and be 56 characters long.`
    );
  }
  if (!isValidContractAddress(assetOut)) {
    throw new Error(
      `Invalid contract address for assetOut: ${assetOut}. Contract addresses must start with 'C' and be 56 characters long.`
    );
  }

  const amountInSmallestUnit = toSmallestUnit(request.amount, 7);

  if (amountInSmallestUnit <= BigInt(0)) {
    throw new Error(
      `Invalid amount: ${request.amount}. Amount must be greater than 0.`
    );
  }

  const sdkNetwork = getSDKNetwork();

  const tradeType = request.tradeType || "EXACT_IN";

  const protocols = request.protocols?.length
    ? request.protocols
    : ["soroswap"];

  const pairKey = `${assetIn}-${assetOut}`;

  // Always use on-chain simulation directly — the Soroswap REST API rejects
  // all our token contracts (including USDC/XLM) with 400 "no path found".
  return getDirectPoolQuote(
    assetIn,
    assetOut,
    amountInSmallestUnit,
    request.slippageBps ?? 500
  );

  // Dead code kept for reference — the REST API path below is bypassed.
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("Soroswap API key not configured");
    }

    if (apiRejectedPairs.has(pairKey)) {
      return getDirectPoolQuote(
        assetIn,
        assetOut,
        amountInSmallestUnit,
        request.slippageBps ?? 500
      );
    }

    const quoteRequestBody = {
      assetIn,
      assetOut,
      amount: amountInSmallestUnit.toString(),
      tradeType,
      protocols,
      slippageBps: request.slippageBps || 500,
      maxHops: request.maxHops || 3,
    };

    const apiResponse = await fetch(
      `${SOROSWAP_API_URL}/quote?network=${sdkNetwork}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(quoteRequestBody),
      }
    );

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({}));
      const detail: string = errorData.detail || errorData.title || "";
      const detailLower = detail.toLowerCase();

      if (
        detailLower.includes("no path") ||
        detailLower.includes("path not found")
      ) {
        apiRejectedPairs.add(pairKey);
        return getDirectPoolQuote(
          assetIn,
          assetOut,
          amountInSmallestUnit,
          request.slippageBps ?? 500
        );
      }

      throw new Error(
        `API request failed: ${apiResponse.status} ${apiResponse.statusText}. ${JSON.stringify(errorData)}`
      );
    }

    const quoteResponse = (await apiResponse.json()) as {
      assetIn: string;
      assetOut: string;
      amountIn: string;
      amountOut: string;
      otherAmountThreshold: string;
      priceImpactPct: string;
      tradeType: string;
      platform: string;
      rawTrade: unknown;
      routes?: unknown[];
      routePlan: Array<{
        swapInfo: { protocol: string; path: string[] };
        percent: string;
      }>;
    };

    const response: QuoteResponse = {
      amountOut: quoteResponse.amountOut.toString(),
      amountIn: quoteResponse.amountIn.toString(),
      priceImpact: quoteResponse.priceImpactPct?.toString() || "0",
      protocol: quoteResponse.platform || "soroswap",
      _sdkQuote: quoteResponse,
    };

    if ("routes" in quoteResponse && quoteResponse.routes) {
      response.routes = quoteResponse.routes as unknown[];
    }

    return response;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? (error as Error).message : String(error);
    const errorStr = errorMessage.toLowerCase();

    if (errorStr.includes("no path") || errorStr.includes("no liquidity")) {
      const availableTokens = getAvailableTokens();
      const getTokenCode = (address: string) => {
        for (const [code, info] of Object.entries(availableTokens)) {
          if (info.contract === address) return code;
        }
        return address.substring(0, 8) + "...";
      };
      throw new Error(
        `No liquidity available for ${getTokenCode(assetIn)} → ${getTokenCode(assetOut)}. Please try a different pair or check back later.`
      );
    }

    if (
      errorStr.includes("api key") ||
      errorStr.includes("401") ||
      errorStr.includes("403")
    ) {
      throw new Error(
        "Soroswap API key is invalid or expired. Please check your API key configuration."
      );
    }

    throw new Error(`Quote fetch failed: ${errorMessage}`);
  }
};

export const buildTransaction = async (
  request: BuildRequest
): Promise<BuildResponse> => {
  const soroswapSDK = getSoroswapSDK();
  const sdkNetwork = getSDKNetwork();

  try {
    const sdkQuote = request.quote._sdkQuote as
      Record<string, unknown> | null | undefined;

    if (!sdkQuote) {
      throw new Error("No SDK quote found. Please get a new quote first.");
    }

    // Direct pool quotes (rawTrade: null) build the swap transaction against the
    // Soroswap Router contract directly, bypassing the /quote/build REST API.
    if (sdkQuote.rawTrade === null) {
      const routerAddress = sdkQuote.routerAddress as string | undefined;
      const assetIn = sdkQuote.assetIn as string;
      const assetOut = sdkQuote.assetOut as string;
      const amountIn = BigInt(sdkQuote.amountIn as string);
      const amountOutMin = BigInt(sdkQuote.otherAmountThreshold as string);
      const recipient = request.to ?? request.from;

      if (!routerAddress) {
        throw new Error(
          "Router address not found in quote. Please get a new quote."
        );
      }

      const server = getSorobanServer(rpcUrl);
      const account = await server.getAccount(request.from);
      const router = new Contract(routerAddress);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase,
      })
        .addOperation(
          router.call(
            "swap_exact_tokens_for_tokens",
            nativeToScVal(amountIn, { type: "i128" }),
            nativeToScVal(amountOutMin, { type: "i128" }),
            xdr.ScVal.scvVec([
              new Address(assetIn).toScVal(),
              new Address(assetOut).toScVal(),
            ]),
            new Address(recipient).toScVal(),
            nativeToScVal(deadline, { type: "u64" })
          )
        )
        .setTimeout(30)
        .build();

      const simResult = await server.simulateTransaction(tx);
      if (!("result" in simResult)) {
        const errMsg =
          "error" in simResult ? simResult.error : "Swap simulation failed";
        throw new Error(errMsg as string);
      }

      const preparedTx = rpc.assembleTransaction(tx, simResult).build();
      return { xdr: preparedTx.toXDR() };
    }

    const buildResponse = await soroswapSDK.build(
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sdkQuote is intentionally untyped (see comment above); reconciling it with the SDK's own QuoteResponse shape needs deeper verification than a quick retype
        quote: sdkQuote as any,
        from: request.from,
      },
      sdkNetwork
    );

    return { xdr: buildResponse.xdr };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to build transaction: ${error.message}`);
    }
    throw error;
  }
};

export const sendTransaction = async (
  request: SendRequest
): Promise<SendResponse> => {
  const soroswapSDK = getSoroswapSDK();
  const sdkNetwork = getSDKNetwork();

  try {
    const sendResponse = await soroswapSDK.send(
      request.xdr,
      request.launchtube || false,
      sdkNetwork
    );

    const sendResponseTyped = sendResponse as
      | { hash?: string; txHash?: string; transactionHash?: string }
      | null
      | undefined;
    const txHash =
      sendResponseTyped?.hash ||
      sendResponseTyped?.txHash ||
      sendResponseTyped?.transactionHash;

    if (!txHash) {
      throw new Error("Transaction hash not found in SDK response");
    }

    return { txHash };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to send transaction: ${error.message}`);
    }
    throw error;
  }
};

export const addLiquidity = async (
  request: AddLiquidityRequest
): Promise<AddLiquidityResponse> => {
  const assetA = formatTokenForAPI(request.assetA);
  const assetB = formatTokenForAPI(request.assetB);

  assertValidContractAddress(assetA, "assetA");
  assertValidContractAddress(assetB, "assetB");

  const amountA = toSmallestUnit(request.amountA, 7);
  const amountB = toSmallestUnit(request.amountB, 7);

  if (amountA <= BigInt(0)) {
    throw new Error(
      `Invalid amountA: ${request.amountA}. Amount must be greater than 0.`
    );
  }
  if (amountB <= BigInt(0)) {
    throw new Error(
      `Invalid amountB: ${request.amountB}. Amount must be greater than 0.`
    );
  }

  const apiNetwork = resolveApiNetwork();

  const queryParams = new URLSearchParams({
    network: apiNetwork,
    protocol: "soroswap",
  });
  const endpoint = `/pools/${assetA}/${assetB}?${queryParams.toString()}`;

  const requestBody = {
    amountA: amountA.toString(),
    amountB: amountB.toString(),
    to: request.to,
    slippageBps: request.slippageBps || 500,
  };

  try {
    const addLiquidityResponse = await makeAPIRequest<{ xdr: string }>(
      endpoint,
      {
        method: "POST",
        body: JSON.stringify(requestBody),
      }
    );

    if (!addLiquidityResponse.xdr) {
      throw new Error("No XDR returned from add liquidity API");
    }

    return { xdr: addLiquidityResponse.xdr };
  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message;

      if (errorMessage.includes("No liquidity pool found")) {
        throw error;
      }

      if (
        errorMessage.includes("No path found") ||
        errorMessage.includes("No path") ||
        errorMessage.includes("404")
      ) {
        throw new Error(
          "No liquidity pool found for this token pair. This could mean:\n" +
            "• The pool doesn't exist yet and needs to be created first\n" +
            "• The token addresses may not be correct for this network\n" +
            "• Try creating the pool first or verify pools exist at https://app.soroswap.finance"
        );
      }

      if (
        errorMessage.includes("API key") ||
        errorMessage.includes("401") ||
        errorMessage.includes("403")
      ) {
        throw new Error(
          "Soroswap API key is invalid or expired. Please check your API key configuration at https://api.soroswap.finance/login"
        );
      }

      if (
        errorMessage.includes("400") ||
        errorMessage.includes("Bad Request")
      ) {
        throw new Error(
          `Invalid request to Soroswap API (400): ${errorMessage}`
        );
      }

      throw error;
    }

    throw error;
  }
};

export const removeLiquidity = async (
  request: RemoveLiquidityRequest
): Promise<RemoveLiquidityResponse> => {
  const assetA = formatTokenForAPI(request.assetA);
  const assetB = formatTokenForAPI(request.assetB);

  assertValidContractAddress(assetA, "assetA");
  assertValidContractAddress(assetB, "assetB");

  const apiNetwork = resolveApiNetwork();

  const endpoint = `/liquidity/remove?${new URLSearchParams({ network: apiNetwork }).toString()}`;

  const requestBody = {
    assetA,
    assetB,
    liquidity: request.liquidity,
    amountA: request.amountA,
    amountB: request.amountB,
    to: request.to,
    slippageBps: request.slippageBps ?? 500,
  };

  try {
    const response = await makeAPIRequest<{ xdr: string }>(endpoint, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    if (!response.xdr) {
      throw new Error("No XDR returned from remove liquidity API");
    }

    return { xdr: response.xdr };
  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message;

      if (
        errorMessage.includes("API key") ||
        errorMessage.includes("401") ||
        errorMessage.includes("403")
      ) {
        throw new Error(
          "Soroswap API key is invalid or expired. Please check your API key configuration at https://api.soroswap.finance/login"
        );
      }

      if (
        errorMessage.includes("400") ||
        errorMessage.includes("Bad Request")
      ) {
        throw new Error(
          `Invalid request to Soroswap API (400): ${errorMessage}`
        );
      }

      throw error;
    }

    throw error;
  }
};

export const getUserPositions = async (
  userAddress: string
): Promise<UserPositionInfo[]> => {
  const apiNetwork = resolveApiNetwork();

  const endpoint = `/liquidity/positions/${userAddress}?${new URLSearchParams({ network: apiNetwork }).toString()}`;

  try {
    return await makeAPIRequest<UserPositionInfo[]>(endpoint, {
      method: "GET",
    });
  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message;

      if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
        return [];
      }

      if (
        errorMessage.includes("API key") ||
        errorMessage.includes("401") ||
        errorMessage.includes("403")
      ) {
        throw new Error(
          "Soroswap API key is invalid or expired. Please check your API key configuration at https://api.soroswap.finance/login"
        );
      }

      throw error;
    }

    throw error;
  }
};
