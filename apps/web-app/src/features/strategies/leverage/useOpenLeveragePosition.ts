"use client";

import { useCallback, useState } from "react";
import { nanoid } from "nanoid";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import {
  useStrategyPersistence,
  useStrategyExecution,
} from "@/lib/strategy/hooks";
import {
  buildLeverageStrategy,
  buildUnwindTranches,
  type BuildOpenLoopStepsInput,
} from "@/lib/strategy/leverage/buildStrategy";
import { signUnwindTranches } from "@/lib/coordinator/delegation";
import type { ExecutionRecord, Strategy } from "@/lib/strategy/types";
import type { RoutedLoopPlan } from "@/lib/strategy/leverage/types";
import type { DelegationGrant } from "@/lib/coordinator/types";

/** Total collateral realized (initial + every iteration's swap-back), divided by the initial deposit. */
export function computeAchievedMultiple(
  route: RoutedLoopPlan,
  initialCollateralAmount: string
): number {
  const initial = Number(initialCollateralAmount);
  if (initial <= 0) return 1;
  const total =
    initial +
    route.iterations.reduce((sum, it) => sum + Number(it.swapAmountOut), 0);
  return total / initial;
}

export interface OpenLeveragePositionInput {
  route: RoutedLoopPlan;
  assetCode: string;
  borrowAssetCode: string;
  initialCollateralAmount: string;
  targetMultiple: number;
  safetyBufferPct: number;
  /** Whether to also collect the pre-signed unwind tranches and register a DelegationGrant for the automated guard (Scope §5-6). */
  grantDelegation: boolean;
  deleverageThreshold: number;
  hysteresis: number;
}

export interface OpenLeveragePositionResult {
  strategy: Strategy;
  execution: ExecutionRecord;
  grant: DelegationGrant | null;
  delegationError: string | null;
}

/**
 * Orchestrates opening a leveraged position end to end: composes the routed
 * loop into a Strategy (Scope §3), runs it wallet-present through the
 * EXISTING lib/strategy execution engine (no new execution primitive for
 * this path), and — if the user opts in — collects the pre-signed unwind
 * tranches and registers them as a DelegationGrant so the automated
 * deleveraging guard (Scope §5-6) can act later without the wallet present.
 */
export function useOpenLeveragePosition() {
  const { address, networkPassphrase, signTransaction } = useWallet();
  const { saveStrategy } = useStrategyPersistence();
  const { execute } = useStrategyExecution();
  const { addNotification } = useToast();
  const [isOpening, setIsOpening] = useState(false);

  const open = useCallback(
    async (
      input: OpenLeveragePositionInput
    ): Promise<OpenLeveragePositionResult | null> => {
      if (!address || !networkPassphrase) return null;
      setIsOpening(true);
      try {
        const buildInput: BuildOpenLoopStepsInput = {
          route: input.route,
          assetCode: input.assetCode,
          borrowAssetCode: input.borrowAssetCode,
          initialCollateralAmount: input.initialCollateralAmount,
        };
        const achievedMultiple = computeAchievedMultiple(
          input.route,
          input.initialCollateralAmount
        );
        const strategy = buildLeverageStrategy(
          buildInput,
          input.targetMultiple,
          achievedMultiple,
          input.safetyBufferPct
        );
        saveStrategy(strategy);

        const record: ExecutionRecord = {
          id: nanoid(),
          strategyId: strategy.id,
          strategySnapshot: strategy,
          status: "in_progress",
          startedAt: Date.now(),
          updatedAt: Date.now(),
          projectedOutcome: {},
          steps: [],
        };

        const result = await execute(strategy, record);
        if (!result) {
          addNotification("Wallet not connected", "error", {});
          return null;
        }

        if (result.status !== "completed") {
          addNotification("Leverage loop did not complete", "error", {
            description:
              result.record.steps.find((s) => s.status === "failed")
                ?.errorMessage ??
              "The position was left in a partial state — check Execution History to resume or inspect it.",
          });
          return {
            strategy,
            execution: result.record,
            grant: null,
            delegationError: null,
          };
        }

        let grant: DelegationGrant | null = null;
        let delegationError: string | null = null;

        if (input.grantDelegation) {
          try {
            const tranches = buildUnwindTranches(buildInput);
            const signedTranches = await signUnwindTranches(
              tranches,
              { userAddress: address, networkPassphrase },
              signTransaction,
              input.assetCode,
              input.borrowAssetCode
            );
            const response = await fetch("/api/leverage/delegation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                positionId: strategy.id,
                walletAddress: address,
                assetCode: input.assetCode,
                borrowAssetCode: input.borrowAssetCode,
                tranches: signedTranches,
                guardConfig: {
                  deleverageThreshold: input.deleverageThreshold,
                  hysteresis: input.hysteresis,
                },
              }),
            });
            if (response.ok) {
              const data = (await response.json()) as {
                grant: DelegationGrant;
              };
              grant = data.grant;
            } else {
              const data = await response.json().catch(() => ({}));
              delegationError =
                (data as { error?: string }).error ??
                "Failed to register automated deleveraging.";
            }
          } catch (err) {
            delegationError = err instanceof Error ? err.message : String(err);
          }
        }

        if (delegationError) {
          addNotification(
            "Position opened — automated deleveraging setup failed",
            "warning",
            {
              description: `${delegationError} You can grant delegation later from the position's delegation panel.`,
            }
          );
        } else {
          addNotification("Leveraged position opened", "success", {
            description: `${strategy.name} — ${achievedMultiple.toFixed(2)}x achieved.`,
          });
        }

        return { strategy, execution: result.record, grant, delegationError };
      } finally {
        setIsOpening(false);
      }
    },
    [
      address,
      networkPassphrase,
      signTransaction,
      saveStrategy,
      execute,
      addNotification,
    ]
  );

  return { open, isOpening, hasWallet: Boolean(address) };
}
