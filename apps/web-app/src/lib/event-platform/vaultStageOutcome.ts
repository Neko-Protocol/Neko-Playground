import { clientEnv } from "@/lib/env.client";
import { raiseEvent, resolveEvent } from "./outbox";

export type VaultInvestStage = "harvestAquarius" | "investIdle" | "collectFees";

/**
 * The vault-invest producer's failure→event wiring, isolated from the
 * Soroban transaction pipeline in app/api/vault/invest/route.ts on purpose:
 * that file imports `@neko/defindex-vault`, which doesn't resolve at
 * Vitest's module-resolution level in this repo (a pre-existing workspace
 * package issue — see the eslint-disable comments in that route already
 * flagging it for TypeScript). Keeping this dependency-free lets it be unit
 * tested directly instead of only through the untestable route.
 *
 * This vault-invest cron is a system-level operation on one shared vault
 * contract, not scoped to an individual end user — there is no per-request
 * "owning wallet" to notify. `NEXT_PUBLIC_LENDING_ADMIN_ADDRESS` is this
 * codebase's existing admin-identity concept (already used to gate
 * /dashboard/admin), so stage failures are reported to that wallet instead
 * of inventing a new one. If it's unset, failures are only visible in the
 * HTTP response, same as before this feature.
 */
export async function reportStageOutcome(
  stage: VaultInvestStage,
  failed: boolean,
  detail: Record<string, unknown>
): Promise<void> {
  const walletAddress = clientEnv.lendingAdminAddress;
  if (!walletAddress) return;

  const dedupeKey = `vault-invest-stage:${stage}`;
  try {
    if (failed) {
      await raiseEvent({
        source: "vault",
        walletAddress,
        dedupeKey,
        eventType: `${stage}-failed`,
        severity: "critical",
        payload: detail,
      });
    } else {
      await resolveEvent({
        source: "vault",
        walletAddress,
        dedupeKey,
        eventType: `${stage}-recovered`,
        payload: detail,
      });
    }
  } catch (err) {
    // Never let event-platform delivery affect the vault-invest run itself.
    console.error(`reportStageOutcome(${stage}) failed:`, err);
  }
}
