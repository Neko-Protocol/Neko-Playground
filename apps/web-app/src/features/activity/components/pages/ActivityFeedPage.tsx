"use client";

import { useState } from "react";
import {
  useActivityFeed,
  type ActivityFilters,
} from "../../hooks/useActivityFeed";
import { ActivityFeedItem } from "../ui/ActivityFeedItem";
import { ActivityFiltersControl } from "../ui/ActivityFilters";
import { useWalletType } from "@/hooks/useWalletType";
import { Check } from "lucide-react";

export function ActivityFeedPage() {
  const { isStellarConnected } = useWalletType();
  const [filters, setFilters] = useState<ActivityFilters>({
    sources: [],
    dateRange: "all",
  });

  const { events, unreadCount, markAllRead } = useActivityFeed(filters);

  if (!isStellarConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <h2 className="text-2xl font-bold font-klein text-white mb-2">
          Activity Feed
        </h2>
        <p className="text-white/60">
          Connect your wallet to see your activity across Neko DApp.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-klein text-white tracking-tight">
            Activity Feed
          </h1>
          <p className="text-white/60 mt-1">
            Track your limit orders, automation strategies, and vault
            transactions.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition-colors border border-white/5"
          >
            <Check className="w-4 h-4" />
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      <ActivityFiltersControl filters={filters} onChange={setFilters} />

      <div className="flex flex-col gap-3">
        {events.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-white/5">
            <p className="text-white/60">No activity matches your filters.</p>
          </div>
        ) : (
          events.map((event) => (
            <ActivityFeedItem key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
