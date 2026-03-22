"use client";

import { useState } from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { useBorrow } from "../../hooks/useBorrow";
import { BorrowTable } from "../ui/BorrowTable";
import { BorrowModal } from "../ui/BorrowModal";
import MyBorrowPositions from "../ui/MyBorrowPositions";
import LiquidationsSection from "../ui/LiquidationsSection";
import { GetTestTokensBanner } from "@/features/wallet/components/GetTestTokensBanner";

type PageTab = "pools" | "liquidations" | "positions";

const Borrow: React.FC = () => {
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

      <GetTestTokensBanner className="mb-6" />

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
          onClick={() => setActiveTab("liquidations")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
            activeTab === "liquidations"
              ? "bg-[#229EDF] text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          Liquidations
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

      {activeTab === "liquidations" && <LiquidationsSection />}

      {activeTab === "positions" && <MyBorrowPositions />}
    </PageContainer>
  );
};

export default Borrow;
