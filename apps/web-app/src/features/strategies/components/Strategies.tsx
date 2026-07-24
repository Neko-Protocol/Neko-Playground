"use client";

import { useState } from "react";
import {
  Layers,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { useWallet } from "@/hooks/useWallet";
import {
  useStrategyPersistence,
  useExecutionRecovery,
} from "@/lib/strategy/hooks";
import { listExecutions, upsertExecution } from "@/lib/strategy/persistence";
import { STRATEGY_TEMPLATES } from "@/lib/strategy/templates";
import type { ExecutionRecord, Strategy } from "@/lib/strategy/types";
import { STRATEGIES_TABS, type StrategiesTab } from "../utils";
import { createEmptyStrategy, cloneAsEditable } from "../hooks";
import { StrategyComposer } from "./StrategyComposer";

// ─── Strategy list ───────────────────────────────────────────────────────────

export interface StrategyListProps {
  strategies: Strategy[];
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (strategy: Strategy) => void;
  onDelete: (strategyId: string) => void;
  onOpen: (strategy: Strategy) => void;
}

export function StrategyList({
  strategies,
  isLoading,
  onCreate,
  onEdit,
  onDelete,
  onOpen,
}: StrategyListProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Your strategies</h3>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-full bg-[#229EDF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c8bc4]"
        >
          Create strategy
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-white/40">Loading…</p>
      ) : strategies.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <Layers size={28} className="text-white/20" />
          <p className="text-sm text-white/40">
            No strategies yet — start from a template or create one from
            scratch.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#1C1C1C] p-4"
            >
              <button
                type="button"
                onClick={() => onOpen(strategy)}
                className="text-left"
              >
                <h4 className="text-sm font-semibold text-white">
                  {strategy.name}
                </h4>
                <p className="mt-1 text-xs text-white/40">
                  {strategy.steps.length} steps
                </p>
              </button>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(strategy)}
                  aria-label={`Run ${strategy.name}`}
                  className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/5"
                >
                  <Play size={12} /> Open
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(strategy)}
                  aria-label={`Edit ${strategy.name}`}
                  className="rounded-full p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(strategy.id)}
                  aria-label={`Delete ${strategy.name}`}
                  className="rounded-full p-1.5 text-white/40 hover:bg-white/5 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Template picker ─────────────────────────────────────────────────────────

export interface TemplatePickerProps {
  onUseTemplate: (template: Strategy) => void;
}

/** The 4 built-in templates, presented as selectable cards. "Use Template" clones the data, no separate code path. */
export function TemplatePicker({ onUseTemplate }: TemplatePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {STRATEGY_TEMPLATES.map((template) => (
        <div
          key={template.id}
          className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#1C1C1C] p-5"
        >
          <div>
            <h3 className="text-sm font-semibold text-white">
              {template.name}
            </h3>
            <p className="mt-1 text-xs text-white/50">{template.description}</p>
            <p className="mt-3 text-xs text-white/30">
              {template.steps.length} steps
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUseTemplate(template)}
            className="mt-4 self-start rounded-full bg-[#229EDF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c8bc4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Use template
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Execution history table ─────────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  completed: "text-green-400",
  in_progress: "text-[#229EDF]",
  failed: "text-red-400",
  "paused-deviation": "text-yellow-400",
  abandoned: "text-white/40",
};

/** Persisted execution history: projected and actual outcomes, status, and tx references. */
export function ExecutionHistoryTable({
  executions,
}: {
  executions: ExecutionRecord[];
}) {
  if (executions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">
        No executions yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
            <th className="px-3 py-2">Started</th>
            <th className="px-3 py-2">Strategy</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Steps completed</th>
          </tr>
        </thead>
        <tbody>
          {executions
            .slice()
            .sort((a, b) => b.startedAt - a.startedAt)
            .map((execution) => {
              const completed = execution.steps.filter(
                (s) => s.status === "completed"
              ).length;
              return (
                <tr
                  key={execution.id}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="px-3 py-2 text-white/60">
                    {new Date(execution.startedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-white/80">
                    {execution.strategyId}
                  </td>
                  <td
                    className={`px-3 py-2 font-medium ${STATUS_CLASS[execution.status] ?? "text-white/60"}`}
                  >
                    {execution.status}
                  </td>
                  <td className="px-3 py-2 text-white/60">
                    {completed}/{execution.steps.length}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Resume execution banner ─────────────────────────────────────────────────

export interface ResumeExecutionBannerProps {
  executions: ExecutionRecord[];
  onResume: (execution: ExecutionRecord) => void;
  onAbandon: (execution: ExecutionRecord) => void;
}

/** Surfaces unfinished executions detected on reopen — continue or abandon without losing history. */
export function ResumeExecutionBanner({
  executions,
  onResume,
  onAbandon,
}: ResumeExecutionBannerProps) {
  if (executions.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-2 rounded-xl border border-[#229EDF]/30 bg-[#229EDF]/10 p-4">
      {executions.map((execution) => {
        const completed = execution.steps.filter(
          (s) => s.status === "completed"
        ).length;
        return (
          <div
            key={execution.id}
            className="flex items-center justify-between gap-3"
          >
            <p className="text-sm text-white/80">
              An unfinished strategy execution is waiting to resume ({completed}
              /{execution.steps.length} steps completed
              {execution.status === "paused-deviation"
                ? ", paused on a deviation"
                : ""}
              ).
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onResume(execution)}
                className="flex items-center gap-1.5 rounded-full bg-[#229EDF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1c8bc4]"
              >
                <RotateCcw size={14} />
                Continue
              </button>
              <button
                type="button"
                onClick={() => onAbandon(execution)}
                aria-label="Abandon execution"
                className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function Strategies() {
  const { address } = useWallet();
  const [tab, setTab] = useState<StrategiesTab>("my-strategies");
  const [composing, setComposing] = useState<Strategy | null>(null);

  const { strategies, isLoading, saveStrategy, deleteStrategy } =
    useStrategyPersistence();
  const { resumable, refresh } = useExecutionRecovery();

  const executions: ExecutionRecord[] = address ? listExecutions(address) : [];

  if (!address) {
    return (
      <PageContainer maxWidth="6xl">
        <BannerPage
          title="Strategies"
          subtitle="Compose, simulate, and execute reusable multi-step DeFi strategies across every protocol Neko integrates."
        />
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/10 py-20 text-center">
          <Workflow size={36} className="text-white/20" />
          <p className="text-white/50">
            Connect your wallet to build and run strategies.
          </p>
        </div>
      </PageContainer>
    );
  }

  if (composing) {
    return (
      <PageContainer maxWidth="6xl">
        <StrategyComposer
          initial={composing}
          onClose={() => setComposing(null)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="6xl">
      <BannerPage
        title="Strategies"
        subtitle="Compose, simulate, and execute reusable multi-step DeFi strategies across every protocol Neko integrates."
      />

      <div className="mt-6">
        <ResumeExecutionBanner
          executions={resumable}
          onResume={(execution) =>
            setComposing(execution.strategySnapshot as Strategy)
          }
          onAbandon={(execution) => {
            if (!address) return;
            upsertExecution(address, { ...execution, status: "abandoned" });
            void refresh();
          }}
        />
      </div>

      <div
        className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-fit"
        role="tablist"
        aria-label="Strategies sections"
      >
        {STRATEGIES_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#229EDF] ${
              tab === t.key
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "my-strategies" && (
        <StrategyList
          strategies={strategies}
          isLoading={isLoading}
          onCreate={() => setComposing(createEmptyStrategy())}
          onEdit={(strategy) => setComposing(strategy)}
          onOpen={(strategy) => setComposing(strategy)}
          onDelete={(id) => deleteStrategy(id)}
        />
      )}

      {tab === "templates" && (
        <TemplatePicker
          onUseTemplate={(template) => {
            const draft = cloneAsEditable(template);
            saveStrategy(draft);
            setComposing(draft);
          }}
        />
      )}

      {tab === "history" && <ExecutionHistoryTable executions={executions} />}
    </PageContainer>
  );
}

export default Strategies;
