"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Gavel,
  HandCoins,
  Loader2,
  Info,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { useInterestAuction } from "../hooks/useInterestAuction";
import { ConnectWalletModal } from "@/features/wallet/components/ConnectWalletModal";

const MIN_AUCTION_AMOUNT = 100;

function HowItWorks() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-[#229EDF]" />
          <span className="text-white font-semibold text-sm">
            How do interest auctions work?
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-white/40" />
        ) : (
          <ChevronRight className="h-5 w-5 text-white/40" />
        )}
      </button>
      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t border-white/5">
          <ol className="space-y-3 text-sm text-white/70">
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#229EDF]/20 text-[#229EDF] text-xs font-medium flex items-center justify-center">
                1
              </span>
              <span>
                <strong className="text-white/90">Interest accumulates</strong>{" "}
                when users borrow from lending pools. A portion goes to the
                backstop.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#229EDF]/20 text-[#229EDF] text-xs font-medium flex items-center justify-center">
                2
              </span>
              <span>
                <strong className="text-white/90">Create an auction</strong> when
                there is at least {MIN_AUCTION_AMOUNT} units accumulated. Anyone
                can trigger it.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#229EDF]/20 text-[#229EDF] text-xs font-medium flex items-center justify-center">
                3
              </span>
              <span>
                <strong className="text-white/90">Participate</strong> by paying
                backstop tokens to receive the interest. You need backstop
                tokens (from depositing in the backstop).
              </span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}

export function InterestAuctionSection() {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [participateAuctionId, setParticipateAuctionId] = useState("");
  const [participateAsset, setParticipateAsset] = useState("");
  const [participateContractId, setParticipateContractId] = useState("");
  const [participateFillPercent, setParticipateFillPercent] = useState("100");
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [isFilling, setIsFilling] = useState(false);

  const {
    assets,
    isLoadingAssets,
    hasWallet,
    createAuction,
    fillAuction,
  } = useInterestAuction();

  const handleCreateAuction = async (assetCode: string, contractId: string) => {
    if (!hasWallet) {
      setShowWalletModal(true);
      return;
    }
    setIsCreating(assetCode);
    try {
      await createAuction(assetCode, contractId);
    } finally {
      setIsCreating(null);
    }
  };

  const handleFillAuction = async () => {
    if (!hasWallet) {
      setShowWalletModal(true);
      return;
    }
    const auctionId = parseInt(participateAuctionId, 10);
    const fillPercent = parseFloat(participateFillPercent);
    if (
      !Number.isFinite(auctionId) ||
      auctionId < 0 ||
      !participateAsset ||
      !participateContractId
    ) {
      return;
    }
    setIsFilling(true);
    try {
      await fillAuction({
        auctionId,
        assetCode: participateAsset,
        contractId: participateContractId,
        fillPercent,
      });
      setParticipateAuctionId("");
      setParticipateAsset("");
      setParticipateContractId("");
      setParticipateFillPercent("100");
    } finally {
      setIsFilling(false);
    }
  };

  const canFill =
    hasWallet &&
    participateAuctionId.trim() !== "" &&
    participateAsset !== "" &&
    participateContractId !== "" &&
    participateFillPercent !== "" &&
    parseFloat(participateFillPercent) >= 1 &&
    parseFloat(participateFillPercent) <= 100 &&
    Number.isFinite(parseInt(participateAuctionId, 10));

  const hasAnyReady = assets.some((a) => a.canCreate);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* How it works */}
      <HowItWorks />

      {/* Create Auction */}
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-[#2A2A2A] rounded-lg text-white/40">
            <Gavel className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">
              Create Interest Auction
            </h3>
            <p className="text-white/40 text-xs">
              Trigger an auction when enough interest has accumulated
            </p>
          </div>
        </div>

        {!hasWallet ? (
          <div className="py-6 text-center">
            <p className="text-white/40 text-sm mb-3">
              Connect your wallet to create or participate in auctions
            </p>
            <button
              type="button"
              onClick={() => setShowWalletModal(true)}
              className="rounded-xl bg-[#229EDF] text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Connect Wallet
            </button>
          </div>
        ) : isLoadingAssets ? (
          <div className="flex items-center justify-center py-8 gap-2 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading assets...</span>
          </div>
        ) : assets.length === 0 ? (
          <div className="py-6 text-center text-white/40 text-sm">
            No lending pools available
          </div>
        ) : (
          <>
            {!hasAnyReady && hasWallet && assets.length > 0 && (
              <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-200 text-sm font-medium mb-1">
                      No auctions available yet
                    </p>
                    <p className="text-white/70 text-xs mb-3">
                      You need at least {MIN_AUCTION_AMOUNT} units of accumulated
                      interest per asset. Interest accrues when users borrow from
                      the pool.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/lending"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#229EDF] hover:text-[#38b4f0] transition-colors"
                      >
                        Deposit to pool
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <span className="text-white/30">·</span>
                      <Link
                        href="/borrowing"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#229EDF] hover:text-[#38b4f0] transition-colors"
                      >
                        Borrow (generates interest)
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-3">
            {assets.map((asset) => (
              <div
                key={`${asset.assetCode}-${asset.contractId}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#222222] border border-white/5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium">
                      {asset.assetCode}
                    </span>
                    {asset.canCreate ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                        Ready to create
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                        Need {MIN_AUCTION_AMOUNT}+ {asset.assetCode}
                      </span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs mt-0.5">
                    Accumulated: {asset.accumulatedInterestFormatted}{" "}
                    {asset.assetCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCreateAuction(asset.assetCode, asset.contractId)
                  }
                  disabled={!asset.canCreate || isCreating === asset.assetCode}
                  className="shrink-0 rounded-lg bg-[#229EDF] text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2 min-w-[120px]"
                >
                  {isCreating === asset.assetCode ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Auction"
                  )}
                </button>
              </div>
            ))}
            </div>
          </>
        )}
      </div>

      {/* Participate in Auction */}
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-[#2A2A2A] rounded-lg text-white/40">
            <HandCoins className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">
              Participate in Auction
            </h3>
            <p className="text-white/40 text-xs">
              Pay backstop tokens to receive accumulated interest
            </p>
          </div>
        </div>

        {!hasWallet ? (
          <div className="py-6 text-center">
            <p className="text-white/40 text-sm">
              Connect your wallet to participate
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-md">
            <p className="text-white/50 text-xs mb-2">
              Enter the auction details below. You need backstop tokens to
              participate.
            </p>
            <div>
              <label className="block text-white/60 text-xs mb-1">
                Auction ID
              </label>
              <input
                type="number"
                min={0}
                value={participateAuctionId}
                onChange={(e) => setParticipateAuctionId(e.target.value)}
                placeholder="e.g. 1"
                className="w-full rounded-lg bg-[#222222] border border-white/10 px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#229EDF]"
              />
              <p className="text-white/40 text-xs mt-1">
                Shown when you create an auction, or from transaction events
              </p>
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1">Asset</label>
              <select
                value={
                  participateAsset && participateContractId
                    ? `${participateAsset}::${participateContractId}`
                    : ""
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) {
                    const [code, contractId] = v.split("::");
                    setParticipateAsset(code);
                    setParticipateContractId(contractId);
                  } else {
                    setParticipateAsset("");
                    setParticipateContractId("");
                  }
                }}
                className="w-full rounded-lg bg-[#222222] border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-[#229EDF]"
              >
                <option value="">Select asset</option>
                {assets.map((asset) => (
                  <option
                    key={`${asset.assetCode}-${asset.contractId}`}
                    value={`${asset.assetCode}::${asset.contractId}`}
                  >
                    {asset.assetCode}
                  </option>
                ))}
              </select>
              <p className="text-white/40 text-xs mt-1">
                The asset being auctioned (interest you will receive)
              </p>
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1">
                Fill % (1–100)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                step={0.1}
                value={participateFillPercent}
                onChange={(e) => setParticipateFillPercent(e.target.value)}
                className="w-full rounded-lg bg-[#222222] border border-white/10 px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#229EDF]"
              />
              <p className="text-white/40 text-xs mt-1">
                Percentage of the auction to fill (100 = full auction)
              </p>
            </div>
            {!canFill && (
              <p className="text-white/40 text-xs">
                Fill in Auction ID and select an asset to enable participation
              </p>
            )}
            <button
              type="button"
              onClick={handleFillAuction}
              disabled={!canFill || isFilling}
              className="w-full rounded-lg bg-[#229EDF] text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {isFilling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Participating...
                </>
              ) : (
                "Participate"
              )}
            </button>
          </div>
        )}
      </div>

      <ConnectWalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />
    </div>
  );
}
