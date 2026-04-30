"use client";

import {
  QueryClient,
  QueryClientProvider,
  dehydrate,
  hydrate,
} from "@tanstack/react-query";
import { ToastProvider } from "@/providers/ToastProvider";
import { ReactNode, useEffect, useState } from "react";
import { NetworkStatusProvider } from "@/components/pwa/NetworkStatusProvider";
import { PwaRegistration } from "@/components/pwa/PwaRegistration";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000, // 1 min global default
            gcTime: 10 * 60_000, // Cache survives 10 min after unmount
            refetchOnWindowFocus: false, // Don't refetch just by tabbing back
          },
        },
      })
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const snapshot = window.localStorage.getItem("neko-react-query-cache");
    if (snapshot) {
      try {
        hydrate(queryClient, JSON.parse(snapshot));
      } catch {
        window.localStorage.removeItem("neko-react-query-cache");
      }
    }

    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      try {
        const dehydratedState = dehydrate(queryClient, {
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" &&
            Array.isArray(query.queryKey) &&
            !query.queryKey.some(
              (part) => typeof part === "string" && part.startsWith("mutation:")
            ),
        });

        window.localStorage.setItem(
          "neko-react-query-cache",
          JSON.stringify(dehydratedState)
        );
      } catch {
        // Ignore storage quota or serialization errors.
      }
    });

    return unsubscribe;
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <NetworkStatusProvider>
        <PwaRegistration />
        <ToastProvider>{children}</ToastProvider>
      </NetworkStatusProvider>
    </QueryClientProvider>
  );
}
