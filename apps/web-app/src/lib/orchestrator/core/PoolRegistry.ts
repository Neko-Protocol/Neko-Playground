/**
 * PoolRegistry — maps pool identifiers to the correct adapter.
 *
 * Two resolution strategies:
 *  1. **Explicit mapping** — `registerPool(poolId, type)` stores a direct
 *     poolId → PoolType entry.
 *  2. **Convention-based** — pool ids prefixed with `<type>:` (e.g.
 *     `blend:USDC`) are parsed at resolve time, so pools don't need
 *     to be registered one-by-one.
 *
 * The registry is exported as a singleton, matching the service pattern
 * used elsewhere in the codebase (`lendingService`, etc.).
 */

import type { BasePoolAdapter } from "../types/adapter.types";
import type { PoolType } from "../types/pool.types";
import { PoolNotFoundError } from "../types/errors";

export class PoolRegistry {
  /** One adapter instance per pool type. */
  private adapters = new Map<PoolType, BasePoolAdapter>();

  /** Explicit poolId → PoolType overrides. */
  private poolTypeMap = new Map<string, PoolType>();

  /**
   * Register an adapter for a given pool type.
   * Replaces any previously registered adapter for the same type.
   */
  register(adapter: BasePoolAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  /**
   * Explicitly bind a pool id to a pool type.
   * Useful when pool ids don't follow the `<type>:<id>` convention.
   */
  registerPool(poolId: string, type: PoolType): void {
    this.poolTypeMap.set(poolId, type);
  }

  /**
   * Resolve a pool id to its adapter.
   *
   * Resolution order:
   *  1. Check explicit `poolTypeMap`.
   *  2. Parse `<type>:` prefix from the id.
   *  3. Throw `PoolNotFoundError` if neither matches.
   */
  resolve(poolId: string): BasePoolAdapter {
    const explicitType = this.poolTypeMap.get(poolId);
    if (explicitType) {
      const adapter = this.adapters.get(explicitType);
      if (adapter) return adapter;
    }

    const prefixMatch = poolId.match(/^(\w+):/);
    if (prefixMatch) {
      const type = prefixMatch[1] as PoolType;
      const adapter = this.adapters.get(type);
      if (adapter) return adapter;
    }

    throw new PoolNotFoundError(poolId);
  }

  /**
   * Strip the `<type>:` prefix from a pool id, returning the raw
   * identifier the adapter expects.
   */
  static stripPrefix(poolId: string): string {
    const idx = poolId.indexOf(":");
    return idx === -1 ? poolId : poolId.slice(idx + 1);
  }

  /** Return all registered adapters. */
  getAdapters(): BasePoolAdapter[] {
    return [...this.adapters.values()];
  }

  /** List all explicitly registered pool ids. */
  listRegisteredPools(): string[] {
    return [...this.poolTypeMap.keys()];
  }

  /** Check whether a pool type has a registered adapter. */
  hasAdapter(type: PoolType): boolean {
    return this.adapters.has(type);
  }
}

/** Singleton registry shared across the application. */
export const poolRegistry = new PoolRegistry();
