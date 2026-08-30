"use client";

import React, { useState } from "react";
import { Zap } from "lucide-react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { useWallet } from "@/hooks/useWallet";
import {
  useStrategies,
  useCreateStrategy,
  useUpdateStrategy,
  useDeleteStrategy,
} from "../../hooks/useStrategies";
import { useSimulateRebalance } from "../../hooks/useSimulateRebalance";
import {
  useExecutionQueue,
  useConfirmPlan,
  useCancelPlan,
} from "../../hooks/useExecutionQueue";
import { useActionLog } from "../../hooks/useActionLog";
import { StrategyList } from "../ui/StrategyList";
import { StrategyBuilder } from "../ui/StrategyBuilder";
import { SimulationPreview } from "../ui/SimulationPreview";
import { ExecutionQueueMonitor } from "../ui/ExecutionQueueMonitor";
import { ActionLogTable } from "../ui/ActionLogTable";
import type { Strategy } from "../../types/automation";

type Tab = "strategies" | "queue" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "strategies", label: "Strategies" },
  { key: "queue", label: "Execution queue" },
  { key: "history", label: "Action log" },
];

export function Automation() {
  const { address } = useWallet();
  const [tab, setTab] = useState<Tab>("strategies");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing] = useState<Strategy | null>(null);
  const [showSim, setShowSim] = useState(false);

  const { data: strategies = [], isLoading: strategiesLoading } =
    useStrategies();
  const { mutate: createStrategy, isPending: creating } = useCreateStrategy();
  const { mutate: updateStrategy } = useUpdateStrategy();
  const { mutate: deleteStrategy } = useDeleteStrategy();

  const {
    data: simResult,
    isLoading: simLoading,
    refetch: refetchSim,
  } = useSimulateRebalance(selectedId ?? undefined, showSim);

  const { data: plans = [], isLoading: queueLoading } = useExecutionQueue(
    selectedId ?? undefined,
    address
  );
  const { mutate: confirmPlan, isPending: confirming } = useConfirmPlan();
  const { mutate: cancelPlan, isPending: cancelling } = useCancelPlan();

  const { data: logEntries = [], isLoading: logLoading } = useActionLog(
    address,
    selectedId ?? undefined
  );

  if (!address) {
    return (
      <PageContainer maxWidth="6xl">
        <BannerPage
          title="Smart Yield Router"
          subtitle="Automated capital allocation across vaults, pools and lending."
        />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/10 py-20 text-center">
          <Zap size={36} className="text-white/20" />
          <p className="text-white/50">
            Connect your wallet to manage automation strategies.
          </p>
        </div>
      </PageContainer>
    );
  }

  const handleSave = (
    data: Omit<Strategy, "id" | "createdAt" | "updatedAt">
  ) => {
    if (editing) {
      updateStrategy({ id: editing.id, ...data });
    } else {
      createStrategy(data);
    }
    setShowBuilder(false);
    setEditing(null);
  };

  const handleRun = (id: string) => {
    setSelectedId(id);
    setShowSim(true);
    refetchSim();
    setTab("strategies");
  };

  const handleConfirm = () => {
    if (!simResult?.plan || !address) return;
    const strategyName = strategies.find(
      (s) => s.id === simResult.plan.strategyId
    )?.name;
    confirmPlan({ plan: simResult.plan, walletAddress: address, strategyName });
    setShowSim(false);
  };

  const handleCancelPlan = (planId: string) => {
    if (!selectedId || !address) return;
    cancelPlan({ planId, strategyId: selectedId, walletAddress: address });
  };

  return (
    <PageContainer maxWidth="6xl">
      <BannerPage
        title="Smart Yield Router"
        subtitle="Define strategies, simulate moves and auto-allocate capital for maximum net APY."
      />

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Strategies tab */}
      {tab === "strategies" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <StrategyList
              strategies={strategies}
              selected={selectedId}
              onSelect={setSelectedId}
              onNew={() => {
                setEditing(null);
                setShowBuilder(true);
              }}
              onEdit={(s) => {
                setEditing(s);
                setShowBuilder(true);
              }}
              onDelete={(id) => deleteStrategy(id)}
              onToggle={(id, enabled) => updateStrategy({ id, enabled })}
              onRun={handleRun}
              isLoading={strategiesLoading}
            />
          </div>

          <div className="lg:col-span-2">
            {showSim ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="mb-4 text-sm font-semibold text-white/80">
                  Simulation preview
                </h3>
                <SimulationPreview
                  result={simResult}
                  isLoading={simLoading}
                  onConfirm={handleConfirm}
                  onCancel={() => setShowSim(false)}
                  isConfirming={confirming}
                />
              </div>
            ) : selectedId ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm text-white/50">
                  Select &quot;Run now&quot; on a strategy to simulate a
                  rebalance, or enable a strategy to run automatically.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 py-20 text-center">
                <Zap size={28} className="text-white/20" />
                <p className="text-sm text-white/40">
                  Select a strategy to see details.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Queue tab */}
      {tab === "queue" && (
        <ExecutionQueueMonitor
          plans={plans}
          isLoading={queueLoading}
          onCancel={handleCancelPlan}
          isCancelling={cancelling}
        />
      )}

      {/* History tab */}
      {tab === "history" && (
        <ActionLogTable entries={logEntries} isLoading={logLoading} />
      )}

      {/* Builder modal */}
      {showBuilder && (
        <StrategyBuilder
          initial={editing ?? undefined}
          onSave={handleSave}
          onCancel={() => {
            setShowBuilder(false);
            setEditing(null);
          }}
          isSaving={creating}
        />
      )}
    </PageContainer>
  );
}

export default Automation;
