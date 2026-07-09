"use client";

import { cn } from "@/lib/utils";
import { useNetworkStatus } from "./NetworkStatusProvider";

export function OfflineInteractionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isOffline } = useNetworkStatus();

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <div className={cn(isOffline ? "pointer-events-none select-none" : "")}>
        {children}
      </div>
      {isOffline ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#121212] to-transparent" />
      ) : null}
    </div>
  );
}
