"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackstopQueueStatusProps {
  inWithdrawalQueue: boolean;
  queueExpiresAt: Date | null;
  queueExpired: boolean;
  className?: string;
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BackstopQueueStatus({
  inWithdrawalQueue,
  queueExpiresAt,
  queueExpired,
  className,
}: BackstopQueueStatusProps) {
  if (!inWithdrawalQueue || !queueExpiresAt) return null;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex items-start gap-2.5",
        queueExpired
          ? "bg-green-500/10 border-green-500/20"
          : "bg-amber-500/10 border-amber-500/20",
        className
      )}
    >
      <Clock
        className={`h-4 w-4 shrink-0 mt-0.5 ${
          queueExpired ? "text-green-400" : "text-amber-400"
        }`}
      />
      <div className="min-w-0">
        <p
          className={`text-xs font-semibold ${
            queueExpired ? "text-green-400" : "text-amber-400"
          }`}
        >
          {queueExpired
            ? "Queue period expired — ready to withdraw"
            : `Queue expires ${formatDate(queueExpiresAt)}`}
        </p>
        {!queueExpired && (
          <p className="text-white/40 text-xs mt-0.5">
            You can withdraw after the queue period elapses.
          </p>
        )}
      </div>
    </div>
  );
}
