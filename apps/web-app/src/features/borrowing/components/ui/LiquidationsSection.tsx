"use client";

import React, { useState } from "react";
import { Gavel, Wallet, RefreshCw, X } from "lucide-react";
import { useBadDebt, type ActiveBadDebtAuction } from "../../hooks/useBadDebt";
import { ConnectWalletModal } from "@/features/wallet/components/ConnectWalletModal";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";

// ---------------------------------------------------------------------------
// Fill Auction Modal
// ---------------------------------------------------------------------------

interface FillModalProps {
  auction: ActiveBadDebtAuction;
  onClose: () => void;
  onFill: (
    auctionId: number,
    amount: string,
    debtAsset: string
  ) => Promise<{ success: boolean }>;
  isFilling: boolean;
}

const FillModal: React.FC<FillModalProps> = ({
  auction,
  onClose,
  onFill,
  isFilling,
}) => {
  const [amount, setAmount] = useState("");
  const debtAmountFormatted = fromSmallestUnit(
    auction.debtAmount.toString(),
    7
  );

  const handleFill = async () => {
    const result = await onFill(auction.auctionId, amount, auction.debtAsset);
    if (result.success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-[#1C1C1C] border border-white/10 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-white/60" />
            <span className="text-white font-semibold text-sm">
              Fill Auction #{auction.auctionId}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Auction details */}
        <div className="rounded-xl bg-[#0D0D0D] border border-white/5 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">Borrower</span>
            <span className="text-white font-mono text-xs">
              {auction.borrower.slice(0, 6)}...{auction.borrower.slice(-6)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Debt asset</span>
            <span className="text-white">{auction.debtAsset}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Total debt</span>
            <span className="text-white">
              {debtAmountFormatted} {auction.debtAsset}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Backstop bonus</span>
            <span
              className={
                auction.backstopBonus > 50
                  ? "text-green-400 font-semibold"
                  : "text-amber-400"
              }
            >
              {auction.backstopBonus}%
            </span>
          </div>
        </div>

        <p className="text-white/40 text-xs">
          You pay {auction.debtAsset} and receive backstop tokens at a{" "}
          {auction.backstopBonus}% bonus. The bonus increases over time as more
          blocks pass.
        </p>

        {/* Amount input */}
        <div>
          <label className="block text-white/60 text-xs font-medium mb-2">
            Amount ({auction.debtAsset})
          </label>
          <div className="relative">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl bg-[#0D0D0D] border border-white/10 px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20 pr-20"
            />
            <button
              type="button"
              onClick={() => setAmount(debtAmountFormatted)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#229EDF] hover:opacity-80 font-medium"
            >
              Max
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFill}
          disabled={!amount || parseFloat(amount) <= 0 || isFilling}
          className="w-full rounded-xl bg-[#229EDF] text-white py-3 font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isFilling ? "Filling..." : "Fill Auction"}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Auction row
// ---------------------------------------------------------------------------

interface AuctionRowProps {
  auction: ActiveBadDebtAuction;
  onFill: (auction: ActiveBadDebtAuction) => void;
}

const AuctionRow: React.FC<AuctionRowProps> = ({ auction, onFill }) => {
  const debtAmountFormatted = fromSmallestUnit(
    auction.debtAmount.toString(),
    7
  );

  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="px-4 py-3 text-white/60 text-sm">#{auction.auctionId}</td>
      <td className="px-4 py-3 font-mono text-xs text-white/60">
        {auction.borrower.slice(0, 6)}...{auction.borrower.slice(-4)}
      </td>
      <td className="px-4 py-3 text-sm text-white">{auction.debtAsset}</td>
      <td className="px-4 py-3 text-sm text-white text-right">
        {debtAmountFormatted}
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className={`text-sm font-semibold ${
            auction.backstopBonus > 50 ? "text-green-400" : "text-amber-400"
          }`}
        >
          {auction.backstopBonus}%
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onFill(auction)}
          className="rounded-lg bg-[#229EDF] text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Fill
        </button>
      </td>
    </tr>
  );
};

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

const LiquidationsSection: React.FC = () => {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedAuction, setSelectedAuction] =
    useState<ActiveBadDebtAuction | null>(null);

  const {
    activeAuctions,
    isLoadingAuctions,
    refetchAuctions,
    fillAuction,
    isFilling,
    isWalletConnected,
  } = useBadDebt();

  if (!isWalletConnected) {
    return (
      <div className="w-full rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
        <Wallet className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-white/40 text-sm mb-4">
          Connect your wallet to participate in bad debt auctions
        </p>
        <button
          type="button"
          onClick={() => setShowConnectModal(true)}
          className="rounded-xl bg-[#229EDF] text-white px-6 py-2.5 font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Connect Wallet
        </button>
        <ConnectWalletModal
          isOpen={showConnectModal}
          onClose={() => setShowConnectModal(false)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="w-full rounded-2xl bg-[#1C1C1C] border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-white/40" />
            <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
              Active Bad Debt Auctions
            </span>
          </div>
          <button
            type="button"
            onClick={() => refetchAuctions()}
            disabled={isLoadingAuctions}
            className="text-white/30 hover:text-white/60 transition-colors disabled:cursor-not-allowed"
            title="Refresh"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoadingAuctions ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {isLoadingAuctions ? (
          <div className="p-8 text-center text-white/30 text-sm">
            Loading auctions...
          </div>
        ) : activeAuctions.length === 0 ? (
          <div className="p-8 text-center text-white/30 text-sm">
            No active bad debt auctions at the moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-white/30 uppercase tracking-wide">
                    ID
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-white/30 uppercase tracking-wide">
                    Borrower
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-white/30 uppercase tracking-wide">
                    Asset
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-white/30 uppercase tracking-wide">
                    Debt
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-white/30 uppercase tracking-wide">
                    Bonus
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {activeAuctions.map((auction) => (
                  <AuctionRow
                    key={auction.auctionId}
                    auction={auction}
                    onFill={setSelectedAuction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t border-white/5">
          <p className="text-white/30 text-xs">
            Bonus increases over 400 blocks (~33 min). Higher bonus = more
            backstop tokens per unit paid.
          </p>
        </div>
      </div>

      {selectedAuction && (
        <FillModal
          auction={selectedAuction}
          onClose={() => setSelectedAuction(null)}
          onFill={fillAuction}
          isFilling={isFilling}
        />
      )}
    </>
  );
};

export default LiquidationsSection;
