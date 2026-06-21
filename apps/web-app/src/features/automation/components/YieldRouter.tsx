"use client";

import { useState } from "react";
import { useYieldRouter } from "../hooks/useYieldRouter";
import type { YieldStrategy, RiskProfile } from "../types";

const RISK_COLORS: Record<RiskProfile, string> = {
  conservative: "text-green-400",
  balanced: "text-yellow-400",
  aggressive: "text-red-400",
};

const RISK_BG: Record<RiskProfile, string> = {
  conservative: "bg-green-500/10 border-green-500/30",
  balanced: "bg-yellow-500/10 border-yellow-500/30",
  aggressive: "bg-red-500/10 border-red-500/30",
};

interface YieldRouterProps {
  walletAddress?: string;
}

export default function YieldRouter({ walletAddress }: YieldRouterProps) {
  const { strategies, stats, createStrategy, evaluateStrategies, simulateRebalance } = useYieldRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRisk, setNewRisk] = useState<RiskProfile>("balanced");
  const [simulating, setSimulating] = useState<string | null>(null);

  const recommendations = evaluateStrategies();

  const handleCreate = () => {
    if (!newName.trim()) return;
    createStrategy(newName.trim(), newRisk);
    setNewName("");
    setShowCreate(false);
  };

  const handleSimulate = (strategyId: string) => {
    setSimulating(strategyId);
    setTimeout(() => setSimulating(null), 1500);
    simulateRebalance(strategyId);
  };

  return (
    <div className="space-y-6" role="region" aria-label="Smart Yield Router">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="TVL" value={"$" + stats.totalValueLocked.toLocaleString()} />
        <StatCard label="Avg APY" value={stats.averageApy.toFixed(2) + "%"} />
        <StatCard label="Active Strategies" value={String(stats.strategiesActive)} />
        <StatCard label="Positions" value={String(stats.positionsCount)} />
      </div>

      {/* Create Strategy */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Strategies</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-medium transition-colors"
          aria-label="Create new strategy"
        >
          {showCreate ? "Cancel" : "+ New Strategy"}
        </button>
      </div>

      {showCreate && (
        <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Strategy name"
            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm focus:outline-none focus:border-indigo-500"
            aria-label="Strategy name"
          />
          <div className="flex gap-2">
            {(["conservative", "balanced", "aggressive"] as RiskProfile[]).map((risk) => (
              <button
                key={risk}
                onClick={() => setNewRisk(risk)}
                className={"px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors " + RISK_BG[risk] + " " + (newRisk === risk ? "ring-2 ring-indigo-500" : "")}
                aria-label={"Risk: " + risk}
              >
                {risk.charAt(0).toUpperCase() + risk.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            Create Strategy
          </button>
        </div>
      )}

      {/* Strategy List */}
      {strategies.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No strategies yet</p>
          <p className="text-sm mt-1">Create your first yield strategy to start automated capital allocation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {strategies.map((strategy: YieldStrategy) => (
            <div
              key={strategy.id}
              className="p-4 rounded-xl border border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium">{strategy.name}</h3>
                  <span className={"text-xs font-medium " + RISK_COLORS[strategy.riskProfile]}>
                    {strategy.riskProfile}
                  </span>
                  <span className={"text-xs px-2 py-0.5 rounded-full " + (strategy.active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400")}>
                    {strategy.active ? "Active" : "Paused"}
                  </span>
                </div>
                <button
                  onClick={() => handleSimulate(strategy.id)}
                  className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs font-medium transition-colors"
                  aria-label={"Simulate rebalance for " + strategy.name}
                >
                  {simulating === strategy.id ? "Simulating..." : "Simulate"}
                </button>
              </div>
              <div className="text-sm text-gray-400">
                {strategy.targetAllocations.length} allocations | Threshold: {strategy.rebalanceThreshold}% | Auto-compound: {strategy.autoCompound ? "On" : "Off"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <h3 className="font-medium text-amber-400 mb-2">Rebalance Recommendations</h3>
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <div key={rec.strategyId} className="text-sm">
                <span className="font-medium">{rec.strategyName}:</span>{" "}
                {rec.actions.length} action{rec.actions.length > 1 ? "s" : ""} recommended
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/30">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
