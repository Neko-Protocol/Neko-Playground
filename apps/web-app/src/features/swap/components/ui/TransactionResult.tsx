import React from "react";
import { getCowSwapExplorerUrl } from "@/lib/helpers/evm/cowswap";
import { getExplorerUrl } from "@/lib/helpers/stellar/swapUtils";

interface TransactionResultProps {
  txHash: string;
  swapMode: "evm" | "stellar";
  network?: string;
  selectedEvmChainId?: number;
  orderType: "swap" | "limit" | "twap";
}

export const TransactionResult: React.FC<TransactionResultProps> = ({
  txHash,
  swapMode,
  network,
  selectedEvmChainId,
  orderType,
}) => {
  const explorerUrl =
    swapMode === "evm" && selectedEvmChainId
      ? getCowSwapExplorerUrl(txHash, selectedEvmChainId)
      : network
        ? getExplorerUrl(txHash, network)
        : "#";

  return (
    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
      <h3 className="text-sm font-semibold text-green-700 mb-2">
        ✓ {orderType === "swap" ? "Swap" : "Limit Order"} Completed!
      </h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-600 font-mono break-all">
            {txHash}
          </span>
        </div>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-semibold"
        >
          <span>
            {swapMode === "evm"
              ? "View on CoW Explorer"
              : "View on Stellar Expert"}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
};
