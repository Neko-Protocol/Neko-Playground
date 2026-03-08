"use client";

import { useState } from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { useWallet } from "@/hooks/useWallet";
import { useBorrow } from "../../hooks/useBorrow";
import { useHealthFactor } from "../../hooks/useHealthFactor";
import { HealthFactorBadge } from "../ui/HealthFactorBadge";
import { BorrowTable } from "../ui/BorrowTable";
import { BorrowModal } from "../ui/BorrowModal";
import MyBorrowPositions from "../ui/MyBorrowPositions";

type PageTab = "pools" | "positions";

const Borrow: React.FC = () => {
  const { address } = useWallet();
  const { pools, isLoading: isLoadingHF } = useHealthFactor(
    address ?? undefined
  );

  const [activeTab, setActiveTab] = useState<PageTab>("pools");
  const {
    assets,
    paginatedAssets,
    isLoading,
    poolsError,
    selectedAsset,
    isProcessing,
    isWalletConnected,
    page,
    totalRows,
    totalPages,
    rowsPerPage,
    setPage,
    changeRowsPerPage,
    openModal,
    closeModal,
    handleSubmit,
  } = useBorrow();

  return (
    <PageContainer maxWidth="6xl">
      <BannerPage
        title="Borrow assets"
        subtitle="Select an option and start borrowing assets from liquidity pools"
        badge="Need a hand?"
        imageSrc="/banners/borrow.svg"
        imageAlt="Borrow illustration"
        className="mb-8"
      />
      <div className="flex items-center gap-1 rounded-xl bg-[#1C1C1C] p-1 w-fit mb-6">
        <button
          onClick={() => setActiveTab("pools")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
            activeTab === "pools"
              ? "bg-[#229EDF] text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          Pools
        </button>
        <button
          onClick={() => setActiveTab("positions")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
            activeTab === "positions"
              ? "bg-[#229EDF] text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          My Positions
        </button>
      </div>

      {address && (
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          {isLoadingHF
            ? [0, 1].map((i) => (
                <div
                  key={i}
                  className="flex-1 rounded-2xl bg-[#1C1C1C] border border-white/5 p-4 sm:p-5 animate-pulse"
                >
                  <div className="h-3 w-24 bg-white/10 rounded mb-3" />
                  <div className="h-2 w-full bg-white/5 rounded" />
                </div>
              ))
            : pools.map((pool) => (
                <div
                  key={pool.key}
                  className="flex-1 rounded-2xl bg-[#1C1C1C] border border-white/5 p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white/40 text-xs font-medium mb-0.5">
                        Health Factor — {pool.label}
                      </p>
                      <p className="text-white/25 text-xs">
                        {pool.healthFactor === null
                          ? "No open position"
                          : "Keep above 1.0 to avoid liquidation"}
                      </p>
                      <p className="text-white/15 text-[10px] font-mono mt-0.5">
                        {pool.contractId.slice(0, 6)}…
                        {pool.contractId.slice(-4)}
                      </p>
                    </div>
                    <HealthFactorBadge healthFactor={pool.healthFactor} />
                  </div>
                  {pool.healthFactor !== null && (
                    <div>
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pool.healthFactor >= 1.5
                              ? "bg-green-400"
                              : pool.healthFactor >= 1.0
                                ? "bg-yellow-400"
                                : "bg-red-400"
                          }`}
                          style={{
                            width: `${Math.min((pool.healthFactor / 2) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-white/20 text-xs">0</span>
                        <span className="text-white/20 text-xs">1.0</span>
                        <span className="text-white/20 text-xs">2.0+</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
        </div>
      )}

      {activeTab === "pools" && (
        <>
          <BorrowTable
            assets={assets}
            paginatedAssets={paginatedAssets}
            isLoading={isLoading}
            poolsError={poolsError}
            page={page}
            totalRows={totalRows}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            onBorrow={openModal}
            onPageChange={setPage}
            onRowsPerPageChange={changeRowsPerPage}
          />

          {selectedAsset && (
            <BorrowModal
              asset={selectedAsset}
              isProcessing={isProcessing}
              isWalletConnected={isWalletConnected}
              onClose={closeModal}
              onSubmit={handleSubmit}
            />
          )}
        </>
      )}

      {activeTab === "positions" && <MyBorrowPositions />}
    </PageContainer>
  );
};

export default Borrow;
