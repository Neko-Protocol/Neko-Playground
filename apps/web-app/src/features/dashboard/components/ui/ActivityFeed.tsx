"use client";

import React, { useState } from "react";
import { 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Repeat, 
  Zap, 
  PlusCircle, 
  MinusCircle, 
  ExternalLink,
  Filter,
  Inbox
} from "lucide-react";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { useWallet } from "@/hooks/useWallet";
import type { ActivityType, ActivityEntry } from "../../types/activity";
import { clsx } from "clsx";

const TYPE_CONFIG: Record<ActivityType, { icon: any, label: string, color: string }> = {
  deposit: { icon: PlusCircle, label: "Deposit", color: "text-blue-400" },
  withdraw: { icon: MinusCircle, label: "Withdraw", color: "text-orange-400" },
  borrow: { icon: ArrowDownLeft, label: "Borrow", color: "text-purple-400" },
  repay: { icon: ArrowUpRight, label: "Repay", color: "text-green-400" },
  swap: { icon: Repeat, label: "Swap", color: "text-pink-400" },
  pool_join: { icon: PlusCircle, label: "Join Pool", color: "text-blue-400" },
  pool_exit: { icon: MinusCircle, label: "Exit Pool", color: "text-orange-400" },
  claim_rewards: { icon: Zap, label: "Claim", color: "text-yellow-400" },
  transfer: { icon: Repeat, label: "Transfer", color: "text-white/60" },
  unknown: { icon: History, label: "Interaction", color: "text-white/40" },
};

const ActivityFeed: React.FC = () => {
  const { address } = useWallet();
  const { data: activities, isLoading } = useActivityFeed(address);
  const [filter, setFilter] = useState<ActivityType | "all">("all");

  const filteredActivities = activities?.filter(a => filter === "all" || a.type === filter) || [];

  if (!address) return null;

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
            Activity Feed
          </h2>
          <p className="text-white/40 text-sm">Your recent on-chain interactions</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="appearance-none bg-[#1C1C1C] border border-white/5 rounded-lg px-4 py-2 pr-10 text-sm text-white/60 hover:text-white hover:border-white/10 transition-all focus:outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="withdraw">Withdrawals</option>
              <option value="swap">Swaps</option>
              <option value="borrow">Borrows</option>
              <option value="repay">Repays</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 pointer-events-none" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-20 flex flex-col items-center justify-center gap-4 animate-pulse">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-white/5 border-t-[#229EDF] animate-spin" />
            <History className="absolute inset-0 m-auto h-4 w-4 text-white/20" />
          </div>
          <p className="text-white/20 text-xs font-bold uppercase tracking-[0.2em]">Synchronizing Activity</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-10 text-center">
          <Inbox className="h-8 w-8 text-white/20 mx-auto mb-3" />
          <p className="text-white font-semibold text-sm mb-1">
            No activity found
          </p>
          <p className="text-white/40 text-xs">
            {filter === "all" ? "Your recent transactions will appear here" : `No recent ${filter} transactions`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
};

const ActivityItem: React.FC<{ entry: ActivityEntry }> = ({ entry }) => {
  const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.unknown;
  const Icon = config.icon;
  
  const date = new Date(entry.timestamp);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="group flex items-center justify-between rounded-2xl bg-[#1C1C1C] border border-white/5 p-4 sm:p-5 hover:border-white/10 hover:bg-[#222222] transition-all duration-300 animate__animated animate__fadeInUp animate__faster">
      <div className="flex items-center gap-4">
        <div className={clsx("p-2.5 rounded-xl bg-white/5 transition-transform group-hover:scale-110 duration-300", config.color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm tracking-tight">
            {config.label}
          </p>
          <p className="text-white/40 text-[11px] font-medium mt-0.5">
            {dateStr} • {timeStr}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="text-right">
          <p className={clsx("font-bold text-sm tracking-tight", entry.status === "failed" ? "text-red-400" : "text-white")}>
            {entry.amount !== "0" && (entry.type === "deposit" || entry.type === "borrow" || entry.type === "pool_join" ? "+" : "-")}
            {entry.amount} {entry.assetCode}
          </p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <div className={clsx("h-1 w-1 rounded-full", entry.status === "failed" ? "bg-red-400" : "bg-green-400")} />
            <p className={clsx("text-[10px] font-bold uppercase tracking-widest", entry.status === "failed" ? "text-red-400/60" : "text-white/20")}>
              {entry.status}
            </p>
          </div>
        </div>

        <a
          href={entry.link}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-xl bg-white/0 hover:bg-white/5 text-white/10 hover:text-white/60 transition-all duration-200"
          title="View on Stellar Expert"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
};

export default ActivityFeed;
