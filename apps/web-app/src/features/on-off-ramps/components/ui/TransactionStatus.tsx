"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { TransactionStatus } from "@/lib/anchors/types";

interface TransactionStatusProps {
  status: TransactionStatus;
  type: "onramp" | "offramp";
  transactionId: string;
  onDone: () => void;
}

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Awaiting payment...",
  processing: "Processing transaction...",
  completed: "Transaction complete!",
  failed: "Transaction failed",
  expired: "Transaction expired",
  cancelled: "Transaction cancelled",
  refunded: "Transaction refunded",
};

export const TransactionStatusDisplay: React.FC<TransactionStatusProps> = ({
  status,
  type,
  transactionId,
  onDone,
}) => {
  const router = useRouter();
  const isComplete = status === "completed";
  const isError = ["failed", "expired", "cancelled"].includes(status);
  const isPending = !isComplete && !isError;

  return (
    <div className="bg-[#1C1C1C] rounded-[20px] p-6 flex flex-col items-center gap-4 text-center">
      {isComplete && <CheckCircle className="h-12 w-12 text-green-400" />}
      {isError && <XCircle className="h-12 w-12 text-red-400" />}
      {isPending && (
        <Loader2 className="h-12 w-12 text-[#229EDF] animate-spin" />
      )}

      <div className="flex flex-col gap-1">
        <p className="text-white font-semibold">{STATUS_LABELS[status]}</p>
        {isPending && (
          <p className="text-white/40 text-sm">
            {type === "onramp"
              ? "We're waiting for your SPEI transfer to be confirmed."
              : "Your transaction is being processed on Stellar."}
          </p>
        )}
        {isComplete && (
          <p className="text-white/40 text-sm">
            {type === "onramp"
              ? "Your crypto has been sent to your Stellar wallet."
              : "Funds will arrive in your bank account shortly."}
          </p>
        )}
      </div>

      <p className="text-white/20 text-xs font-mono">
        ID: {transactionId.slice(0, 8)}...
      </p>

      {(isComplete || isError) && (
        <button
          onClick={() => {
            onDone();
            if (isComplete) router.push("/dashboard");
          }}
          className="w-full py-3 rounded-xl bg-[#229EDF] hover:bg-[#1a8bc7] text-white font-semibold transition-colors"
        >
          {isComplete ? "Go to Dashboard" : "Try Again"}
        </button>
      )}
    </div>
  );
};
