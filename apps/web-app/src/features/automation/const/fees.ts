/**
 * Protocol fee and gas assumptions used to derive net APY in the
 * Smart Yield Router.
 *
 * These are NOT read from chain today. They are documented constants so
 * that:
 *   1. the arithmetic in `calcNetApyBps` has a defensible, reviewable input;
 *   2. the assumption is explicit rather than buried in a mock;
 *   3. a follow-up issue can replace each with a live source without
 *      touching the candidates pipeline.
 *
 * Sources / rationale:
 *   - `VAULT_PROTOCOL_FEE_BPS = 30`   — Neko Vault's performance fee as
 *                                       configured at launch (30 bps of
 *                                       yield). Not exposed by a getter
 *                                       on the vault contract today.
 *   - `LENDING_PROTOCOL_FEE_BPS = 20` — Neko Lending reserve factor on
 *                                       interest, from the pool's
 *                                       `queue_set_reserve_params`
 *                                       defaults (2%).
 *   - `POOL_PROTOCOL_FEE_BPS = 60`    — SoroSwap LP fee tier assumption
 *                                       (0.3% per swap, ~60 bps
 *                                       annualised at observed testnet
 *                                       volume). Conservative upper bound.
 *   - `AMORTIZED_GAS_BPS_VAULT/LENDING/POOL` — expected execution cost
 *                                       amortised over a one-year
 *                                       holding period, expressed in
 *                                       basis points. Assumes ~$0.05 in
 *                                       Stellar fees per rebalance leg
 *                                       and a $10k reference position.
 */
export const VAULT_PROTOCOL_FEE_BPS = 30;
export const LENDING_PROTOCOL_FEE_BPS = 20;
export const POOL_PROTOCOL_FEE_BPS = 60;

export const AMORTIZED_GAS_BPS_VAULT = 5;
export const AMORTIZED_GAS_BPS_LENDING = 5;
export const AMORTIZED_GAS_BPS_POOL = 10;
