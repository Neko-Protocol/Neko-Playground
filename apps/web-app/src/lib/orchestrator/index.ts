/**
 * Pool Orchestrator — public API.
 *
 * Import everything the UI needs from this single entry-point:
 *
 * ```ts
 * import { orchestrator, usePools, usePoolAction } from "@/lib/orchestrator";
 * ```
 */

// Singleton + classes
export { orchestrator, Orchestrator } from "./core";
export { poolRegistry, PoolRegistry } from "./core";

// Adapters (for advanced consumers who need to register custom ones)
export {
  NekoLendingAdapter,
  BlendPoolAdapter,
  SoroswapPoolAdapter,
} from "./adapters";

// React hooks
export {
  usePools,
  usePoolInfo,
  useUserPosition,
  usePoolAction,
  POOLS_QUERY_KEY,
} from "./hooks";

// Types
export type {
  PoolType,
  PoolState,
  PoolAction,
  TokenInfo,
  PoolInfo,
  PoolPosition,
  TransactionResult,
  PoolActionResult,
  BasePoolAdapter,
} from "./types";

// Errors
export {
  OrchestratorError,
  PoolNotFoundError,
  AdapterError,
  UnsupportedActionError,
} from "./types";
