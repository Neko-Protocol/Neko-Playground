import { TradeType, SupportedProtocols } from "@soroswap/sdk";
import { getCurrentNetwork, getAvailableTokens } from "./tokens";
import {
  getApiKey,
  getSDKNetwork,
  getSoroswapSDK,
  makeAPIRequest,
  toSmallestUnit,
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
  PoolInfo,
  GetPoolRequest,
} from "../../../types/soroswapTypes";

const SOROSWAP_API_URL = "https://api.soroswap.finance";

export const getPool = async (request: GetPoolRequest): Promise<PoolInfo[]> => {
  const tokenA = formatTokenForAPI(request.tokenA);
  const tokenB = formatTokenForAPI(request.tokenB);

  if (!isValidContractAddress(tokenA)) {
    throw new Error(
      `Invalid contract address for tokenA: ${tokenA}. Contract addresses must start with 'C' and be 56 characters long.`
    );
  }
  if (!isValidContractAddress(tokenB)) {
    throw new Error(
      `Invalid contract address for tokenB: ${tokenB}. Contract addresses must start with 'C' and be 56 characters long.`
    );
  }

  const network = getCurrentNetwork();
  const apiNetwork =
    network === "standalone" || network === "local" ? "testnet" : network;

  const protocols = request.protocols || ["soroswap"];
  const protocolParam = protocols
    .map((p: string) => `protocol=${encodeURIComponent(p)}`)
    .join("&");
  const queryParams = `?network=${apiNetwork}&${protocolParam}`;
  const endpoint = `/pools/${tokenA}/${tokenB}${queryParams}`;

  if (process.env.NODE_ENV === "development") {
    console.log("Soroswap Get Pool Request:", {
      tokenA,
      tokenB,
      network: apiNetwork,
      protocols,
      endpoint,
    });
  }

  try {
    const pools = await makeAPIRequest<PoolInfo[]>(endpoint, { method: "GET" });

    if (
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_VERBOSE_LOGGING === "true"
    ) {
      console.log("💧 Pool information received:", pools);
    }

    return pools;
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

  const tradeType =
    request.tradeType === "EXACT_IN" ? TradeType.EXACT_IN : TradeType.EXACT_OUT;

  const protocols = request.protocols?.length
    ? (request.protocols as unknown[]).map((proto) => {
        if (typeof proto === "string") {
          const protoLower = proto.toLowerCase();
          if (protoLower === "soroswap") return SupportedProtocols.SOROSWAP;
          if (protoLower === "phoenix") return SupportedProtocols.PHOENIX;
          if (protoLower === "aqua") return SupportedProtocols.AQUA;
          return SupportedProtocols.SOROSWAP;
        }
        return proto as SupportedProtocols;
      })
    : [SupportedProtocols.SOROSWAP];

  if (process.env.NODE_ENV === "development") {
    console.log("Soroswap Quote Request Details:", {
      assetIn,
      assetOut,
      amount: request.amount,
      amountInSmallestUnit: amountInSmallestUnit.toString(),
      amountType: typeof amountInSmallestUnit,
      tradeType: request.tradeType,
      tradeTypeEnum: tradeType,
      protocols: request.protocols,
      protocolsEnum: protocols,
      slippageBps: request.slippageBps,
      sdkNetwork,
    });
  }

  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_VERBOSE_LOGGING === "true"
  ) {
    console.log("Soroswap SDK Quote Request:", {
      assetIn,
      assetOut,
      amount: amountInSmallestUnit.toString(),
      tradeType,
      protocols,
      network: sdkNetwork,
    });
  }

  try {
    if (!assetIn || typeof assetIn !== "string" || assetIn.trim() === "") {
      throw new Error(`Invalid assetIn: ${assetIn}`);
    }
    if (!assetOut || typeof assetOut !== "string" || assetOut.trim() === "") {
      throw new Error(`Invalid assetOut: ${assetOut}`);
    }
    if (!amountInSmallestUnit || amountInSmallestUnit <= BigInt(0)) {
      throw new Error(`Invalid amount: ${amountInSmallestUnit}`);
    }

    if (!isValidContractAddress(assetIn)) {
      throw new Error(
        `Invalid Stellar contract address format for assetIn: ${assetIn}`
      );
    }
    if (!isValidContractAddress(assetOut)) {
      throw new Error(
        `Invalid Stellar contract address format for assetOut: ${assetOut}`
      );
    }

    const availableTokens = getAvailableTokens();
    const tokenInExists = Object.values(availableTokens).some(
      (token) => token.contract === assetIn
    );
    const tokenOutExists = Object.values(availableTokens).some(
      (token) => token.contract === assetOut
    );

    if (!tokenInExists) {
      console.warn(`assetIn contract ${assetIn} not found in available tokens`);
    }
    if (!tokenOutExists) {
      console.warn(
        `assetOut contract ${assetOut} not found in available tokens`
      );
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("Soroswap API key not configured");
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

    if (process.env.NODE_ENV === "development") {
      console.log("Soroswap API Request Body:", quoteRequestBody);
    }

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

    if (
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_VERBOSE_LOGGING === "true"
    ) {
      console.log("💡 Quote received:");
      console.log(
        `   Input: ${Number(quoteResponse.amountIn) / 10000000} tokens`
      );
      console.log(
        `   Output: ${Number(quoteResponse.amountOut) / 10000000} tokens`
      );
      console.log(`   Price Impact: ${quoteResponse.priceImpactPct}%`);
      console.log(`   Platform: ${quoteResponse.platform}`);
    }

    return response;
  } catch (error) {
    let errorMessage = "Unknown error occurred during quote fetch";

    if (process.env.NODE_ENV === "development") {
      console.error("Soroswap Quote Error (raw):", error);
      try {
        console.error("Error stringified:", JSON.stringify(error, null, 2));
      } catch {
        console.error("Could not stringify error");
      }
    }

    try {
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        const sdkError = error as Record<string, unknown>;

        if (sdkError.message && typeof sdkError.message === "string") {
          errorMessage = sdkError.message;
        } else if (sdkError.title && typeof sdkError.title === "string") {
          errorMessage = sdkError.title;
        } else if (sdkError.detail && typeof sdkError.detail === "string") {
          errorMessage = sdkError.detail;
        } else if (sdkError.error && typeof sdkError.error === "string") {
          errorMessage = sdkError.error;
        } else if (Array.isArray(sdkError.errors)) {
          errorMessage = (sdkError.errors as string[]).join(", ");
        }

        if (process.env.NODE_ENV === "development") {
          console.error("Soroswap API Error Details:", {
            message: sdkError.message,
            error: sdkError.error,
            detail: sdkError.detail,
            statusCode: sdkError.statusCode,
            errors: sdkError.errors,
          });
        }
      }
    } catch {}

    const errorStr = errorMessage.toLowerCase();

    if (errorStr.includes("no path") || errorStr.includes("no liquidity")) {
      try {
        const availableTokens = getAvailableTokens();
        const getTokenInfo = (address: string) => {
          for (const [code, info] of Object.entries(availableTokens)) {
            if (info.contract === address) {
              return code;
            }
          }
          return address.substring(0, 8) + "...";
        };

        const tokenInCode = getTokenInfo(assetIn);
        const tokenOutCode = getTokenInfo(assetOut);

        throw new Error(
          `No liquidity available for ${tokenInCode} → ${tokenOutCode}. Please try a different pair or check back later.`
        );
      } catch {
        throw new Error(
          "No liquidity available for this trading pair. Please try a different pair."
        );
      }
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

    if (errorStr.includes("400") || errorStr.includes("bad request")) {
      throw new Error(
        "Invalid request to Soroswap API. Please check token addresses and amounts."
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
    const sdkQuote = request.quote._sdkQuote;

    if (!sdkQuote) {
      throw new Error("No SDK quote found. Please get a new quote first.");
    }

    const buildResponse = await soroswapSDK.build(
      {
        quote: sdkQuote as any,
        from: request.from,
      },
      sdkNetwork
    );

    if (
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_VERBOSE_LOGGING === "true"
    ) {
      console.log("📄 Transaction XDR received from Soroswap SDK");
    }

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

    if (
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_VERBOSE_LOGGING === "true"
    ) {
      console.log(`✅ Transaction sent! Hash: ${txHash}`);
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

  if (!isValidContractAddress(assetA)) {
    throw new Error(
      `Invalid contract address for assetA: ${assetA}. Contract addresses must start with 'C' and be 56 characters long.`
    );
  }
  if (!isValidContractAddress(assetB)) {
    throw new Error(
      `Invalid contract address for assetB: ${assetB}. Contract addresses must start with 'C' and be 56 characters long.`
    );
  }

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

  const network = getCurrentNetwork();
  const apiNetwork =
    network === "standalone" || network === "local" ? "testnet" : network;

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

  if (process.env.NODE_ENV === "development") {
    console.log("Soroswap Add Liquidity Request Details:", {
      assetA,
      assetB,
      amountA: request.amountA,
      amountB: request.amountB,
      amountAInSmallestUnit: amountA.toString(),
      amountBInSmallestUnit: amountB.toString(),
      to: request.to,
      slippageBps: request.slippageBps,
      network: apiNetwork,
      endpoint,
      requestBody,
    });
  }

  try {
    const addLiquidityResponse = await makeAPIRequest<{ xdr: string }>(
      endpoint,
      {
        method: "POST",
        body: JSON.stringify(requestBody),
      }
    );

    if (
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_VERBOSE_LOGGING === "true"
    ) {
      console.log("📄 Liquidity transaction XDR received from Soroswap API");
    }

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
        const errorWithResponse = error as
          | { response?: { data?: unknown } }
          | null
          | undefined;
        const errorDetails =
          "response" in error && errorWithResponse?.response?.data
            ? JSON.stringify(errorWithResponse.response.data)
            : errorMessage;
        throw new Error(
          `Invalid request to Soroswap API (400): ${errorDetails}\n` +
            `Please check:\n` +
            `• Token contract addresses are correct for ${apiNetwork}\n` +
            `• Amount format is valid\n` +
            `• Network configuration is correct`
        );
      }

      throw error;
    }

    throw error;
  }
};
