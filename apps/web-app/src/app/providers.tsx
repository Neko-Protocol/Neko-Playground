"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationProvider } from "@/providers/NotificationProvider";
import { ReactNode, useState } from "react";

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
      <NotificationProvider>{children}</NotificationProvider>
    </QueryClientProvider>
  );
}
