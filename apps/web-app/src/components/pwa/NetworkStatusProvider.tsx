"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

type ConnectivityStatus = "online" | "offline" | "reconnecting" | "restored";

interface NetworkStatusContextValue {
  isOffline: boolean;
  isReconnecting: boolean;
  isOnline: boolean;
  isRestored: boolean;
  status: ConnectivityStatus;
  lastOnlineAt: number | null;
}

const NetworkStatusContext = createContext<NetworkStatusContextValue | null>(
  null
);

export function NetworkStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const isBrowserOnline = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      window.addEventListener("online", onStoreChange);
      window.addEventListener("offline", onStoreChange);

      return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
      };
    },
    () => {
      if (typeof window === "undefined") return true;

      return window.navigator.onLine;
    },
    () => true
  );
  const [status, setStatus] = useState<ConnectivityStatus>("online");
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);

  useEffect(() => {
    if (!isBrowserOnline) {
      setStatus("offline");
      return;
    }

    setLastOnlineAt((current) => current ?? Date.now());
    setStatus((current) => (current === "offline" ? "reconnecting" : current));
  }, [isBrowserOnline]);

  useEffect(() => {
    if (status !== "reconnecting") return;

    const timeout = window.setTimeout(() => {
      setStatus(window.navigator.onLine ? "restored" : "offline");
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (status !== "restored") return;

    const timeout = window.setTimeout(() => {
      setStatus(window.navigator.onLine ? "online" : "offline");
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [status]);

  const value = useMemo<NetworkStatusContextValue>(
    () => ({
      isOffline: status === "offline",
      isReconnecting: status === "reconnecting",
      isOnline: status === "online" || status === "restored",
      isRestored: status === "restored",
      status,
      lastOnlineAt,
    }),
    [lastOnlineAt, status]
  );

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus() {
  const context = useContext(NetworkStatusContext);

  if (!context) {
    throw new Error(
      "useNetworkStatus must be used within NetworkStatusProvider"
    );
  }

  return context;
}
