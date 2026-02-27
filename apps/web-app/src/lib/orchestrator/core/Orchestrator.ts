/**
 * Orchestrator — the single entry-point the frontend uses to
 * interact with **any** pool type in the Pulse protocol.
 *
 * Every method delegates to `PoolRegistry.resolve(poolId)` to find
 * the right adapter, strips the `<type>:` prefix, and forwards the
 * call.  Errors from adapters bubble up as-is (they are already
 * instances of `OrchestratorError` subtypes).
 *
 * A pre-configured singleton (`orchestrator`) is exported at the
 * bottom of the file — it registers the Neko, Blend, and SoroSwap
 * adapters so the consumer doesn't need to do any wiring.
 */

import { PoolRegistry, poolRegistry } from "./PoolRegistry";
import { NekoLendingAdapter } from "../adapters/NekoLendingAdapter";
import { BlendPoolAdapter } from "../adapters/BlendPoolAdapter";
import { SoroswapPoolAdapter } from "../adapters/SoroswapPoolAdapter";
import { getBlendPoolIds } from "../adapters/blend-config";
import { UnsupportedActionError } from "../types/errors";

import type {
  PoolInfo,
  PoolPosition,
  TransactionResult,
} from "../types/pool.types";

export class Orchestrator {
  constructor(private registry: PoolRegistry) {}

  /**
   * Fetch normalised info for a single pool.
   * @param poolId - Full id including type prefix, e.g. `blend:USDC`.
   */
  async getPoolInfo(poolId: string): Promise<PoolInfo> {
    const adapter = this.registry.resolve(poolId);
    const rawId = PoolRegistry.stripPrefix(poolId);
    return adapter.getPoolInfo(rawId);
  }

  /**
   * Get the connected user's position in a pool.
   */
  async getUserPosition(
    poolId: string,
    userAddress: string
  ): Promise<PoolPosition> {
    const adapter = this.registry.resolve(poolId);
    const rawId = PoolRegistry.stripPrefix(poolId);
    return adapter.getUserPosition(rawId, userAddress);
  }

  /**
   * Build an unsigned deposit transaction.
   * @param amount - Expressed in the token's smallest unit.
   */
  async deposit(
    poolId: string,
    userAddress: string,
    amount: bigint,
    tokenIndex?: number
  ): Promise<TransactionResult> {
    const adapter = this.registry.resolve(poolId);
    const rawId = PoolRegistry.stripPrefix(poolId);
    return adapter.deposit(rawId, userAddress, amount, tokenIndex);
  }

  /**
   * Build an unsigned withdraw transaction.
   * @param amount - Expressed in the token's smallest unit.
   */
  async withdraw(
    poolId: string,
    userAddress: string,
    amount: bigint,
    tokenIndex?: number
  ): Promise<TransactionResult> {
    const adapter = this.registry.resolve(poolId);
    const rawId = PoolRegistry.stripPrefix(poolId);
    return adapter.withdraw(rawId, userAddress, amount, tokenIndex);
  }

  /**
   * Build an unsigned borrow transaction.
   * Only supported by lending-protocol adapters (e.g. Blend).
   */
  async borrow(
    poolId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    const adapter = this.registry.resolve(poolId);
    if (!adapter.borrow) {
      throw new UnsupportedActionError(adapter.type, "borrow");
    }
    const rawId = PoolRegistry.stripPrefix(poolId);
    return adapter.borrow(rawId, userAddress, amount);
  }

  /**
   * Build an unsigned repay transaction.
   * Only supported by lending-protocol adapters (e.g. Blend).
   */
  async repay(
    poolId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    const adapter = this.registry.resolve(poolId);
    if (!adapter.repay) {
      throw new UnsupportedActionError(adapter.type, "repay");
    }
    const rawId = PoolRegistry.stripPrefix(poolId);
    return adapter.repay(rawId, userAddress, amount);
  }

  /**
   * Build an unsigned claim-rewards transaction.
   * Throws `UnsupportedActionError` if the pool doesn't support rewards.
   */
  async claimRewards(
    poolId: string,
    userAddress: string
  ): Promise<TransactionResult> {
    const adapter = this.registry.resolve(poolId);
    const rawId = PoolRegistry.stripPrefix(poolId);
    return adapter.claimRewards(rawId, userAddress);
  }

  /**
   * Aggregate pools from **every** registered adapter.
   * Individual adapter failures are caught so one broken adapter
   * doesn't prevent the rest from loading.
   */
  async getAllPools(): Promise<PoolInfo[]> {
    const adapters = this.registry.getAdapters();

    const settled = await Promise.allSettled(
      adapters.map((a) => a.listPools())
    );

    const pools: PoolInfo[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") {
        pools.push(...result.value);
      } else {
        console.error(
          "[Orchestrator] adapter.listPools failed:",
          result.reason
        );
      }
    }

    return pools;
  }

  /**
   * Check at runtime whether a pool supports a given action.
   */
  supportsAction(poolId: string, action: string): boolean {
    try {
      const adapter = this.registry.resolve(poolId);
      return adapter.supportsAction(
        action as import("../types/pool.types").PoolAction
      );
    } catch {
      return false;
    }
  }
}

// ------------------------------------------------------------------
// Pre-configured singleton
// ------------------------------------------------------------------

poolRegistry.register(new NekoLendingAdapter());

for (const blendPoolId of getBlendPoolIds()) {
  poolRegistry.register(new BlendPoolAdapter(blendPoolId));
}

poolRegistry.register(new SoroswapPoolAdapter());

/** Ready-to-use orchestrator instance with all adapters wired up. */
export const orchestrator = new Orchestrator(poolRegistry);
