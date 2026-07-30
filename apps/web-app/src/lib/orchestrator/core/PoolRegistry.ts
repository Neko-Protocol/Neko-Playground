import type { BasePoolAdapter } from "../types/adapter.types";
import type { PoolType } from "../types/pool.types";
import { PoolNotFoundError } from "../types/errors";

export class PoolRegistry {
  private adapters = new Map<PoolType, BasePoolAdapter[]>();

  register(adapter: BasePoolAdapter): void {
    const existing = this.adapters.get(adapter.type);
    if (existing) {
      existing.push(adapter);
    } else {
      this.adapters.set(adapter.type, [adapter]);
    }
  }

  resolve(poolId: string): BasePoolAdapter {
    const prefixMatch = poolId.match(/^(\w+):/);
    if (prefixMatch) {
      const type = prefixMatch[1] as PoolType;
      const adapter = this.adapters.get(type)?.[0];
      if (adapter) return adapter;
    }

    throw new PoolNotFoundError(poolId);
  }

  static stripPrefix(poolId: string): string {
    const idx = poolId.indexOf(":");
    return idx === -1 ? poolId : poolId.slice(idx + 1);
  }

  getAdapters(): BasePoolAdapter[] {
    return [...this.adapters.values()].flat();
  }
}

export const poolRegistry = new PoolRegistry();
