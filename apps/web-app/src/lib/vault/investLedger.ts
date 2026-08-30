import { jobStore } from "@/lib/jobs/store";
import { runJob } from "@/lib/jobs/runner";
import type {
  ActionLogEntryRow,
  JobRun,
  JobStep,
  StepExecutor,
} from "@/lib/jobs/types";
import {
  buildVaultClient,
  collectFees,
  getVaultManagerEnv,
  harvestAquarius,
  investIdle,
  VAULT_INVEST_COOLDOWN_MS,
} from "./investSteps";

export const VAULT_INVEST_JOB_TYPE = "vault-invest" as const;
export const VAULT_INVEST_EXTERNAL_REF = "singleton";

const STEP_DEFINITIONS = [
  { kind: "harvest-aquarius" },
  { kind: "invest-idle" },
  { kind: "collect-fees" },
];

function newWorkerId(): string {
  return `vault-invest:${process.pid}:${Math.random().toString(36).slice(2)}`;
}

/**
 * The extracted step functions never throw on a bad on-chain outcome — they
 * swallow the failure into a `status` string, matching the original route's
 * best-effort logging. The ledger needs the opposite: a step that didn't
 * succeed must throw so `runJob` marks it failed and stops the sequence
 * instead of silently moving on. This boundary is where that conversion
 * happens, without changing `investSteps.ts` itself.
 */
function buildExecutors(): Record<string, StepExecutor> {
  const { secretKey, rpcUrl, networkPassphrase } = getVaultManagerEnv();
  const { keypair, server, client } = buildVaultClient(
    secretKey,
    rpcUrl,
    networkPassphrase
  );

  return {
    "harvest-aquarius": async () => {
      const result = await harvestAquarius(keypair, server, networkPassphrase);
      if (result.status !== "SUCCESS") {
        throw new Error(`harvest failed: ${result.status}`);
      }
      return result;
    },
    "invest-idle": async () => {
      const result = await investIdle(
        client,
        keypair,
        server,
        networkPassphrase
      );
      const failed = result.results.find((r) => r.status !== "SUCCESS");
      if (failed) {
        throw new Error(
          `invest failed on ${failed.strategy}: ${failed.status}`
        );
      }
      return result;
    },
    "collect-fees": async () => {
      const result = await collectFees(
        client,
        keypair,
        server,
        networkPassphrase
      );
      if (!result.feesCollected) {
        const failedStep = result.results[result.results.length - 1];
        throw new Error(
          `fee collection failed at ${failedStep?.step ?? "unknown"}: ${
            failedStep?.status ?? "unknown"
          }`
        );
      }
      return result;
    },
  };
}

export async function runOrResumeVaultInvest(): Promise<{
  job: JobRun;
  steps: JobStep[];
}> {
  const job = await jobStore.startOrResumeJob({
    jobType: VAULT_INVEST_JOB_TYPE,
    externalRef: VAULT_INVEST_EXTERNAL_REF,
    steps: STEP_DEFINITIONS,
    resetIfTerminal: true,
  });

  return runJob(jobStore, {
    jobId: job.id,
    workerId: newWorkerId(),
    executors: buildExecutors(),
  });
}

/**
 * Cooldown only gates starting a brand-new cycle after the previous one
 * finished cleanly. A run that's still pending/running (a legitimate
 * in-flight or resumable attempt) is never blocked by it — the lease inside
 * `runOrResumeVaultInvest` is what prevents two concurrent executions.
 */
export async function getVaultInvestLedgerStatus(): Promise<{
  canInvest: boolean;
  cooldownRemaining: number;
}> {
  const job = await jobStore.findJobRun(
    VAULT_INVEST_JOB_TYPE,
    VAULT_INVEST_EXTERNAL_REF
  );
  if (!job || job.status !== "completed") {
    return { canInvest: true, cooldownRemaining: 0 };
  }
  const remainingMs = job.updatedAt + VAULT_INVEST_COOLDOWN_MS - Date.now();
  return {
    canInvest: remainingMs <= 0,
    cooldownRemaining: Math.max(0, Math.ceil(remainingMs / 1000)),
  };
}

export async function listVaultRunHistory(): Promise<ActionLogEntryRow[]> {
  return jobStore.listActionLog(VAULT_INVEST_JOB_TYPE);
}
