/**
 * Token Service
 * Handles token-related operations like balance fetching and token utilities
 */

import { PublicClient } from "viem";
import { EVM_TOKENS, getTokensForChain } from "../constants/evmConfig";
import type { EVMToken } from "../types/evmToken";
import type { TokenBalanceResult, TokenInfo } from "../types/tokenTypes";

export class TokenService {
  /**
   * Get token info by symbol or address
   */
  getTokenInfo(token: EVMToken | string, chainId: number = 1): EVMToken | null {
    if (typeof token === "string") {
      const tokens = getTokensForChain(chainId);
      const tokenBySymbol = Object.values(tokens).find(
        (t) =>
          t.symbol === token || t.address.toLowerCase() === token.toLowerCase()
      );
      if (tokenBySymbol) return tokenBySymbol;

      // Fallback to default tokens
      const defaultToken = Object.values(EVM_TOKENS).find(
        (t) =>
          t.symbol === token || t.address.toLowerCase() === token.toLowerCase()
      );
      if (defaultToken) return defaultToken;

      return null;
    }
    return token;
  }

  /**
   * Get native token balance (ETH, BNB, etc.)
   */
  async getNativeTokenBalance(
    walletAddress: `0x${string}`,
    publicClient: PublicClient,
    chainId: number = 1
  ): Promise<TokenBalanceResult> {
    try {
      const balance = await publicClient.getBalance({
        address: walletAddress,
      });

      const tokens = getTokensForChain(chainId);
      const nativeToken = Object.values(tokens).find(
        (token) =>
          token.address === "0x0000000000000000000000000000000000000000" ||
          token.symbol === "ETH" ||
          token.symbol === "BNB"
      );

      if (!nativeToken) {
        return {
          balance: "0",
          formattedBalance: "0",
          rawBalance: 0n,
          symbol: "ETH",
          decimals: 18,
          error: "Native token not found for chain",
        };
      }

      const formattedBalance = this.formatBalance(
        balance,
        nativeToken.decimals
      );

      return {
        balance: formattedBalance,
        formattedBalance,
        rawBalance: balance,
        symbol: nativeToken.symbol || "ETH", // Fallback to ETH for native tokens
        decimals: nativeToken.decimals,
      };
    } catch (error) {
      console.error("Error fetching native token balance:", error);
      return {
        balance: "0",
        formattedBalance: "0",
        rawBalance: 0n,
        symbol: "ETH",
        decimals: 18,
        error: `Failed to fetch balance: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Get ERC-20 token balance
   */
  async getERC20TokenBalance(
    tokenAddress: `0x${string}`,
    walletAddress: `0x${string}`,
    publicClient: PublicClient,
    decimals: number = 18
  ): Promise<TokenBalanceResult> {
    try {
      const balance = (await publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            constant: true,
            inputs: [{ name: "_owner", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "balance", type: "uint256" }],
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [walletAddress],
      })) as bigint;

      const formattedBalance = this.formatBalance(balance, decimals);

      return {
        balance: formattedBalance,
        formattedBalance,
        rawBalance: balance,
        symbol: "", // Will be filled by caller if needed
        decimals,
      };
    } catch (error) {
      console.error("Error fetching ERC-20 token balance:", error);
      return {
        balance: "0",
        formattedBalance: "0",
        rawBalance: 0n,
        symbol: "",
        decimals,
        error: `Failed to fetch balance: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Get token balance by token symbol or object
   */
  async getTokenBalance(
    token: EVMToken | string,
    walletAddress: `0x${string}`,
    publicClient: PublicClient,
    chainId: number = 1
  ): Promise<TokenBalanceResult> {
    const tokenInfo = this.getTokenInfo(token, chainId);

    if (!tokenInfo) {
      return {
        balance: "0",
        formattedBalance: "0",
        rawBalance: 0n,
        symbol: typeof token === "string" ? token : token.symbol || "",
        decimals: 18,
        error: "Token not found",
      };
    }

    // Check if it's a native token
    const isNative =
      tokenInfo.address === "0x0000000000000000000000000000000000000000" ||
      tokenInfo.symbol === "ETH" ||
      tokenInfo.symbol === "BNB";

    if (isNative) {
      return this.getNativeTokenBalance(walletAddress, publicClient, chainId);
    } else {
      const result = await this.getERC20TokenBalance(
        tokenInfo.address as `0x${string}`,
        walletAddress,
        publicClient,
        tokenInfo.decimals
      );

      return {
        ...result,
        symbol: tokenInfo.symbol || "UNKNOWN",
      };
    }
  }

  /**
   * Format balance from raw bigint to human-readable string
   */
  formatBalance(rawBalance: bigint, decimals: number): string {
    if (rawBalance === 0n) {
      return "0";
    }

    const divisor = 10n ** BigInt(decimals);
    const whole = rawBalance / divisor;
    const fractional = rawBalance % divisor;

    if (fractional === 0n) {
      return whole.toString();
    }

    const fractionalStr = fractional.toString().padStart(decimals, "0");
    const trimmedFractional = fractionalStr.replace(/0+$/, "");

    if (trimmedFractional === "") {
      return whole.toString();
    }

    return `${whole}.${trimmedFractional}`;
  }

  /**
   * Get multiple token balances in batch
   */
  async getTokenBalances(
    tokens: (EVMToken | string)[],
    walletAddress: `0x${string}`,
    publicClient: PublicClient,
    chainId: number = 1
  ): Promise<Record<string, TokenBalanceResult>> {
    const results: Record<string, TokenBalanceResult> = {};

    // Use Promise.allSettled to handle partial failures
    const promises = tokens.map(async (token) => {
      try {
        const balance = await this.getTokenBalance(
          token,
          walletAddress,
          publicClient,
          chainId
        );
        const key =
          typeof token === "string" ? token : token.symbol || token.address;
        return { key, balance };
      } catch (error) {
        console.warn(`Failed to get balance for token:`, token, error);
        const key =
          typeof token === "string" ? token : token.symbol || token.address;
        return {
          key,
          balance: {
            balance: "0",
            formattedBalance: "0",
            rawBalance: 0n,
            symbol: typeof token === "string" ? token : token.symbol || "",
            decimals: 18,
            error: "Failed to fetch balance",
          } as TokenBalanceResult,
        };
      }
    });

    const settledResults = await Promise.allSettled(promises);

    settledResults.forEach((result) => {
      if (result.status === "fulfilled") {
        results[result.value.key] = result.value.balance;
      }
    });

    return results;
  }

  /**
   * Check if token is approved for spending
   */
  async checkTokenAllowance(
    tokenAddress: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`,
    publicClient: PublicClient
  ): Promise<bigint> {
    try {
      const allowance = (await publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            constant: true,
            inputs: [
              { name: "_owner", type: "address" },
              { name: "_spender", type: "address" },
            ],
            name: "allowance",
            outputs: [{ name: "", type: "uint256" }],
            type: "function",
          },
        ],
        functionName: "allowance",
        args: [owner, spender],
      })) as bigint;

      return allowance;
    } catch (error) {
      console.error("Error checking token allowance:", error);
      return 0n;
    }
  }

  /**
   * Get token symbol from contract
   */
  async getTokenSymbol(
    tokenAddress: `0x${string}`,
    publicClient: PublicClient
  ): Promise<string> {
    try {
      const symbol = (await publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            constant: true,
            inputs: [],
            name: "symbol",
            outputs: [{ name: "", type: "string" }],
            type: "function",
          },
        ],
        functionName: "symbol",
        args: [],
      })) as string;

      return symbol;
    } catch (error) {
      console.error("Error fetching token symbol:", error);
      return "";
    }
  }

  /**
   * Get token decimals from contract
   */
  async getTokenDecimals(
    tokenAddress: `0x${string}`,
    publicClient: PublicClient
  ): Promise<number> {
    try {
      const decimals = (await publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            constant: true,
            inputs: [],
            name: "decimals",
            outputs: [{ name: "", type: "uint8" }],
            type: "function",
          },
        ],
        functionName: "decimals",
        args: [],
      })) as number;

      return decimals;
    } catch (error) {
      console.error("Error fetching token decimals:", error);
      return 18; // Default fallback
    }
  }

  /**
   * Get comprehensive token info from contract
   */
  async getTokenInfoFromContract(
    tokenAddress: `0x${string}`,
    publicClient: PublicClient
  ): Promise<TokenInfo> {
    try {
      const [symbol, decimals] = await Promise.all([
        this.getTokenSymbol(tokenAddress, publicClient),
        this.getTokenDecimals(tokenAddress, publicClient),
      ]);

      return {
        address: tokenAddress,
        symbol: symbol || "UNKNOWN",
        decimals: decimals || 18,
      };
    } catch (error) {
      console.error("Error fetching token info:", error);
      return {
        address: tokenAddress,
        symbol: "UNKNOWN",
        decimals: 18,
      };
    }
  }
}

// Export singleton instance
export const tokenService = new TokenService();
