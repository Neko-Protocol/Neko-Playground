import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActivityEvent } from "../features/activity/types/activityEvent";
import { useStellarWalletStore } from "./stellarWalletStore";

function enqueuePlatformEvent(event: ActivityEvent): Promise<void> {
  return fetch("/api/events/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      id: event.id,
      source: event.source,
      type: event.type,
      summary: event.summary,
      link: event.link,
      timestamp: event.timestamp,
      metadata: event.metadata,
    }),
  })
    .then(() => undefined)
    .catch(() => {
      // No wallet session yet, or the platform is unreachable — the local
      // activity feed above is the fallback/fast path and is unaffected.
    });
}

export interface ActivityState {
  eventsByWallet: Record<string, ActivityEvent[]>;
  pushEvent: (event: Omit<ActivityEvent, "id" | "read">) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearEvents: () => void; // Clears for current wallet
}

const MAX_EVENTS = 500;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      eventsByWallet: {},

      pushEvent: (eventData) =>
        set((state) => {
          const walletKey = useStellarWalletStore.getState().address;
          if (!walletKey) return state; // Don't record if no wallet

          const now = Date.now();
          const id = crypto.randomUUID();
          const newEvent: ActivityEvent = {
            ...eventData,
            id,
            read: false,
          };

          // Durable bridge into the event platform — the single integration
          // point for all activityStore producers (see
          // lib/event-platform/types.ts). Fire-and-forget: the local,
          // optimistic list above is unaffected by network failure here, and
          // reusing `id` as the platform's dedupe key makes a retried POST
          // idempotent rather than double-enqueuing the same occurrence.
          void enqueuePlatformEvent(newEvent);

          const currentEvents = state.eventsByWallet[walletKey] || [];

          // Filter out expired events
          let newEvents = [newEvent, ...currentEvents].filter(
            (e) => now - e.timestamp < MAX_AGE_MS
          );

          // Enforce max size
          if (newEvents.length > MAX_EVENTS) {
            newEvents = newEvents.slice(0, MAX_EVENTS);
          }

          return {
            eventsByWallet: {
              ...state.eventsByWallet,
              [walletKey]: newEvents,
            },
          };
        }),

      markAllRead: () =>
        set((state) => {
          const walletKey = useStellarWalletStore.getState().address;
          if (!walletKey) return state;
          const currentEvents = state.eventsByWallet[walletKey] || [];
          return {
            eventsByWallet: {
              ...state.eventsByWallet,
              [walletKey]: currentEvents.map((e) => ({ ...e, read: true })),
            },
          };
        }),

      markRead: (id) =>
        set((state) => {
          const walletKey = useStellarWalletStore.getState().address;
          if (!walletKey) return state;
          const currentEvents = state.eventsByWallet[walletKey] || [];
          return {
            eventsByWallet: {
              ...state.eventsByWallet,
              [walletKey]: currentEvents.map((e) =>
                e.id === id ? { ...e, read: true } : e
              ),
            },
          };
        }),

      clearEvents: () =>
        set((state) => {
          const walletKey = useStellarWalletStore.getState().address;
          if (!walletKey) return state;
          return {
            eventsByWallet: {
              ...state.eventsByWallet,
              [walletKey]: [],
            },
          };
        }),
    }),
    {
      name: "neko-activity-feed",
    }
  )
);
