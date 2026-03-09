"use client";

import React, { useState } from "react";
import { AlertTriangle, Gavel, Wallet } from "lucide-react";
import { useBadDebt } from "../../hooks/useBadDebt";
import { ConnectWalletModal } from "@/features/wallet/components/ConnectWalletModal";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";

const DEBT_ASSETS = ["USDC", "XLM"];

const LiquidationsSection: React.FC = () => {
  const [showConnectModal, setShowConnectModal] = useState(false);

  const [borrowerAddress, setBorrowerAddress] = useState("");
  const [debtAsset, setDebtAsset] = useState("USDC");
  const [auctionId, setAuctionId] = useState("");
  const [fillAmount, setFillAmount] = useState("");
  const [fillDebtAsset, setFillDebtAsset] = useState("USDC");

  const {
    checkBadDebt,
    borrowerChecked,
    hasBadDebtResult,
    isCheckingBadDebt,
    createAuction,
    isCreating,
    fillAuction,
    isFilling,
    isWalletConnected,
  } = useBadDebt();

  const availableDebtAssets = DEBT_ASSETS.filter(
    (a) => getAvailableTokens()[a]?.contract
  );

  const handleCheckBadDebt = () => {
    const trimmed = borrowerAddress.trim();
    if (!trimmed) return;
    checkBadDebt(trimmed);
  };

  const handleCreateAuction = async () => {
    const trimmed = borrowerAddress.trim();
    if (!trimmed) return;
    await createAuction(trimmed, debtAsset);
  };

  const handleFillAuction = async () => {
    const id = parseInt(auctionId, 10);
    if (!Number.isFinite(id) || id < 0) return;
    if (!fillAmount || parseFloat(fillAmount) <= 0) return;
    await fillAuction(id, fillAmount, fillDebtAsset);
  };

  if (!isWalletConnected) {
    return (
      <div className="w-full rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
        <Wallet className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-white/40 text-sm mb-4">
          Connect your wallet to create or fill bad debt auctions
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
    <div className="w-full space-y-8">
      {/* Create Bad Debt Auction */}
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-white/5">
          <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
          <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
            Create Bad Debt Auction
          </span>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-white/60 text-sm">
            When a borrower has debt but zero collateral, the protocol offers
            backstop tokens at a discount. Create an auction to allow bidders to
            cover the bad debt.
          </p>
          <div>
            <label className="block text-white/60 text-xs font-medium mb-2">
              Borrower address
            </label>
            <input
              type="text"
              value={borrowerAddress}
              onChange={(e) => setBorrowerAddress(e.target.value)}
              placeholder="G..."
              className="w-full rounded-xl bg-[#0D0D0D] border border-white/10 px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCheckBadDebt}
              disabled={!borrowerAddress.trim() || isCheckingBadDebt}
              className="rounded-xl bg-[#2A2A2A] text-white px-4 py-2.5 font-medium text-sm hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCheckingBadDebt ? "Checking..." : "Check Bad Debt"}
            </button>
            {borrowerChecked && (
              <span className="text-white/60 text-sm self-center">
                {hasBadDebtResult === true
                  ? "✓ Has bad debt"
                  : hasBadDebtResult === false
                    ? "No bad debt"
                    : ""}
              </span>
            )}
          </div>
          {hasBadDebtResult === true && (
            <div className="pt-2 space-y-3">
              <div>
                <label className="block text-white/60 text-xs font-medium mb-2">
                  Debt asset
                </label>
                <select
                  value={debtAsset}
                  onChange={(e) => setDebtAsset(e.target.value)}
                  className="w-full rounded-xl bg-[#0D0D0D] border border-white/10 px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20"
                >
                  {availableDebtAssets.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleCreateAuction}
                disabled={isCreating}
                className="rounded-xl bg-[#229EDF] text-white px-6 py-2.5 font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isCreating ? "Creating..." : "Create Auction"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fill Bad Debt Auction */}
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-white/5">
          <Gavel className="h-4 w-4 text-white/40 mr-2" />
          <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
            Fill Bad Debt Auction
          </span>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-white/60 text-sm">
            Participate in a bad debt auction by paying the debt asset and
            receiving backstop tokens at a discount.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 text-xs font-medium mb-2">
                Auction ID
              </label>
              <input
                type="text"
                value={auctionId}
                onChange={(e) => setAuctionId(e.target.value)}
                placeholder="e.g. 12345"
                className="w-full rounded-xl bg-[#0D0D0D] border border-white/10 px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="block text-white/60 text-xs font-medium mb-2">
                Amount
              </label>
              <input
                type="text"
                value={fillAmount}
                onChange={(e) => setFillAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl bg-[#0D0D0D] border border-white/10 px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-white/60 text-xs font-medium mb-2">
              Debt asset
            </label>
            <select
              value={fillDebtAsset}
              onChange={(e) => setFillDebtAsset(e.target.value)}
              className="w-full rounded-xl bg-[#0D0D0D] border border-white/10 px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20"
            >
              {availableDebtAssets.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleFillAuction}
            disabled={
              !auctionId ||
              !fillAmount ||
              parseFloat(fillAmount) <= 0 ||
              isFilling
            }
            className="rounded-xl bg-[#229EDF] text-white px-6 py-2.5 font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isFilling ? "Filling..." : "Fill Auction"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiquidationsSection;
