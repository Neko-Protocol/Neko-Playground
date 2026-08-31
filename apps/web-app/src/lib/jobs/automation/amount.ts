/**
 * `ExecutionStep.amountUsd` is a plain USD number; every on-chain call the
 * orchestrator/soroswap paths expect a raw bigint in the asset's smallest
 * unit. The candidates automation currently rebalances across (mocked in
 * `simulate/route.ts`) are all USD-pegged, 7-decimal Stellar assets, so this
 * is a straight fixed-point conversion — not a price lookup. If automation
 * ever rebalances into a non-USD-pegged asset, this is the place a real
 * price feed would need to replace the 1:1 assumption.
 */
const STELLAR_DECIMALS = 7;

export function usdToStroops(amountUsd: number): bigint {
  return BigInt(Math.round(Math.abs(amountUsd) * 10 ** STELLAR_DECIMALS));
}
