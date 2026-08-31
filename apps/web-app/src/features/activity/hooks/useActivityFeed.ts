"use client";

import { useMemo } from "react";
import { useActivityStore } from "@/stores/activityStore";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";

import type { ActivityEvent } from "../types/activityEvent";

export interface ActivityFilters {
  sources?: ActivityEvent["source"][];
  dateRange?: "today" | "7d" | "30d" | "all";
}

export function useActivityFeed(filters?: ActivityFilters) {
  const address = useStellarWalletStore((state) => state.address);
  const eventsByWallet = useActivityStore((state) => state.eventsByWallet);
  const markAllRead = useActivityStore((state) => state.markAllRead);
  const markRead = useActivityStore((state) => state.markRead);

  const allEvents = useMemo(() => {
    if (!address) return [];
    return eventsByWallet[address] || [];
  }, [address, eventsByWallet]);

  const filteredEvents = useMemo(() => {
    let result = allEvents;
    // eslint-disable-next-line react-hooks/purity -- coarse "now" for day/week/month range filtering; render-purity doesn't matter for this UI
    const now = Date.now();

    if (filters?.sources && filters.sources.length > 0) {
      const allowedSources = new Set(filters.sources);
      result = result.filter((e) => allowedSources.has(e.source));
    }

    if (filters?.dateRange && filters.dateRange !== "all") {
      let msRange = 0;
      if (filters.dateRange === "today") msRange = 24 * 60 * 60 * 1000;
      else if (filters.dateRange === "7d") msRange = 7 * 24 * 60 * 60 * 1000;
      else if (filters.dateRange === "30d") msRange = 30 * 24 * 60 * 60 * 1000;

      result = result.filter((e) => now - e.timestamp <= msRange);
    }

    return result;
  }, [allEvents, filters]);

  const unreadCount = useMemo(() => {
    return allEvents.filter((e) => !e.read).length;
  }, [allEvents]);

  return {
    events: filteredEvents,
    allEvents,
    unreadCount,
    markAllRead,
    markRead,
  };
}
