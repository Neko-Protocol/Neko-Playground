import type { BasePoolAdapter } from "../types/adapter.types";
import type { PoolType } from "../types/pool.types";
import { PoolNotFoundError } from "../types/errors";

export class PoolRegistry {
  private adapters = new Map<PoolType, BasePoolAdapter>();

  private poolTypeMap = new Map<string, PoolType>();

  register(adapter: BasePoolAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  registerPool(poolId: string, type: PoolType): void {
    this.poolTypeMap.set(poolId, type);
  }

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

  static stripPrefix(poolId: string): string {
    const idx = poolId.indexOf(":");
    return idx === -1 ? poolId : poolId.slice(idx + 1);
  }

  getAdapters(): BasePoolAdapter[] {
    return [...this.adapters.values()];
  }

  listRegisteredPools(): string[] {
    return [...this.poolTypeMap.keys()];
  }

  hasAdapter(type: PoolType): boolean {
    return this.adapters.has(type);
  }
}

export const poolRegistry = new PoolRegistry();
