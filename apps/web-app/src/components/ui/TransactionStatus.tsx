import React, { useState } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  Check,
} from "lucide-react";
import { getExplorerUrl } from "@/lib/helpers/stellar/swapUtils";

interface TransactionStatusProps {
  status: "pending" | "confirming" | "success" | "failed";
  hash: string;
  type: "swap" | "lend" | "borrow" | "withdraw" | "deposit";
  network?: "testnet" | "mainnet";
  amountIn?: string;
  amountOut?: string;
  tokenIn?: string;
  tokenOut?: string;
  fee?: string;
  errorMessage?: string;
  onClose?: () => void;
  className?: string;
}

export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  status,
  hash,
  type,
  network = "testnet",
  amountIn,
  amountOut,
  tokenIn,
  tokenOut,
  fee,
  errorMessage,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const explorerUrl = getExplorerUrl(
    hash,
    network === "mainnet" ? "PUBLIC" : "TESTNET"
  );

  // Status configurations
  const statusConfig = {
    pending: {
      icon: <Loader2 className="w-6 h-6 animate-spin text-blue-600" />,
      title: "Transaction Pending",
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      desc: "Your transaction has been submitted and is processing.",
    },
    confirming: {
      icon: <Loader2 className="w-6 h-6 animate-spin text-purple-600" />,
      title: "Confirming Transaction",
      bg: "bg-purple-50",
      border: "border-purple-200",
      text: "text-purple-700",
      desc: "Waiting for blockchain confirmation.",
    },
    success: {
      icon: <CheckCircle className="w-6 h-6 text-green-600" />,
      title: "Transaction Successful",
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      desc: "Your transaction has been completed successfully.",
    },
    failed: {
      icon: <XCircle className="w-6 h-6 text-red-600" />,
      title: "Transaction Failed",
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      desc: errorMessage || "Something went wrong with your transaction.",
    },
  };

  const currentStatus = statusConfig[status];

  return (
    <div
      className={`p-4 rounded-xl border ${currentStatus.bg} ${currentStatus.border} ${className || ""}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{currentStatus.icon}</div>
        <div className="flex-grow">
          <h3 className={`font-semibold ${currentStatus.text}`}>
            {currentStatus.title}
          </h3>
          <p className={`text-sm ${currentStatus.text} opacity-90 mt-1`}>
            {currentStatus.desc}
          </p>
        </div>
      </div>

      {/* Transaction Details */}
      {(status === "success" ||
        status === "pending" ||
        status === "confirming") && (
        <div className="mt-4 space-y-2 pl-9">
          {/* Main Action Details */}
          {(amountIn || amountOut) && (
            <div className="text-sm font-medium text-gray-700 bg-white/50 p-2 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs uppercase tracking-wider">
                  {type} Details
                </span>
              </div>
              <div className="mt-1">
                {amountIn && tokenIn && (
                  <span>
                    {amountIn} {tokenIn}
                  </span>
                )}
                {amountIn && tokenIn && amountOut && tokenOut && (
                  <span className="mx-2 text-gray-400">→</span>
                )}
                {amountOut && tokenOut && (
                  <span>
                    {amountOut} {tokenOut}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Fees if available */}
          {fee && (
            <div className="flex justify-between text-xs text-gray-500 px-2">
              <span>Network Fee</span>
              <span>{fee} XLM</span>
            </div>
          )}
        </div>
      )}

      {/* Hash and Explorer Link */}
      <div className="mt-4 pt-3 border-t border-black/5 pl-9 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex items-center gap-2 bg-white/60 rounded px-2 py-1 max-w-full sm:max-w-[200px]">
          <span className="text-xs font-mono text-gray-600 truncate flex-grow">
            {hash}
          </span>
          <button
            onClick={handleCopyHash}
            className="text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
            title="Copy Hash"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${currentStatus.text} hover:opacity-80 transition-opacity whitespace-nowrap`}
        >
          View on Explorer
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
