"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationProvider } from "@/providers/NotificationProvider";
import { ReactNode, useState } from "react";
import dynamic from "next/dynamic";

import "@rainbow-me/rainbowkit/styles.css";

const EvmWalletProviders = dynamic(
  () =>
    import("@/providers/EvmWalletProviders").then(
      (mod) => mod.EvmWalletProviders
    ),
  { ssr: false }
);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <EvmWalletProviders>
        <NotificationProvider>{children}</NotificationProvider>
      </EvmWalletProviders>
    </QueryClientProvider>
  );
}
