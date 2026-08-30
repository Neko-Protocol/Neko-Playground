import { orchestrator } from "@/lib/orchestrator";
import { getQuote, buildTransaction } from "@/lib/helpers/stellar/soroswap";
import type { StepExecutor, StepExecutionContext } from "@/lib/jobs/types";
import { usdToStroops } from "./amount";

/**
 * `Orchestrator.withdraw`/`deposit` only ever return an unsigned XDR
 * (`TransactionResult`) — moving a strategy owner's funds needs *their*
 * wallet signature, and there's no server-held signing key for user
 * positions (unlike the vault route's manager key). So a background worker
 * can build the transaction against the real adapters but can't submit it
 * on its own. Per the product decision on this feature, a step is marked
 * completed once the real orchestrator call succeeds in building that
 * transaction — it does not fabricate an on-chain confirmation or a
 * `txHash` that was never actually submitted.
 */
function readVenueAndAmount(ctx: StepExecutionContext): {
  venueId: string;
  walletAddress: string;
  amountRaw: bigint;
} {
  const walletAddress = ctx.job.walletAddress;
  if (!walletAddress) {
    throw new Error("Automation run is missing its owning wallet address");
  }
  const venueId = String(ctx.step.input.venueId ?? "");
  const amountUsd = Number(ctx.step.input.amountUsd ?? 0);
  if (!venueId) {
    throw new Error(`Step ${ctx.step.index} is missing its venueId`);
  }
  return { venueId, walletAddress, amountRaw: usdToStroops(amountUsd) };
}

export const withdrawExecutor: StepExecutor = async (ctx) => {
  const { venueId, walletAddress, amountRaw } = readVenueAndAmount(ctx);
  const tx = await orchestrator.withdraw(venueId, walletAddress, amountRaw);
  return { xdr: tx.xdr, networkPassphrase: tx.networkPassphrase };
};

export const depositExecutor: StepExecutor = async (ctx) => {
  const { venueId, walletAddress, amountRaw } = readVenueAndAmount(ctx);
  const tx = await orchestrator.deposit(venueId, walletAddress, amountRaw);
  return { xdr: tx.xdr, networkPassphrase: tx.networkPassphrase };
};

/**
 * `planBuilder.ts` only ever emits `withdraw`/`deposit` steps today — a
 * rebalance never needs a same-portfolio swap. `swap` stays a first-class
 * `ExecutionStep.kind`, though, so this executor exists to complete the
 * state machine using the venueId convention `SoroswapPoolAdapter` already
 * uses (`"<codeA>-<codeB>"`), quoting and building against the real
 * Soroswap path rather than leaving the kind unhandled.
 */
export const swapExecutor: StepExecutor = async (ctx) => {
  const walletAddress = ctx.job.walletAddress;
  if (!walletAddress) {
    throw new Error("Automation run is missing its owning wallet address");
  }
  const venueId = String(ctx.step.input.venueId ?? "");
  const assetIn = String(ctx.step.input.asset ?? "");
  const amountUsd = Number(ctx.step.input.amountUsd ?? 0);
  const [codeA, codeB] = venueId.split("-");
  const assetOut = assetIn === codeA ? codeB : codeA;
  if (!assetIn || !assetOut) {
    throw new Error(`Step ${ctx.step.index} has an unresolvable swap pair`);
  }

  const quote = await getQuote({
    assetIn,
    assetOut,
    amount: usdToStroops(amountUsd).toString(),
    tradeType: "EXACT_IN",
  });
  if (!quote) {
    throw new Error(`No swap quote available for ${assetIn} -> ${assetOut}`);
  }

  const built = await buildTransaction({ quote, from: walletAddress });
  return { xdr: built.xdr };
};

export const automationStepExecutors: Record<string, StepExecutor> = {
  withdraw: withdrawExecutor,
  deposit: depositExecutor,
  swap: swapExecutor,
};
